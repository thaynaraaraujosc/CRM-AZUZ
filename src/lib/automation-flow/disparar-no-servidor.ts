import { prisma } from "@/lib/prisma";
import { avaliarGatilho, type EventoAutomacao } from "@/lib/automation-flow/avaliacao";
import { anotarNaLinhaDoTempo, marcarExecucaoDeAutomacao } from "@/lib/integracoes/instagram-eventos";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";
import { continuarComResposta, iniciarFluxoComEstado } from "@/lib/automacoes/iniciar";

/**
 * Dispara as automações quando chega uma mensagem. Do lado do SERVIDOR, a partir do webhook.
 *
 * Antes disto, o motor só rodava no navegador (painel "Testar" do editor de fluxos) e as mensagens
 * eram apenas simuladas. Na prática isso queria dizer que automação nenhuma funcionava de verdade:
 * dependia de alguém estar com a tela aberta. Atendimento não funciona assim: a mensagem chega de
 * madrugada e a resposta tem que sair.
 *
 * O motor em si continua síncrono e puro. Como `Ligacoes` não é assíncrono, aqui ele só ANOTA o
 * que deve acontecer; a gravação no banco e o envio de verdade acontecem depois, já com `await`.
 */
export async function dispararAutomacoesDeMensagemRecebida(params: {
  workspaceId: string;
  contatoNome: string;
  /** "WhatsApp" | "Instagram": o rótulo do canal da conversa, como fica em `Conversa.canal`. */
  canal: string;
  textoRecebido: string;
  /** Id da opção escolhida, quando a mensagem foi um clique em botão/lista/resposta rápida. */
  idDaOpcao?: string;
}): Promise<void> {
  await dispararAutomacoes({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    canal: params.canal,
    textoRecebido: params.textoRecebido,
    idDaOpcao: params.idDaOpcao,
    tipoGatilho: "mensagem_recebida",
  });
}

/**
 * Dispara as automações de um evento do Instagram que NÃO é mensagem. Comentário, resposta a
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
  /** Id da publicação, quando o evento vier de uma. Permite a automação valer só pra ela. */
  publicacaoId?: string;
  /** Trava contra disparo repetido: "comentario:<id>". */
  chaveEvento?: string;
  instagramUserId?: string;
  /** Como responder ao comentário que disparou, quando o fluxo pedir isso. */
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<void> {
  await dispararAutomacoes({ ...params, canal: "Instagram" });
}

/**
 * Dispara as automações de um evento do CRM. Entrar numa etapa do funil, virar lead novo.
 *
 * Estes gatilhos rodavam no NAVEGADOR: quem arrastasse o card via um aviso na tela e nada mais.
 * Duas consequências ruins: a automação não acontecia quando o card se movia por qualquer outro
 * caminho (webhook, importação, outra aba), e quando acontecia era só um toast, não a mensagem.
 */
export async function dispararAutomacoesDoCrm(params: {
  workspaceId: string;
  contatoNome: string;
  tipoGatilho: string;
  funilId?: string;
  etapaId?: string;
  etapaTitulo?: string;
  /** Trava contra disparo repetido: "etapa:<cardId>:<etapaId>". */
  chaveEvento?: string;
}): Promise<void> {
  await dispararAutomacoes({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    canal: "CRM",
    textoRecebido: "",
    tipoGatilho: params.tipoGatilho,
    funilId: params.funilId,
    etapaId: params.etapaId,
    etapaTitulo: params.etapaTitulo,
    chaveEvento: params.chaveEvento,
  });
}

