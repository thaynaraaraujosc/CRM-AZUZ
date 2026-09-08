import { prisma } from "@/lib/prisma";
import type { ConfiguracoesFluxo, FlowEdge, FlowNode, MensagemBotoesData } from "@/lib/automation-flow/types";

import { acoesReais, type AcoesDoMotor } from "./acoes";
import {
  avancarPara,
  criarExecucao,
  encerrarExecucao,
  execucaoAguardandoDoContato,
  execucoesComEsperaVencida,
  registrarPasso,
  type ContextoExecucaoPersistido,
  type ExecucaoAtiva,
} from "./execucoes";
import { proximaAresta, rodarExecucao, saidaDaResposta, type FimDaRodada } from "./motor-estado";
import { versaoAtualPublicada, versaoPorId, type VersaoPublicada } from "./versoes";

/**
 * A porta de entrada do motor com estado: começar uma execução, continuar uma que esperava
 * resposta, e retomar as que esperavam o relógio.
 *
 * Enquanto a migração acontece, este caminho só vale pros fluxos com a chave `motorNovo` ligada.
 * Todo o resto continua no motor antigo, intocado — é a diferença entre "o novo motor está no ar"
 * e "os fluxos que já funcionavam pararam de funcionar".
 */

/** A chave por fluxo. Desligada (o normal, hoje) o fluxo segue no motor antigo. */
export function motorNovoAtivo(configuracoes: unknown): boolean {
  return (configuracoes as ConfiguracoesFluxo | null | undefined)?.motorNovo === true;
}

/** O bloco de gatilho e a primeira aresta que sai dele — onde a execução realmente começa. */
function primeiroNoDepoisDoGatilho(versao: VersaoPublicada): { gatilho: FlowNode; alvoId: string } | null {
  const gatilho = versao.nodes.find((n) => n.category === "gatilho");
  if (!gatilho) return null;
  const aresta = versao.edges.find((e) => e.source === gatilho.id);
  return aresta ? { gatilho, alvoId: aresta.target } : null;
}

/**
 * Começa uma execução a partir da VERSÃO PUBLICADA do fluxo.
 *
 * Devolve `null` quando não há o que rodar — fluxo nunca publicado, ou publicado sem nada ligado
 * no gatilho. Nesse caso quem chamou decide (hoje: deixa o motor antigo tentar).
 */
