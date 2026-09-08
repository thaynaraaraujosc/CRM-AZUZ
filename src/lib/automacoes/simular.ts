import type { FlowEdge, FlowNode, MensagemBotoesData } from "@/lib/automation-flow/types";

import { acoesSecas } from "./acoes";
import type { ContextoExecucaoPersistido, ExecucaoAtiva, GravadorDeExecucao } from "./execucoes";
import { proximaAresta, rodarExecucao, saidaDaResposta } from "./motor-estado";

/**
 * O botão "Testar", rodando o MOTOR DE VERDADE.
 *
 * O simulador antigo era código escrito à parte: percorria o fluxo com a própria lógica dele. Isso
 * significa que ele podia dizer "vai funcionar" sobre algo que na prática não funcionava — o pior
 * defeito possível num simulador, porque a pessoa confia nele justamente pra não errar com cliente
 * de verdade.
 *
 * Aqui é o mesmo motor, com as mesmas decisões. Só duas coisas mudam:
 *
 * - as **ações** são secas (`acoesSecas`): nada é enviado, nada é gravado no contato ou no funil;
 * - o **gravador** é de memória: nenhuma linha de execução entra no banco.
 *
 * O estado da simulação vai e volta na resposta, então a tela consegue continuar de onde parou
 * (escolher uma opção, adiantar o relógio) sem nada persistido no meio.
 */
export type PassoSimulado = {
  noId: string;
  noTipo: string;
  titulo: string | null;
  resultado: string;
  detalhe: string | null;
};

export type EstadoSimulacao = {
  execucao: ExecucaoAtiva;
  passos: PassoSimulado[];
  intencoes: string[];
  /** O bloco onde parou, quando parou esperando algo — é o que a tela usa pra oferecer as opções. */
  esperando: { noId: string; tipo: string; opcoes: { id: string; rotulo: string }[]; evento: string | null } | null;
  situacao: string;
  erro?: string;
};

function gravadorNaMemoria(execucao: ExecucaoAtiva, passos: PassoSimulado[]): GravadorDeExecucao {
  return {
    async avancarPara(_id, noId, contexto) {
      execucao.noAtualId = noId;
      execucao.contexto = contexto;
      execucao.situacao = "em_andamento";
      execucao.aguardandoNoId = null;
      execucao.aguardandoEvento = null;
      execucao.aguardandoAte = null;
    },
    async aguardarTempo({ noId, ate, evento, contexto }) {
      Object.assign(execucao, {
        situacao: "aguardando_tempo",
        noAtualId: noId,
        aguardandoNoId: noId,
        aguardandoAte: ate,
        aguardandoEvento: evento ?? null,
        contexto,
      });
    },
    async aguardarEvento({ noId, evento, ate, contexto }) {
      Object.assign(execucao, {
        situacao: ate ? "aguardando_tempo" : "aguardando_evento",
        noAtualId: noId,
        aguardandoNoId: noId,
        aguardandoEvento: evento,
        aguardandoAte: ate ?? null,
        contexto,
      });
    },
    async reagendarRodada({ noId, contexto }) {
      // Na simulação não existe "próxima rodada do cron": segue direto, senão a pessoa clicaria em
      // "continuar" sem entender por quê.
      Object.assign(execucao, { situacao: "em_andamento", noAtualId: noId, aguardandoNoId: null, contexto });
    },
    async encerrarExecucao({ situacao, erroMensagem }) {
      Object.assign(execucao, { situacao, noAtualId: null, aguardandoNoId: null, aguardandoEvento: null, aguardandoAte: null });
      if (erroMensagem) execucao.contexto = { ...execucao.contexto, erro: erroMensagem };
    },
    async registrarPasso({ noId, noTipo, titulo, resultado, detalhe }) {
      passos.push({ noId, noTipo, titulo: titulo ?? null, resultado, detalhe: detalhe ?? null });
    },
  };
}

/** Começa a simulação no primeiro bloco depois do gatilho. */
export async function simularInicio(params: {
  workspaceId: string;
  fluxoId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  contato: Record<string, unknown>;
}): Promise<EstadoSimulacao> {
  const gatilho = params.nodes.find((n) => n.category === "gatilho");
  if (!gatilho) throw new Error("Esse fluxo não tem um bloco de gatilho — nada pra simular.");
  const aresta = params.edges.find((e) => e.source === gatilho.id);
  if (!aresta) throw new Error("O gatilho desse fluxo ainda não está conectado a nada.");

  const execucao: ExecucaoAtiva = {
    id: "simulacao",
    workspaceId: params.workspaceId,
    fluxoId: params.fluxoId,
    versaoId: null,
    contatoId: null,
    contatoNome: String(params.contato.nome ?? "Contato de teste"),
    gatilho: gatilho.type,
    situacao: "em_andamento",
    noAtualId: aresta.target,
    contexto: { contato: params.contato },
    aguardandoEvento: null,
    aguardandoNoId: null,
    aguardandoAte: null,
  };

  return rodar({ execucao, nodes: params.nodes, edges: params.edges, passos: [], intencoes: [] });
}

