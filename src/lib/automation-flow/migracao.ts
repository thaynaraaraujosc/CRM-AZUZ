/**
 * Migração do formato antigo (linear, `Automacao`/`RegraComentario` em
 * automacoes-context.tsx) pro formato novo em grafo (`FluxoAutomacao`).
 *
 * As duas funções aqui só devem ser chamadas UMA VEZ, de forma preguiçosa (lazy),
 * no `useState(() => ...)` inicial de `automation-flow-context.tsx` — é assim que
 * a gente garante que nenhuma automação existente se perde quando o construtor
 * visual substitui o editor antigo.
 */

import type { Automacao, AcaoAutomacao, RegraComentario } from "@/lib/automacoes-context";
import type { Funil } from "@/lib/data";
import type {
  AguardarData,
  AlterarEtapaData,
  ComentarioEventoData,
  CondicaoGrupoData,
  ConfiguracoesFluxo,
  EnviarFormularioData,
  FlowEdge,
  FlowNode,
  FlowNodeType,
  FluxoAutomacao,
  GatilhoEtapaData,
  MensagemBotoesData,
  MensagemTextoData,
  OpcaoBotaoLista,
  RegraCondicao,
  VersaoFluxo,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

function unidadeTempo(u?: string): "minutos" | "horas" | "dias" {
  if (u === "minutos" || u === "dias") return u;
  return "horas";
}

function numeroDe(v?: string): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function execucoesParaNumero(execucoes: string): number {
  const match = execucoes.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

/** Contador de nó por chamada de migração — mantém os ids curtos e previsíveis. */
function criarFabricaDeIds(prefixo: string) {
  let n = 0;
  return () => `${prefixo}-n${n++}`;
}

/**
 * Layout em camadas — bem simples e determinístico (BFS a partir das raízes):
 * profundidade (nº de arestas até a raiz) vira posição Y, índice do nó dentro
 * da mesma profundidade vira posição X. Suficiente pro construtor visual
 * desenhar algo legível sem precisar do `dagre` de fato.
 */
export function layoutFluxo(nodes: FlowNode[], edges: FlowEdge[]): void {
  const entradas = new Map<string, number>();
  nodes.forEach((n) => entradas.set(n.id, 0));
  edges.forEach((e) => entradas.set(e.target, (entradas.get(e.target) ?? 0) + 1));

  const adjacencia = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adjacencia.has(e.source)) adjacencia.set(e.source, []);
    adjacencia.get(e.source)!.push(e.target);
  });

  const profundidade = new Map<string, number>();
  const raizes = nodes.filter((n) => (entradas.get(n.id) ?? 0) === 0).map((n) => n.id);
  const fila: string[] = [...raizes];
  raizes.forEach((r) => profundidade.set(r, 0));

  while (fila.length) {
    const atualId = fila.shift()!;
    const d = profundidade.get(atualId) ?? 0;
    for (const proximoId of adjacencia.get(atualId) ?? []) {
      const dAtual = profundidade.get(proximoId);
      if (dAtual === undefined || dAtual < d + 1) {
        profundidade.set(proximoId, d + 1);
        fila.push(proximoId);
      }
    }
  }

  const porNivel = new Map<number, string[]>();
  nodes.forEach((n) => {
    const d = profundidade.get(n.id) ?? 0;
    if (!porNivel.has(d)) porNivel.set(d, []);
    porNivel.get(d)!.push(n.id);
  });

  const VERTICAL = 180;
  const HORIZONTAL = 260;
  nodes.forEach((n) => {
    const d = profundidade.get(n.id) ?? 0;
    const nivel = porNivel.get(d) ?? [n.id];
    const idx = nivel.indexOf(n.id);
    n.position = { x: idx * HORIZONTAL, y: d * VERTICAL };
  });
}

function novoNo<T>(
  proximoId: () => string,
  type: FlowNodeType,
  category: FlowNode["category"],
  data: T,
  titulo?: string,
): FlowNode<T> {
  return { id: proximoId(), type, category, position: { x: 0, y: 0 }, titulo, data };
}

function novaAresta(source: string, target: string, sourceHandle?: string, label?: string): FlowEdge {
  return {
    id: `${source}->${target}${sourceHandle ? `:${sourceHandle}` : ""}`,
    source,
    target,
    sourceHandle,
    label,
  };
}

/* -------------------------------------------------------------------------- */
/* migrarAutomacaoParaFluxo                                                  */
/* -------------------------------------------------------------------------- */

const MAPA_GATILHO_ETAPA: Record<Automacao["gatilhoTipo"], FlowNodeType> = {
  entrou: "lead_entrou_etapa",
  saiu: "lead_saiu_etapa",
  parado: "lead_parado_etapa",
  respondeu: "lead_respondeu",
  agendado: "horario_programado",
};

