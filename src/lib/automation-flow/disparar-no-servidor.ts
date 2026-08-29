import { prisma } from "@/lib/prisma";
import { avaliarGatilho, executarFluxo, type Ligacoes } from "@/lib/automation-flow/motor";
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
      tipo: "mensagem_recebida" as const,
      contatoNome,
      canal: canalDoGatilho(canal),
      mensagem: textoRecebido,
    };
    if (!avaliarGatilho(fluxo, evento)) continue;

    // O gatilho tem um canal escolhido no bloco; um fluxo de WhatsApp não pode responder no
    // Instagram só porque chegou mensagem de lá.
    const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");
    const canalDoFluxo = (noGatilho?.data as { canal?: string } | undefined)?.canal;
    if (canalDoFluxo && canalDoFluxo !== canalDoGatilho(canal)) continue;

    const primeiraAresta = fluxo.edges.find((e) => e.source === noGatilho?.id);
    if (!primeiraAresta) continue;

    const mensagensParaEnviar: { canal: string; conteudo: string }[] = [];
    const contatosParaSalvar: Record<string, unknown>[] = [];
    const movimentosDeFunil: { funilId: string; etapaTitulo: string }[] = [];

    const ligacoes: Ligacoes = {
      moverEtapa: (funilId, etapaTitulo) => movimentosDeFunil.push({ funilId, etapaTitulo }),
      salvarContato: (_nome, dados) => contatosParaSalvar.push(dados),
      atribuirAtendente: (_nome, atendente) => contatosParaSalvar.push({ responsavel: atendente }),
      // Deixa de ser "simulada": o que o fluxo manda escrever entra na fila e sai de verdade
      // logo abaixo.
      registrarMensagemSimulada: (info) => mensagensParaEnviar.push(info),
    };

    let registro;
    try {
      registro = executarFluxo(fluxo, primeiraAresta.target, { contato }, ligacoes);
    } catch (erro) {
      console.error(`[automacao] fluxo ${linha.id} falhou:`, erro);
      continue;
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
    }

    for (const mensagem of mensagensParaEnviar) {
      const resultado = await enviarTextoPeloCanal({ workspaceId, conversaNome: contatoNome, texto: mensagem.conteudo });
      if (!resultado.enviado) {
        console.error(`[automacao] mensagem do fluxo ${linha.id} não saiu: ${resultado.motivo}`);
      }
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