async function dispararAutomacoes(params: {
  workspaceId: string;
  contatoNome: string;
  canal: string;
  textoRecebido: string;
  tipoGatilho: string;
  idDaOpcao?: string;
  funilId?: string;
  etapaId?: string;
  etapaTitulo?: string;
  publicacaoId?: string;
  chaveEvento?: string;
  instagramUserId?: string;
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<void> {
  const { workspaceId, contatoNome, canal, textoRecebido } = params;

  // Antes de avaliar gatilho nenhum: alguma automação está ESPERANDO a resposta desta pessoa?
  // Se está, esta mensagem é a continuação dela. Não o começo de outra. Sem esta checagem,
  // responder "1" a uma pergunta receberia o fluxo inteiro de novo por cima.
  if (params.tipoGatilho === "mensagem_recebida") {
    const continuou = await continuarComResposta({
      workspaceId,
      contatoNome,
      texto: textoRecebido,
      idDaOpcao: params.idDaOpcao,
    }).catch((erro) => {
      console.error("[automacao] falha ao continuar execução em espera:", erro);
      return false;
    });
    if (continuou) return;
  }

  const linhas = await prisma.fluxoAutomacao.findMany({
    where: { workspaceId, status: "publicado", ativa: true, arquivada: false },
  });
  if (!linhas.length) return;

  const contatoNoBanco = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
  });

  const contato = {
    // `etiquetas` vem como Json do banco (pode ser null) e o motor espera sempre uma lista. Por
    // isso é normalizada DEPOIS do espalhamento, não antes.
    ...(contatoNoBanco ?? {}),
    nome: contatoNome,
    etiquetas: Array.isArray(contatoNoBanco?.etiquetas) ? (contatoNoBanco.etiquetas as string[]) : [],
    // Disponíveis pras condições do fluxo ("mensagem contém…", "canal é…").
    canal: canalDoGatilho(canal),
    mensagem: textoRecebido,
    ...(params.funilId ? { funilId: params.funilId } : {}),
    ...(params.etapaTitulo ? { etapaTitulo: params.etapaTitulo } : {}),
  };

  for (const linha of linhas) {
    const fluxo = linha as unknown as FluxoAutomacao;

    // Um evento pode casar com mais de um bloco de gatilho. Uma mensagem que chega serve pra
    // "Mensagem recebida", pra "Palavra-chave recebida" (a filtragem por palavra é do próprio
    // bloco) e pra "Lead respondeu". São três formas de dizer a mesma coisa, e quem monta o fluxo
    // escolhe a que faz sentido pra ela. Sem isto, um fluxo com o bloco "Palavra-chave recebida"
    // simplesmente nunca disparava: o tipo do evento não batia com o tipo do bloco.
    const noGatilhoDoFluxo = fluxo.nodes.find((n) => n.category === "gatilho");
    const tipoAceito = tipoDoGatilhoQueCasa(params.tipoGatilho, noGatilhoDoFluxo?.type);
    if (!tipoAceito) continue;

    // A etapa é a dona do gatilho quando existe um gatilho de etapa apontando pra este fluxo.
    // Sem esta checagem, um fluxo com bloco de gatilho E linha em GatilhoEtapa dispararia DUAS
    // vezes pro mesmo lead: o bloco por aqui, a etapa pelo outro caminho.
    if (params.etapaId && (await etapaJaDisparaEsteFluxo(workspaceId, linha.id, params.etapaId))) {
      continue;
    }

    const evento = {
      tipo: tipoAceito as EventoAutomacao["tipo"],
      contatoNome,
      canal: canalDoGatilho(canal),
      mensagem: textoRecebido,
      ...(params.funilId ? { funilId: params.funilId } : {}),
      ...(params.etapaId ? { etapaId: params.etapaId } : {}),
      ...(params.publicacaoId ? { publicacaoId: params.publicacaoId } : {}),
    };
    if (!avaliarGatilho(fluxo, evento)) continue;

    // O gatilho tem um canal escolhido no bloco; um fluxo de WhatsApp não pode responder no
    // Instagram só porque chegou mensagem de lá.
    const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");
    const canalDoFluxo = (noGatilho?.data as { canal?: string } | undefined)?.canal;
    if (canal !== "CRM" && canalDoFluxo && canalDoFluxo !== canalDoGatilho(canal)) continue;

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

    // Um motor só, o com estado. O antigo (síncrono, sem memória) foi removido: ele não sabia
    // esperar, engolia as opções de uma pergunta e mantinha uma segunda lista de blocos que
    // divergia da primeira a cada correção feita só de um lado.
    {
      const fim = await iniciarFluxoComEstado({
        workspaceId,
        fluxoId: linha.id,
        gatilho: params.tipoGatilho,
        configuracoes: linha.configuracoes as never,
        publicarSeFaltar: {
          versao: Math.max(1, Number(linha.versaoAtual ?? 1)),
          nodes: fluxo.nodes,
          edges: fluxo.edges,
          configuracoes: fluxo.configuracoes,
        },
        contatoNome,
        contatoId: contatoNoBanco?.id ?? null,
        contato,
        responderComentario: params.responderComentario,
      }).catch((erro) => {
        console.error(`[automacao] fluxo ${linha.id} falhou no motor com estado:`, erro);
        return null;
      });
      // `null` = fluxo sem versão publicada, ou sem nada ligado no gatilho. Executar o rascunho
      // aqui seria mandar pro cliente o que alguém está editando agora. Não roda, e o aviso fica
      // no log pra a causa aparecer.
      if (!fim) {
        console.warn(`[automacao] fluxo ${linha.id} não tem versão publicada pra rodar`);
        continue;
      }
      await anotarNaLinhaDoTempo({
        workspaceId,
        contatoNome,
        canal,
        tipo: "automacao_iniciou",
        descricao: `automação "${linha.nome}" começou`,
        dados: { fluxoId: linha.id },
      });
      await prisma.fluxoAutomacao.update({ where: { id: linha.id }, data: { execucoes: { increment: 1 } } }).catch(() => {});
      console.log(`[automacao] fluxo "${linha.nome}" executado`, fim);
    }
  }
}

