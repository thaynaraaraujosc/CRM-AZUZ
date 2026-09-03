import { prisma } from "@/lib/prisma";
import { enviarEmailOuFalhar } from "@/lib/email";
import { enviarMensagemWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { contaConectada, enviarPelaCloudApi, tratarErroEnvio } from "@/lib/integracoes/whatsapp-oficial";
import { RITMO, intervaloEntreEnvios, type CanalCampanha } from "./ritmo";

/**
 * O motor das campanhas.
 *
 * Roda FORA do request de quem clicou: quem dispara é o cron (ver `/api/cron/campanhas`). É isso
 * que faz o agendamento valer mesmo com o navegador fechado, e o que impede uma campanha de cinco
 * mil pessoas de depender de uma aba aberta.
 *
 * Cada rodada tem tempo curto de propósito. Numa função serverless não dá pra segurar um processo
 * por horas, então a campanha avança em fatias: o cron chama, o worker envia o que cabe na janela,
 * grava tudo e sai. A próxima chamada continua de onde parou — o estado está no banco, não na
 * memória.
 */

/** Teto de tempo de uma rodada. Abaixo do limite da plataforma, com folga pro que vem depois. */
const SEGUNDOS_POR_RODADA = 50;

/**
 * Quantas campanhas de workspaces diferentes uma rodada atende.
 *
 * Existe por causa do multi-tenant: sem isto, a campanha de cinco mil de um cliente ocuparia todas
 * as rodadas e a campanha de dez de outro cliente esperaria horas pra começar. Atendendo várias por
 * rodada, todas andam juntas — mais devagar cada uma, mas nenhuma parada.
 */
const CAMPANHAS_POR_RODADA = 5;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Destinatario = {
  id: string;
  contatoNome: string;
  destino: string;
  tentativas: number;
};

/** Quantas mensagens desta campanha já saíram nas últimas 24h — pra respeitar o teto diário. */
async function enviadosNasUltimas24h(workspaceId: string, canal: string): Promise<number> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.campanhaDestinatario.count({
    where: {
      workspaceId,
      status: { in: ["enviado", "entregue", "lido"] },
      enviadoEm: { gte: desde },
      campanha: { canal },
    },
  });
}

/**
 * Envia UMA mensagem. Devolve o id do provedor quando ele existe.
 *
 * Erro definitivo (número inválido, e-mail inexistente) e erro temporário (rede, provedor fora)
 * chegam aqui do mesmo jeito — a distinção é feita por quem chama, olhando o número de tentativas.
 * Insistir num número que não existe só gasta cota.
 */
async function enviarUm(
  canal: CanalCampanha,
  workspaceId: string,
  destino: string,
  corpo: string,
  assunto: string | null,
  template: { nome: string; idioma: string } | null,
): Promise<string | undefined> {
  if (canal === "email") {
    // Versão que ESTOURA: a que engole o erro serve pros e-mails de sistema, não pra campanha —
    // aqui um envio que falhou precisa marcar o destinatário como falhou, com o motivo.
    await enviarEmailOuFalhar({ to: destino, subject: assunto ?? "", html: corpo });
    return undefined;
  }

  if (canal === "whatsapp_nao_oficial") {
    await enviarMensagemWhatsAppNaoOficial(workspaceId, destino.replace(/\D/g, ""), corpo);
    return undefined;
  }

  // WhatsApp oficial. Campanha fala com quem não escreveu primeiro, então a janela de 24h está
  // fechada na maioria dos casos e o único caminho permitido é o modelo aprovado. Texto livre só
  // vai quando a campanha não tem template — aí é responsabilidade de quem montou.
  // `contaConectada` já devolve o token descriptografado e confere status/phoneNumberId — o mesmo
  // caminho que a tela de Conversas usa, pra campanha e atendimento nunca divergirem.
  const conta = await contaConectada(workspaceId);
  if (!conta) throw new Error("WhatsApp oficial não está conectado.");

  const corpoMensagem = template
    ? {
        type: "template" as const,
        template: { name: template.nome, language: { code: template.idioma } },
      }
    : { type: "text" as const, text: { body: corpo, preview_url: true } };

  try {
    return (await enviarPelaCloudApi(conta, destino, corpoMensagem)) ?? undefined;
  } catch (erro) {
    // Traduz o erro da Graph e, quando o token morreu, marca a integração como desconectada — sem
    // isso a campanha seguiria queimando destinatário contra uma conexão que já caiu.
    throw new Error(await tratarErroEnvio(erro, conta.integracaoId));
  }
}

/**
 * Processa uma campanha até o tempo da rodada acabar, o teto diário fechar ou os destinatários
 * terminarem.
 */