type EstadoMigracao = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  proximoId: () => string;
};

/** Cria (se precisar) o nó `aguardar` de atraso de uma ação e devolve o novo id "aberto" pra conectar em seguida. */
function conectarComAtraso(
  estado: EstadoMigracao,
  origens: { id: string; handle?: string }[],
  acao: AcaoAutomacao,
): string[] {
  if (!acao.atrasoValor) return origens.map((o) => o.id);

  const aguardarData: AguardarData = {
    modo: unidadeTempo(acao.atrasoUnidade),
    valor: numeroDe(acao.atrasoValor) ?? 0,
  };
  const noAguardar = novoNo(estado.proximoId, "aguardar", "espera", aguardarData);
  estado.nodes.push(noAguardar);
  origens.forEach((o) => estado.edges.push(novaAresta(o.id, noAguardar.id, o.handle)));
  return [noAguardar.id];
}

function criarNoDaAcao(estado: EstadoMigracao, acao: AcaoAutomacao): FlowNode {
  switch (acao.tipo) {
    case "mensagem": {
      const data: MensagemTextoData = { canal: "whatsapp", texto: acao.mensagem ?? "" };
      return novoNo(estado.proximoId, "mensagem_texto", "mensagem", data);
    }
    case "enviar_formulario": {
      const data: EnviarFormularioData = {
        formularioOrigem: acao.formularioOrigem,
        formularioId: acao.formularioId,
        formularioUrlExterna: acao.formularioUrlExterna,
        mensagem: acao.mensagem,
      };
      return novoNo(estado.proximoId, "enviar_formulario", "mensagem", data);
    }
    case "lembrete": {
      return novoNo(estado.proximoId, "criar_lembrete", "acao", {
        titulo: acao.mensagem ?? "",
        tempoValor: numeroDe(acao.tempoValor),
        tempoUnidade: acao.tempoUnidade,
      });
    }
    case "tarefa": {
      return novoNo(estado.proximoId, "criar_tarefa", "acao", {
        titulo: acao.mensagem ?? "",
        prazoValor: numeroDe(acao.tempoValor),
        prazoUnidade: acao.tempoUnidade,
      });
    }
    case "mover_funil": {
      const data: AlterarEtapaData = {
        funilId: acao.moverFunilId ?? "",
        etapaTitulo: acao.moverEtapaTitulo ?? "",
      };
      return novoNo(estado.proximoId, "alterar_etapa", "acao", data);
    }
    case "atribuir_responsavel": {
      return novoNo(estado.proximoId, "alterar_responsavel", "acao", {
        atendenteNome: acao.atendenteNome ?? "",
      });
    }
    case "adicionar_etiqueta": {
      return novoNo(estado.proximoId, "adicionar_etiqueta", "acao", {
        etiquetaNome: acao.etiquetaNome ?? "",
      });
    }
    case "remover_etiqueta": {
      return novoNo(estado.proximoId, "remover_etiqueta", "acao", {
        etiquetaNome: acao.etiquetaNome ?? "",
      });
    }
    case "webhook": {
      return novoNo(estado.proximoId, "chamar_webhook", "acao", { url: acao.webhookUrl ?? "" });
    }
    case "documento": {
      return novoNo(estado.proximoId, "mensagem_documento", "mensagem", {
        canal: "whatsapp",
        arquivoNome: acao.arquivoNome,
        legenda: acao.mensagem,
      });
    }
    case "audio": {
      return novoNo(estado.proximoId, "mensagem_audio", "mensagem", {
        canal: "whatsapp",
        arquivoNome: acao.arquivoNome,
      });
    }
    default: {
      // "mensagem_interativa" é tratada à parte em `encadearAcoes` — nunca deveria
      // cair aqui, mas o tipo `AcaoAutomacao.tipo` não é discriminado, então o
      // TypeScript não consegue provar isso sozinho.
      const data: MensagemTextoData = { canal: "whatsapp", texto: acao.mensagem ?? "" };
      return novoNo(estado.proximoId, "mensagem_texto", "mensagem", data);
    }
  }
}

/**
 * Encadeia uma lista de ações (formato antigo) a partir de uma lista de "pontas
 * abertas" (nó + handle opcional), retornando as novas pontas abertas ao final
 * — pode ser mais de uma ponta quando a lista contém uma `mensagem_interativa`
 * (cada opção de resposta vira um ramo).
 */