/**
 * Que tipo de gatilho este evento consegue acionar neste fluxo.
 *
 * Devolve o tipo a usar na avaliação, ou `null` quando o bloco de gatilho do fluxo não tem nada a
 * ver com o evento. Existe porque "chegou uma mensagem" é o mesmo acontecimento para três blocos
 * diferentes, e antes só um deles era considerado.
 */
function tipoDoGatilhoQueCasa(tipoDoEvento: string, tipoDoBloco: string | undefined): string | null {
  if (!tipoDoBloco) return null;
  if (tipoDoBloco === tipoDoEvento) return tipoDoEvento;

  const equivalentes: Record<string, string[]> = {
    // "Lead respondeu" só vale quando a conversa já existia, mas o CRM não distingue isso hoje.
    // E deixar de fora seria pior: o bloco existe na biblioteca e nunca dispararia.
    mensagem_recebida: ["palavra_chave", "lead_respondeu"],
  };
  return equivalentes[tipoDoEvento]?.includes(tipoDoBloco) ? tipoDoBloco : null;
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
      valor: "-",
      origem: "Automação",
      dias: "Hoje",
      data: new Date().toISOString().slice(0, 10),
    },
  });
}

/**
 * A etapa já executa este fluxo por conta própria?
 *
 * É a pergunta que separa "o gatilho mora no bloco" de "o gatilho mora na etapa". Com a linha em
 * `GatilhoEtapa`, quem dispara é a etapa, e o bloco de gatilho vira só desenho: continua no canvas
 * (pra dar pra voltar atrás) mas não aciona nada.
 */
async function etapaJaDisparaEsteFluxo(workspaceId: string, fluxoId: string, etapaId: string): Promise<boolean> {
  const gatilho = await prisma.gatilhoEtapa.findFirst({
    where: { workspaceId, fluxoId, etapaId, ativo: true },
    select: { id: true },
  });
  return !!gatilho;
}