async function processarCampanha(campanhaId: string, prazoFinal: number): Promise<void> {
  const campanha = await prisma.campanha.findUnique({ where: { id: campanhaId } });
  // Some do meio do caminho se alguém pausou ou cancelou enquanto a rodada corria.
  if (!campanha || (campanha.status !== "enviando" && campanha.status !== "agendada")) return;

  const canal = campanha.canal as CanalCampanha;
  const ritmo = RITMO[canal];
  if (!ritmo) return;

  if (campanha.status === "agendada") {
    await prisma.campanha.update({
      where: { id: campanhaId },
      data: { status: "enviando", iniciadaEm: new Date() },
    });
  }

  const template =
    campanha.templateNome && campanha.templateIdioma
      ? { nome: campanha.templateNome, idioma: campanha.templateIdioma }
      : null;

  while (Date.now() < prazoFinal) {
    // Teto diário: conferido a cada mensagem, não uma vez no começo — a rodada pode atravessar a
    // virada da janela de 24h, e outra campanha do mesmo workspace pode estar consumindo a cota.
    if (ritmo.porDia !== null) {
      const jaEnviados = await enviadosNasUltimas24h(campanha.workspaceId, canal);
      if (jaEnviados >= ritmo.porDia) return; // Volta amanhã: a campanha continua "enviando".
    }

    // Pega UM por vez. Marcar como "enviando" antes de sair daqui é o que impede dois workers
    // simultâneos de mandarem a mesma mensagem duas vezes.
    const proximo = (await prisma.campanhaDestinatario.findFirst({
      where: { campanhaId, status: "pendente" },
      orderBy: { criadoEm: "asc" },
      select: { id: true, contatoNome: true, destino: true, tentativas: true },
    })) as Destinatario | null;

    if (!proximo) {
      // Acabou. Com erro ou sem erro, decide a contagem de falhas.
      const falhas = await prisma.campanhaDestinatario.count({
        where: { campanhaId, status: "falhou" },
      });
      const aindaEmVoo = await prisma.campanhaDestinatario.count({
        where: { campanhaId, status: "enviando" },
      });
      if (aindaEmVoo > 0) return; // Alguém está no meio de um envio; conclui na próxima rodada.
      await prisma.campanha.update({
        where: { id: campanhaId },
        data: {
          status: falhas > 0 ? "concluida_com_erros" : "concluida",
          concluidaEm: new Date(),
        },
      });
      return;
    }

    const reservado = await prisma.campanhaDestinatario.updateMany({
      where: { id: proximo.id, status: "pendente" },
      data: { status: "enviando", tentativas: { increment: 1 } },
    });
    // Outro worker chegou primeiro nesta linha — segue pro próximo sem enviar nada.
    if (reservado.count === 0) continue;

    try {
      const idExterno = await enviarUm(
        canal,
        campanha.workspaceId,
        proximo.destino,
        campanha.corpo,
        campanha.assunto,
        template,
      );
      await prisma.campanhaDestinatario.update({
        where: { id: proximo.id },
        data: { status: "enviado", idExterno, enviadoEm: new Date(), erroMensagem: null },
      });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao enviar.";
      // Até 3 tentativas: falha de rede e provedor fora do ar passam, número inválido não melhora
      // com insistência — e cada nova tentativa consome cota que faz falta pra quem existe.
      const desiste = proximo.tentativas + 1 >= 3;
      await prisma.campanhaDestinatario.update({
        where: { id: proximo.id },
        data: { status: desiste ? "falhou" : "pendente", erroMensagem: mensagem },
      });
    }

    await dormir(intervaloEntreEnvios(canal));
  }
}

/**
 * Uma rodada do cron: acha o que está pronto pra rodar e distribui o tempo entre as campanhas.
 *
 * A busca é por campanha, não por destinatário, e pega no máximo uma por workspace: é assim que
 * clientes diferentes avançam em paralelo em vez de um monopolizar a fila.
 */
export async function rodarRodadaDeCampanhas(): Promise<{ campanhas: number }> {
  const agora = new Date();

  const candidatas = await prisma.campanha.findMany({
    where: {
      status: { in: ["agendada", "enviando"] },
      agendadaPara: { lte: agora },
    },
    orderBy: { agendadaPara: "asc" },
    select: { id: true, workspaceId: true },
    take: CAMPANHAS_POR_RODADA * 4,
  });

  const porWorkspace = new Map<string, string>();
  for (const c of candidatas) {
    if (!porWorkspace.has(c.workspaceId)) porWorkspace.set(c.workspaceId, c.id);
    if (porWorkspace.size >= CAMPANHAS_POR_RODADA) break;
  }
  const ids = Array.from(porWorkspace.values());
  if (!ids.length) return { campanhas: 0 };

  // O tempo da rodada é dividido entre as campanhas ativas — cada uma anda um pedaço.
  const fatia = (SEGUNDOS_POR_RODADA * 1000) / ids.length;
  for (const id of ids) {
    await processarCampanha(id, Date.now() + fatia).catch((erro) => {
      console.error("[campanhas] falha ao processar campanha:", id, erro instanceof Error ? erro.message : erro);
    });
  }

  return { campanhas: ids.length };
}
