import { prisma } from "@/lib/prisma";
import { avaliarGatilho, executarFluxo, type EventoAutomacao, type Ligacoes } from "@/lib/automation-flow/motor";
import { anotarNaLinhaDoTempo, marcarExecucaoDeAutomacao } from "@/lib/integracoes/instagram-eventos";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";

/**
 * Dispara as automações quando chega uma mensagem — do lado do SERVIDOR, a partir do webhook.
 *
 * Antes disto, o motor só rodava no navegador (painel "Testar" do editor de fluxos) e as mensagens
 * eram apenas simuladas. Na prática isso queria dizer que automação nenhuma funcionava de verdade:
 * dependia de alguém estar com a tela aberta. Atendimento não funciona assim — a mensagem chega de
 * madrugada e a resposta tem que sair.
 *
 * O motor em si continua síncrono e puro. Como `Ligacoes` não é assíncrono, aqui ele só ANOTA o
 * que deve acontecer; a gravação no banco e o envio de verdade acontecem depois, já com `await`.
 */
export async function dispararAutomacoesDeMensagemRecebida(params: {
  workspaceId: string;
  contatoNome: string;
  /** "WhatsApp" | "Instagram" — o rótulo do canal da conversa, como fica em `Conversa.canal`. */
  canal: string;
  textoRecebido: string;
}): Promise<void> {
  await dispararAutomacoes({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    canal: params.canal,
    textoRecebido: params.textoRecebido,
    tipoGatilho: "mensagem_recebida",
  });
}

/**
 * Dispara as automações de um evento do Instagram que NÃO é mensagem — comentário, resposta a
 * comentário, reação, mídia, publicação compartilhada.
 *
 * Reaproveita o mesmo motor e as mesmas ações do resto do CRM de propósito: o Instagram é só a
 * origem do gatilho, e depois dele tudo que já existe (etiqueta, funil, tarefa, IA, atendente)
 * continua disponível. Um motor paralelo só pro Instagram significaria manter duas vezes cada
 * ação, e as duas divergiriam na primeira correção feita só de um lado.
 */