export async function iniciarFluxoComEstado(params: {
  workspaceId: string;
  fluxoId: string;
  gatilho: string;
  contatoNome: string;
  contatoId?: string | null;
  /** O que as condições do fluxo enxergam: campos do contato, canal, mensagem recebida. */
  contato: Record<string, unknown>;
  /** Só existe quando o disparo veio de um comentário do Instagram. */
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<FimDaRodada | null> {
  const versao = await versaoAtualPublicada(params.workspaceId, params.fluxoId);
  if (!versao) return null;

  const inicio = primeiroNoDepoisDoGatilho(versao);
  if (!inicio) return null;

  const execucao = await criarExecucao({
    workspaceId: params.workspaceId,
    fluxoId: params.fluxoId,
    versaoId: versao.id,
    contatoId: params.contatoId ?? null,
    contatoNome: params.contatoNome,
    gatilho: params.gatilho,
    noInicialId: inicio.alvoId,
    contexto: { contato: params.contato },
  });

  return rodarExecucao({
    execucao,
    nodes: versao.nodes,
    edges: versao.edges,
    acoes: acoesReais({ workspaceId: params.workspaceId, responderComentario: params.responderComentario }),
  });
}

/**
 * A resposta do contato continua a execução que esperava por ela.
 *
 * É o passo que faltava pro fluxo ter conversa: hoje toda mensagem recebida só consegue COMEÇAR
 * uma automação. Devolve `true` quando a mensagem foi consumida por uma execução em espera — e
 * nesse caso ela não deve também disparar fluxos novos, senão a pessoa responde "1" e recebe o
 * fluxo inteiro de novo por cima.
 */
export async function continuarComResposta(params: {
  workspaceId: string;
  contatoNome: string;
  texto: string;
  /** Id exato da opção, quando o canal informa (botão/lista do WhatsApp, resposta rápida do
   * Instagram). É melhor que casar por texto: dois botões podem começar igual, e o rótulo pode ter
   * sido cortado em 20 caracteres no envio. */
  idDaOpcao?: string;
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<boolean> {
  const execucao = await execucaoAguardandoDoContato({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    evento: "resposta",
  });
  if (!execucao) return false;

  const versao = await carregarVersao(execucao);
  if (!versao) {
    await encerrarExecucao({
      execucaoId: execucao.id,
      situacao: "erro",
      erroMensagem: "A versão publicada que esta execução usava não existe mais.",
    });
    return false;
  }

  const parado = execucao.aguardandoNoId ?? execucao.noAtualId;
  if (!parado) return false;
  const no = versao.nodes.find((n) => n.id === parado);
  if (!no) {
    await encerrarExecucao({
      execucaoId: execucao.id,
      situacao: "erro",
      erroMensagem: `O bloco "${parado}" não existe mais nesta versão do fluxo.`,
    });
    return false;
  }

  // A resposta entra no contexto: as condições seguintes ("mensagem contém…") leem daqui.
  const contexto: ContextoExecucaoPersistido = {
    ...execucao.contexto,
    contato: { ...((execucao.contexto.contato ?? {}) as Record<string, unknown>), mensagem: params.texto },
    ultimaResposta: params.texto,
  };

  let saida: string | undefined;
  if (no.type === "mensagem_botoes" || no.type === "mensagem_lista") {
    const dados = no.data as MensagemBotoesData;
    const porId = params.idDaOpcao && (dados.opcoes ?? []).some((o) => o.id === params.idDaOpcao) ? params.idDaOpcao : null;
    const escolhida = porId ?? saidaDaResposta(dados, params.texto);
    if (escolhida) {
      saida = escolhida;
    } else if (temSaida(versao.edges, no.id, "outra_resposta")) {
      saida = "outra_resposta";
    } else {
      // Nem opção nem caminho pra "qualquer outra resposta": continua esperando em vez de escolher
      // um ramo no chute. A mensagem ainda conta como consumida — quem estava no meio de uma
      // pergunta não deve disparar um fluxo novo por ter respondido errado.
      await registrarPasso({
        execucaoId: execucao.id,
        workspaceId: execucao.workspaceId,
        noId: no.id,
        noTipo: no.type,
        titulo: no.titulo,
        resultado: "aguardando",
        detalhe: `"${params.texto.slice(0, 80)}" não bate com nenhuma opção — continua esperando.`,
      });
      return true;
    }
  }

  await continuarDeDepoisDe({ execucao, versao, noId: no.id, saida, contexto, responderComentario: params.responderComentario });
  return true;
}

/**
 * Retoma as execuções cuja espera por tempo venceu. É o que o cron chama.
 *
 * Duas situações caem aqui, e a diferença está no `aguardandoNoId`: com valor, a execução parou
 * NUM bloco de espera que já rodou, então ela segue pela saída dele (usando "timeout" quando o
 * fluxo tem esse ramo); sem valor, ela só foi fatiada pelo teto de nós por rodada e o bloco atual
 * ainda precisa rodar.
 */
export async function retomarEsperasVencidas(limite = 50): Promise<{ retomadas: number; erros: number }> {
  const pendentes = await execucoesComEsperaVencida(limite);
  let retomadas = 0;
  let erros = 0;

  for (const execucao of pendentes) {
    try {
      const versao = await carregarVersao(execucao);
      if (!versao) {
        await encerrarExecucao({
          execucaoId: execucao.id,
          situacao: "erro",
          erroMensagem: "A versão publicada que esta execução usava não existe mais.",
        });
        erros++;
        continue;
      }

      if (!execucao.aguardandoNoId) {
        // Continuação de uma rodada fatiada: o bloco atual ainda não rodou.
        if (!execucao.noAtualId) {
          await encerrarExecucao({ execucaoId: execucao.id, situacao: "concluida" });
          continue;
        }
        await rodarExecucao({
          execucao,
          nodes: versao.nodes,
          edges: versao.edges,
          acoes: acoesDaExecucao(execucao),
        });
        retomadas++;
        continue;
      }

      const saida = temSaida(versao.edges, execucao.aguardandoNoId, "timeout") ? "timeout" : undefined;
      await continuarDeDepoisDe({ execucao, versao, noId: execucao.aguardandoNoId, saida, contexto: execucao.contexto });
      retomadas++;
    } catch (erro) {
      console.error("[automacao] falha ao retomar execução", execucao.id, erro instanceof Error ? erro.message : erro);
      erros++;
    }
  }

  return { retomadas, erros };
}

/** Sai do bloco parado pela saída indicada e roda dali em diante. Sem saída, a execução terminou. */
async function continuarDeDepoisDe(params: {
  execucao: ExecucaoAtiva;
  versao: VersaoPublicada;
  noId: string;
  saida?: string;
  contexto: ContextoExecucaoPersistido;
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<FimDaRodada> {
  const { execucao, versao, contexto } = params;
  const proximo = proximaAresta(versao.edges, params.noId, params.saida);
  if (!proximo) {
    await encerrarExecucao({ execucaoId: execucao.id, situacao: "concluida" });
    return { situacao: "concluida", passos: 0 };
  }

  await avancarPara(execucao.id, proximo.target, contexto);
  return rodarExecucao({
    execucao: { ...execucao, noAtualId: proximo.target, contexto, aguardandoNoId: null, aguardandoEvento: null, aguardandoAte: null },
    nodes: versao.nodes,
    edges: versao.edges,
    acoes: acoesReais({ workspaceId: execucao.workspaceId, responderComentario: params.responderComentario }),
  });
}

function acoesDaExecucao(execucao: ExecucaoAtiva): AcoesDoMotor {
  // Retomada pelo cron não tem comentário de origem — responder a um comentário só é possível na
  // mesma chamada que o recebeu.
  return acoesReais({ workspaceId: execucao.workspaceId });
}

/**
 * A versão que a execução carrega. Prende na versão em que ela COMEÇOU: republicar o fluxo no meio
 * do caminho não pode mudar o roteiro de quem já está andando por ele.
 */
async function carregarVersao(execucao: ExecucaoAtiva): Promise<VersaoPublicada | null> {
  if (execucao.versaoId) return versaoPorId(execucao.workspaceId, execucao.versaoId);
  return versaoAtualPublicada(execucao.workspaceId, execucao.fluxoId);
}

function temSaida(edges: FlowEdge[], noId: string, handle: string): boolean {
  return edges.some((e) => e.source === noId && e.sourceHandle === handle);
}

/** Conta uma execução no contador que a lista de automações mostra. Falhar aqui não derruba nada. */
export async function contarExecucao(fluxoId: string): Promise<void> {
  await prisma.fluxoAutomacao.update({ where: { id: fluxoId }, data: { execucoes: { increment: 1 } } }).catch(() => {});
}