/**
 * Continua a simulação de onde ela parou.
 *
 * `resposta` é o que a pessoa "respondeu" num bloco de opções; `saida` força um caminho (é o que a
 * tela usa em "adiantar o relógio" e "seguir pelo timeout"). Sem nenhum dos dois, segue pela saída
 * única do bloco.
 */
export async function simularContinuacao(params: {
  estado: EstadoSimulacao;
  nodes: FlowNode[];
  edges: FlowEdge[];
  resposta?: string;
  saida?: string;
}): Promise<EstadoSimulacao> {
  const execucao = { ...params.estado.execucao };
  const parado = execucao.aguardandoNoId ?? execucao.noAtualId;
  if (!parado) return params.estado;

  const no = params.nodes.find((n) => n.id === parado);
  if (!no) throw new Error(`O bloco "${parado}" não existe mais nesse fluxo.`);

  let saida = params.saida;
  const passos = [...params.estado.passos];

  if (params.resposta !== undefined && (no.type === "mensagem_botoes" || no.type === "mensagem_lista")) {
    const escolhida = saidaDaResposta(no.data as MensagemBotoesData, params.resposta);
    if (escolhida) {
      saida = escolhida;
    } else if (params.edges.some((e) => e.source === no.id && e.sourceHandle === "outra_resposta")) {
      saida = "outra_resposta";
    } else {
      passos.push({
        noId: no.id,
        noTipo: no.type,
        titulo: no.titulo ?? null,
        resultado: "aguardando",
        detalhe: `"${params.resposta}" não bate com nenhuma opção — no fluxo de verdade, continuaria esperando.`,
      });
      return { ...params.estado, passos };
    }
  }

  const contexto: ContextoExecucaoPersistido =
    params.resposta === undefined
      ? execucao.contexto
      : {
          ...execucao.contexto,
          contato: { ...((execucao.contexto.contato ?? {}) as Record<string, unknown>), mensagem: params.resposta },
          ultimaResposta: params.resposta,
        };

  const proximo = proximaAresta(params.edges, no.id, saida);
  if (!proximo) {
    return {
      ...params.estado,
      passos,
      execucao: { ...execucao, situacao: "concluida", noAtualId: null, aguardandoNoId: null },
      esperando: null,
      situacao: "concluida",
    };
  }

  return rodar({
    execucao: { ...execucao, noAtualId: proximo.target, contexto, aguardandoNoId: null, aguardandoEvento: null, aguardandoAte: null },
    nodes: params.nodes,
    edges: params.edges,
    passos,
    intencoes: [...params.estado.intencoes],
  });
}

async function rodar(params: {
  execucao: ExecucaoAtiva;
  nodes: FlowNode[];
  edges: FlowEdge[];
  passos: PassoSimulado[];
  intencoes: string[];
}): Promise<EstadoSimulacao> {
  const execucao = { ...params.execucao };
  const passos = [...params.passos];
  const acoes = acoesSecas();

  const fim = await rodarExecucao({
    execucao,
    nodes: params.nodes,
    edges: params.edges,
    acoes,
    gravador: gravadorNaMemoria(execucao, passos),
  });

  const paradoId = execucao.aguardandoNoId;
  const noParado = paradoId ? params.nodes.find((n) => n.id === paradoId) : undefined;
  const opcoes =
    noParado && (noParado.type === "mensagem_botoes" || noParado.type === "mensagem_lista")
      ? ((noParado.data as MensagemBotoesData).opcoes ?? []).map((o) => ({ id: o.id, rotulo: o.rotulo }))
      : [];

  return {
    execucao,
    passos,
    intencoes: [...params.intencoes, ...acoes.intencoes],
    esperando: noParado
      ? { noId: noParado.id, tipo: noParado.type, opcoes, evento: execucao.aguardandoEvento }
      : null,
    situacao: fim.situacao,
    erro: fim.situacao === "erro" ? fim.detalhe : undefined,
  };
}