function encadearAcoes(
  estado: EstadoMigracao,
  acoes: AcaoAutomacao[],
  pontasIniciais: { id: string; handle?: string }[],
): { id: string; handle?: string }[] {
  let pontas = pontasIniciais;

  for (const acao of acoes) {
    if (acao.tipo === "mensagem_interativa") {
      const opcoesData: OpcaoBotaoLista[] = (acao.opcoes ?? []).map((o) => ({
        id: o.id,
        rotulo: o.rotulo,
      }));
      const msgData: MensagemBotoesData = {
        canal: "whatsapp",
        texto: acao.mensagem ?? "",
        opcoes: opcoesData,
      };
      const noMsg = novoNo(estado.proximoId, "mensagem_botoes", "mensagem", msgData);
      estado.nodes.push(noMsg);
      pontas.forEach((p) => estado.edges.push(novaAresta(p.id, noMsg.id, p.handle)));

      const novasPontas: { id: string; handle?: string }[] = [];
      for (const opcao of acao.opcoes ?? []) {
        const pontasRamo = encadearAcoes(estado, opcao.acoesSeEscolhida ?? [], [
          { id: noMsg.id, handle: opcao.id },
        ]);
        novasPontas.push(...pontasRamo);
      }

      // Comportamento novo (não existia no formato antigo): toda mensagem interativa
      // agora também precisa de um caminho explícito pra "respondeu outra coisa" e
      // "não respondeu" — o formato antigo nunca capturou isso, então encerramos os
      // dois direto num nó de fim, sem inventar uma ação que os dados antigos não tinham.
      const noFimNaoTratado = novoNo(estado.proximoId, "encerrar_fluxo", "fim", {
        motivo: "Resposta fora das opções previstas (gerado na migração)",
      });
      estado.nodes.push(noFimNaoTratado);
      estado.edges.push(novaAresta(noMsg.id, noFimNaoTratado.id, "outra_resposta"));
      estado.edges.push(novaAresta(noMsg.id, noFimNaoTratado.id, "nao_respondeu"));

      pontas = novasPontas;
      continue;
    }

    const noAcao = criarNoDaAcao(estado, acao);
    estado.nodes.push(noAcao);
    const pontasComAtraso = conectarComAtraso(estado, pontas, acao);
    pontasComAtraso.forEach((id) => estado.edges.push(novaAresta(id, noAcao.id)));
    pontas = [{ id: noAcao.id }];
  }

  return pontas;
}

function construirGrupoCondicoes(automacao: Automacao, proximoId: () => string): RegraCondicao[] {
  const regras: RegraCondicao[] = [];
  if (automacao.condicaoOrigem) {
    regras.push({ id: proximoId(), campo: "origem", operador: "igual", valor: automacao.condicaoOrigem });
  }
  if (automacao.condicaoValorMinimo) {
    regras.push({
      id: proximoId(),
      campo: "valor_negocio",
      operador: "maior_que",
      valor: automacao.condicaoValorMinimo,
    });
  }
  if (automacao.condicaoSemResposta) {
    regras.push({ id: proximoId(), campo: "respondeu", operador: "igual", valor: "nao" });
  }
  return regras;
}

function configuracoesDaAutomacao(automacao: Automacao): ConfiguracoesFluxo {
  return {
    diasAtivos: automacao.diasAtivos,
    usarHorario: automacao.usarHorario,
    horarioInicio: automacao.horarioInicio,
    horarioFim: automacao.horarioFim,
    foraDaJanela: automacao.foraDaJanela,
    limiteExecucao: automacao.limiteExecucao === "uma_vez" ? "uma_vez_por_contato" : "sempre",
  };
}