export async function dispararAutomacoesDeEventoInstagram(params: {
  workspaceId: string;
  contatoNome: string;
  tipoGatilho: string;
  textoRecebido: string;
  /** Id da publicação, quando o evento vier de uma — permite a automação valer só pra ela. */
  publicacaoId?: string;
  /** Trava contra disparo repetido: "comentario:<id>". */
  chaveEvento?: string;
  instagramUserId?: string;
  /** Como responder ao comentário que disparou, quando o fluxo pedir isso. */
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<void> {
  await dispararAutomacoes({ ...params, canal: "Instagram" });
}

async function dispararAutomacoes(params: {
  workspaceId: string;
  contatoNome: string;
  canal: string;
  textoRecebido: string;
  tipoGatilho: string;
  publicacaoId?: string;
  chaveEvento?: string;
  instagramUserId?: string;
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<void> {
  const { workspaceId, contatoNome, canal, textoRecebido } = params;

  const linhas = await prisma.fluxoAutomacao.findMany({
    where: { workspaceId, status: "publicado", ativa: true, arquivada: false },
  });
  if (!linhas.length) return;

  const contatoNoBanco = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
  });

  const contato = {
    // `etiquetas` vem como Json do banco (pode ser null) e o motor espera sempre uma lista — por
    // isso é normalizada DEPOIS do espalhamento, não antes.
    ...(contatoNoBanco ?? {}),
    nome: contatoNome,
    etiquetas: Array.isArray(contatoNoBanco?.etiquetas) ? (contatoNoBanco.etiquetas as string[]) : [],
    // Disponíveis pras condições do fluxo ("mensagem contém…", "canal é…").
    canal: canalDoGatilho(canal),
    mensagem: textoRecebido,
  };

  for (const linha of linhas) {
    const fluxo = linha as unknown as FluxoAutomacao;

    const evento = {
      tipo: params.tipoGatilho as EventoAutomacao["tipo"],
      contatoNome,
      canal: canalDoGatilho(canal),
      mensagem: textoRecebido,
      ...(params.publicacaoId ? { publicacaoId: params.publicacaoId } : {}),
    };
    if (!avaliarGatilho(fluxo, evento)) continue;

    // O gatilho tem um canal escolhido no bloco; um fluxo de WhatsApp não pode responder no
    // Instagram só porque chegou mensagem de lá.
    const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");
    const canalDoFluxo = (noGatilho?.data as { canal?: string } | undefined)?.canal;
    if (canalDoFluxo && canalDoFluxo !== canalDoGatilho(canal)) continue;

    const primeiraAresta = fluxo.edges.find((e) => e.source === noGatilho?.id);
    if (!primeiraAresta) continue;

    // Trava de idempotência: o mesmo comentário nunca executa o mesmo fluxo duas vezes. A Meta
    // reenvia webhook rotineiramente, e sem isto a pessoa receberia a mesma resposta repetida.
    if (params.chaveEvento) {
      const primeiraVez = await marcarExecucaoDeAutomacao({
        workspaceId,
        fluxoId: linha.id,
        chaveEvento: params.chaveEvento,
        instagramUserId: params.instagramUserId,
      });
      if (!primeiraVez) continue;
    }

    const mensagensParaEnviar: { canal: string; conteudo: string }[] = [];
    const respostasDeComentario: string[] = [];
    const contatosParaSalvar: Record<string, unknown>[] = [];
    const movimentosDeFunil: { funilId: string; etapaTitulo: string }[] = [];

    const ligacoes: Ligacoes = {
      moverEtapa: (funilId, etapaTitulo) => movimentosDeFunil.push({ funilId, etapaTitulo }),
      salvarContato: (_nome, dados) => contatosParaSalvar.push(dados),
      atribuirAtendente: (_nome, atendente) => contatosParaSalvar.push({ responsavel: atendente }),
      // Deixa de ser "simulada": o que o fluxo manda escrever entra na fila e sai de verdade
      // logo abaixo.
      registrarMensagemSimulada: (info) => mensagensParaEnviar.push(info),
      // Responder o comentário só faz sentido quando FOI um comentário que disparou o fluxo — em
      // outro gatilho não existe comentário a que responder, e a ação é ignorada em silêncio em
      // vez de falhar o fluxo inteiro.
      responderComentario: (texto) => {
        if (params.responderComentario) respostasDeComentario.push(texto);
      },
    };

    let registro;
    try {
      registro = executarFluxo(fluxo, primeiraAresta.target, { contato }, ligacoes);
    } catch (erro) {
      console.error(`[automacao] fluxo ${linha.id} falhou:`, erro);
      continue;
    }

    // A automação entra na linha do tempo do lead — sem isso, o histórico mostrava a mensagem
    // automática saindo do nada, sem dizer que foi um fluxo que a mandou.
    await anotarNaLinhaDoTempo({
      workspaceId,
      contatoNome,
      canal,
      tipo: "automacao_iniciou",
      descricao: `automação "${linha.nome}" começou`,
      dados: { fluxoId: linha.id },
    });

    for (const texto of respostasDeComentario) {
      await params.responderComentario?.(texto).catch((erro) =>
        console.error(`[automacao] falha ao responder comentário:`, erro),
      );
    }

    for (const dados of contatosParaSalvar) {
      await prisma.contato
        .update({ where: { workspaceId_nome: { workspaceId, nome: contatoNome } }, data: dados })
        .catch((erro) => console.error(`[automacao] falha ao salvar contato:`, erro));
    }

    for (const movimento of movimentosDeFunil) {
      await moverCardDeEtapa(workspaceId, contatoNome, movimento.funilId, movimento.etapaTitulo).catch((erro) =>
        console.error(`[automacao] falha ao mover etapa:`, erro),
      );
      await anotarNaLinhaDoTempo({
        workspaceId,
        contatoNome,
        canal,
        tipo: "entrou_no_funil",
        descricao: `entrou na etapa "${movimento.etapaTitulo}"`,
        dados: { funilId: movimento.funilId },
      });
    }

    for (const mensagem of mensagensParaEnviar) {
      const resultado = await enviarTextoPeloCanal({ workspaceId, conversaNome: contatoNome, texto: mensagem.conteudo });
      if (!resultado.enviado) {
        console.error(`[automacao] mensagem do fluxo ${linha.id} não saiu: ${resultado.motivo}`);
      }
      await anotarNaLinhaDoTempo({
        workspaceId,
        contatoNome,
        canal,
        // Falha também é registrada: uma automação que não conseguiu falar com o lead precisa
        // aparecer no histórico, senão o vendedor assume que a mensagem foi entregue.
        tipo: resultado.enviado ? "crm_enviou_mensagem" : "crm_falhou_ao_enviar",
        descricao: resultado.enviado
          ? `CRM enviou: "${mensagem.conteudo.slice(0, 120)}"`
          : `CRM não conseguiu enviar: ${resultado.motivo ?? "motivo desconhecido"}`,
        dados: { fluxoId: linha.id },
      });
    }

    await prisma.fluxoAutomacao
      .update({ where: { id: linha.id }, data: { execucoes: { increment: 1 } } })
      .catch(() => {});

    console.log(`[automacao] fluxo "${linha.nome}" executado`, {
      passos: registro.passos.length,
      mensagens: mensagensParaEnviar.length,
    });
  }
}

/** O gatilho guarda o canal em minúsculas ("whatsapp"/"instagram"); a conversa guarda o rótulo. */
function canalDoGatilho(canalDaConversa: string): string {
  return canalDaConversa.toLowerCase();
}

/** Move (ou cria) o card do contato na etapa pedida. */
async function moverCardDeEtapa(
  workspaceId: string,
  contatoNome: string,
  funilId: string,
  etapaTitulo: string,
): Promise<void> {
  const etapa = await prisma.funilEtapa.findFirst({ where: { funilId, titulo: etapaTitulo } });
  if (!etapa) return;

  const card = await prisma.negocioCard.findFirst({ where: { workspaceId, nome: contatoNome } });
  if (card) {
    await prisma.negocioCard.update({ where: { id: card.id }, data: { etapaId: etapa.id } });
    return;
  }

  await prisma.negocioCard.create({
    data: {
      id: `${workspaceId}-${contatoNome}-${Date.now()}`,
      etapaId: etapa.id,
      ordem: 0,
      workspaceId,
      nome: contatoNome,
      valor: "—",
      origem: "Automação",
      dias: "Hoje",
      data: new Date().toISOString().slice(0, 10),
    },
  });
}