export function migrarAutomacaoParaFluxo(automacao: Automacao, funis: Funil[]): FluxoAutomacao {
  const proximoId = criarFabricaDeIds(automacao.id);
  const estado: EstadoMigracao = { nodes: [], edges: [], proximoId };

  const funil = funis.find((f) => f.id === automacao.funilId);
  const etapaTitulo = funil?.colunas.find((c) => c.id === automacao.etapaId)?.titulo;

  const gatilhoData: GatilhoEtapaData = {
    funilId: automacao.funilId,
    etapaId: automacao.etapaId,
    tempoValor: numeroDe(automacao.tempoValor),
    tempoUnidade: automacao.tempoUnidade ? unidadeTempo(automacao.tempoUnidade) : undefined,
    disparoImediato: automacao.disparoImediato,
  };
  const noGatilho = novoNo(
    proximoId,
    MAPA_GATILHO_ETAPA[automacao.gatilhoTipo],
    "gatilho",
    gatilhoData,
    etapaTitulo ? `Etapa: ${etapaTitulo}` : undefined,
  );
  estado.nodes.push(noGatilho);

  let pontas: { id: string; handle?: string }[] = [{ id: noGatilho.id }];

  const regrasCondicao = construirGrupoCondicoes(automacao, proximoId);
  if (regrasCondicao.length > 0) {
    const condicaoData: CondicaoGrupoData = {
      grupo: { id: proximoId(), tipo: "E", regras: regrasCondicao, subgrupos: [] },
    };
    const noCondicao = novoNo(proximoId, "condicao_grupo", "condicao", condicaoData);
    estado.nodes.push(noCondicao);
    pontas.forEach((p) => estado.edges.push(novaAresta(p.id, noCondicao.id, p.handle)));
    // Só o caminho "sim" segue adiante — o formato antigo nunca definia o que fazer
    // quando a condição falha, então o "não" fica sem ramo (nenhuma ação lá).
    pontas = [{ id: noCondicao.id, handle: "sim" }];
  }

  const pontasFinais = encadearAcoes(estado, automacao.acoes, pontas);

  // Toda ponta que sobrou sem nó de fim vira um `encerrar_fluxo`, pra validação
  // não acusar caminho pendurado.
  pontasFinais.forEach((ponta) => {
    const noFim = novoNo(proximoId, "encerrar_fluxo", "fim", {});
    estado.nodes.push(noFim);
    estado.edges.push(novaAresta(ponta.id, noFim.id, ponta.handle));
  });

  layoutFluxo(estado.nodes, estado.edges);

  const agora = new Date().toISOString();
  const configuracoes = configuracoesDaAutomacao(automacao);
  const versaoInicial: VersaoFluxo = {
    versao: 1,
    nodes: estado.nodes,
    edges: estado.edges,
    configuracoes,
    publicadoEm: agora,
    publicadoPor: "Migração automática",
  };

  return {
    id: automacao.id,
    nome: automacao.titulo,
    funilId: automacao.funilId,
    etapaId: automacao.etapaId,
    status: "publicado",
    ativa: automacao.ativa,
    nodes: estado.nodes,
    edges: estado.edges,
    versaoAtual: 1,
    publicadoEm: agora,
    publicadoPor: "Migração automática",
    criadoEm: agora,
    atualizadoEm: agora,
    configuracoes,
    execucoes: execucoesParaNumero(automacao.execucoes),
    historicoVersoes: [versaoInicial],
  };
}

/* -------------------------------------------------------------------------- */
/* migrarRegraComentarioParaFluxo                                            */
/* -------------------------------------------------------------------------- */

export function migrarRegraComentarioParaFluxo(regra: RegraComentario): FluxoAutomacao {
  const proximoId = criarFabricaDeIds(regra.id);
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const tipoGatilho: FlowNodeType = regra.canal === "Instagram" ? "comentario_instagram" : "comentario_tiktok";
  const gatilhoData: ComentarioEventoData = { canal: regra.canal, palavraChave: regra.palavraChave };
  const noGatilho = novoNo(proximoId, tipoGatilho, "gatilho", gatilhoData);
  nodes.push(noGatilho);

  const condicaoData: CondicaoGrupoData = {
    grupo: {
      id: proximoId(),
      tipo: "E",
      regras: [{ id: proximoId(), campo: "palavra_chave", operador: "igual", valor: regra.palavraChave }],
      subgrupos: [],
    },
  };
  const noCondicao = novoNo(proximoId, "condicao_grupo", "condicao", condicaoData);
  nodes.push(noCondicao);
  edges.push(novaAresta(noGatilho.id, noCondicao.id));

  const msgData: MensagemTextoData = { canal: "instagram", texto: regra.mensagemDirect };
  const noMsg = novoNo(proximoId, "mensagem_texto", "mensagem", msgData);
  nodes.push(noMsg);
  edges.push(novaAresta(noCondicao.id, noMsg.id, "sim"));

  const noFim = novoNo(proximoId, "encerrar_fluxo", "fim", {});
  nodes.push(noFim);
  edges.push(novaAresta(noMsg.id, noFim.id));

  layoutFluxo(nodes, edges);

  const agora = new Date().toISOString();
  const configuracoes: ConfiguracoesFluxo = { limiteExecucao: "sempre" };
  const versaoInicial: VersaoFluxo = {
    versao: 1,
    nodes,
    edges,
    configuracoes,
    publicadoEm: agora,
    publicadoPor: "Migração automática",
  };

  return {
    id: regra.id,
    nome: `Comentário ${regra.canal} — "${regra.palavraChave}"`,
    categoria: "comentario",
    status: "publicado",
    ativa: regra.ativa,
    nodes,
    edges,
    versaoAtual: 1,
    publicadoEm: agora,
    publicadoPor: "Migração automática",
    criadoEm: agora,
    atualizadoEm: agora,
    configuracoes,
    execucoes: execucoesParaNumero(regra.execucoes),
    historicoVersoes: [versaoInicial],
  };
}
