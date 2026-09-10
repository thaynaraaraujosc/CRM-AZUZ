/**
 * Avaliação pura: o gatilho casa com este evento? A condição é verdadeira pra este contato?
 *
 * Nada aqui executa nada. Não manda mensagem, não move card, não grava no banco. Quem EXECUTA é
 * `automacoes/motor-estado.ts`, e ele é o único.
 *
 * Este arquivo era o "motor" antigo: um segundo executor, síncrono e sem memória, que não sabia
 * esperar por resposta e mantinha a própria lista de blocos, sempre um pouco diferente da do
 * motor de verdade. A parte de execução foi removida; o que sobrou é o que sempre foi puro e é
 * usado pelos dois lados (o disparo por evento e o gatilho de etapa).
 */

import type {
  CondicaoGrupoData,
  FlowEdge,
  FlowNode,
  FlowNodeType,
  FluxoAutomacao,
  GrupoCondicoes,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Contrato de execução                                                      */
/* -------------------------------------------------------------------------- */

/**
 * O que a avaliação enxerga do contato. Só leitura: avaliar não muda nada.
 *
 * Os campos nomeados são os que as condições usam direto; o resto entra pelo índice, porque campo
 * personalizado é criado pelo cliente e não dá pra listar aqui.
 */
export type ContextoExecucao = {
  contato: {
    nome: string;
    etiquetas: string[];
    origem?: string;
    responsavel?: string;
    camposPersonalizados?: Record<string, string>;
    funilId?: string;
    etapaTitulo?: string;
    ultimaRespostaEm?: string;
    [k: string]: unknown;
  };
  /** Timestamp ISO que substitui `new Date()`. Usado pelo simulador ao "avançar o relógio". */
  agora?: string;
};





/* -------------------------------------------------------------------------- */
/* Utilidades internas                                                       */
/* -------------------------------------------------------------------------- */



function saidasDoNo(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

/** Lê um "campo" de condição a partir do contato do contexto. Melhor esforço, nem todo campo tem um valor real disponível na simulação. */
function valorDoCampo(campo: string, contato: ContextoExecucao["contato"]): string | undefined {
  switch (campo) {
    case "origem":
      return contato.origem;
    case "etapa":
      return contato.etapaTitulo;
    case "funil":
      return contato.funilId;
    case "etiqueta":
      return contato.etiquetas?.join(",");
    case "responsavel":
    case "equipe":
      return contato.responsavel;
    case "respondeu":
      return contato.ultimaRespostaEm ? "sim" : "nao";
    default: {
      const direto = contato[campo];
      if (typeof direto === "string") return direto;
      return contato.camposPersonalizados?.[campo];
    }
  }
}

function avaliarRegra(regra: GrupoCondicoes["regras"][number], contato: ContextoExecucao["contato"]): boolean {
  const valorCampo =
    regra.campo === "campo_personalizado"
      ? contato.camposPersonalizados?.[regra.campoPersonalizadoNome ?? ""]
      : valorDoCampo(regra.campo, contato);

  switch (regra.operador) {
    case "existe":
      return valorCampo !== undefined && valorCampo !== "";
    case "nao_existe":
      return valorCampo === undefined || valorCampo === "";
    case "igual":
      return (valorCampo ?? "").toLowerCase() === (regra.valor ?? "").toLowerCase();
    case "diferente":
      return (valorCampo ?? "").toLowerCase() !== (regra.valor ?? "").toLowerCase();
    case "contem":
      return (valorCampo ?? "").toLowerCase().includes((regra.valor ?? "").toLowerCase());
    case "nao_contem":
      return !(valorCampo ?? "").toLowerCase().includes((regra.valor ?? "").toLowerCase());
    case "maior_que":
      return Number(valorCampo ?? 0) > Number(regra.valor ?? 0);
    case "menor_que":
      return Number(valorCampo ?? 0) < Number(regra.valor ?? 0);
    case "entre":
      return (
        Number(valorCampo ?? 0) >= Number(regra.valor ?? 0) &&
        Number(valorCampo ?? 0) <= Number(regra.valorFim ?? 0)
      );
    default:
      return true;
  }
}

export function avaliarGrupoCondicoes(grupo: GrupoCondicoes, contato: ContextoExecucao["contato"]): boolean {
  const resultadosRegras = grupo.regras.map((r) => avaliarRegra(r, contato));
  const resultadosSubgrupos = grupo.subgrupos.map((g) => avaliarGrupoCondicoes(g, contato));
  const todos = [...resultadosRegras, ...resultadosSubgrupos];

  if (grupo.tipo === "E") return todos.every(Boolean);
  if (grupo.tipo === "OU") return todos.some(Boolean);
  // "NAO" nega o resultado combinado (tratado aqui como E dos itens, negado).
  return !todos.every(Boolean);
}

/* -------------------------------------------------------------------------- */
/* avaliarGatilho                                                            */
/* -------------------------------------------------------------------------- */

function dentroDaJanela(fluxo: FluxoAutomacao, agora: Date): boolean {
  // `?? {}` e não `fluxo.configuracoes` direto: o tipo diz que o campo existe sempre, mas o que
  // chega aqui vem do banco por um cast, e um fluxo gravado antes desta coluna traz nulo. Sem isto
  // a leitura estoura e derruba a avaliação de TODOS os fluxos daquele disparo, não só o quebrado.
  const cfg = fluxo.configuracoes ?? ({} as typeof fluxo.configuracoes);
  if (cfg.diasAtivos && cfg.diasAtivos.length > 0) {
    const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
    const diaAtual = dias[agora.getDay()];
    if (!cfg.diasAtivos.includes(diaAtual)) return cfg.foraDaJanela === "aguardar";
  }
  if (cfg.usarHorario && cfg.horarioInicio && cfg.horarioFim) {
    const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    if (hhmm < cfg.horarioInicio || hhmm > cfg.horarioFim) {
      return cfg.foraDaJanela === "aguardar";
    }
  }
  return true;
}

export type EventoAutomacao = {
  tipo: FlowNodeType;
  funilId?: string;
  etapaId?: string;
  contatoNome?: string;
  [k: string]: unknown;
};

/** Tira acentos e caixa, pra "GUIA", "guia" e "guía" contarem como a mesma palavra. */
function normalizar(texto: string, ignorarAcentos: boolean): string {
  const minusculo = texto.toLowerCase().trim();
  return ignorarAcentos ? minusculo.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : minusculo;
}

export type ConfiguracaoDePalavras = {
  /** Lista configurada. `palavraChave` (campo antigo, uma só) continua valendo. */
  palavras?: string[];
  palavraChave?: string;
  /** "contem" (padrão), "exata" ou "qualquer": qualquer uma das palavras, como palavra inteira. */
  modoPalavra?: "contem" | "exata" | "qualquer";
  ignorarAcentos?: boolean;
};

/**
 * Se o texto recebido casa com as palavras configuradas no gatilho.
 *
 * Sem palavra configurada, casa com tudo: é o comportamento de "qualquer comentário dispara", que
 * é o que a pessoa espera ao deixar o campo vazio.
 *
 * "qualquer" compara PALAVRA INTEIRA de propósito: com "contém", uma automação de "quero" também
 * dispararia em "não quero", que é o oposto da intenção de quem montou o fluxo.
 */
export function textoCasaComPalavras(texto: string, config: ConfiguracaoDePalavras): boolean {
  const lista = (config.palavras ?? [])
    .concat(config.palavraChave ? [config.palavraChave] : [])
    .map((p) => p.trim())
    .filter(Boolean);
  if (!lista.length) return true;

  const ignorarAcentos = config.ignorarAcentos ?? true;
  const alvo = normalizar(texto, ignorarAcentos);
  const modo = config.modoPalavra ?? "contem";

  return lista.some((palavra) => {
    const p = normalizar(palavra, ignorarAcentos);
    if (!p) return false;
    if (modo === "exata") return alvo === p;
    if (modo === "qualquer") {
      // `\b` não funciona com acentos em JS; a fronteira é conferida na mão pelo que cerca a
      // ocorrência: só conta se não houver letra ou número colado dos dois lados.
      const posicao = alvo.indexOf(p);
      if (posicao < 0) return false;
      const antes = alvo[posicao - 1];
      const depois = alvo[posicao + p.length];
      const ehLetra = (c?: string) => Boolean(c && /[\p{L}\p{N}]/u.test(c));
      return !ehLetra(antes) && !ehLetra(depois);
    }
    return alvo.includes(p);
  });
}

export function avaliarGatilho(fluxo: FluxoAutomacao, evento: EventoAutomacao): boolean {
  const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");
  if (!noGatilho) return false;
  if (noGatilho.type !== evento.tipo) return false;

  const data = noGatilho.data as {
    funilId?: string;
    etapaId?: string;
    publicacaoId?: string;
    storyId?: string;
  } & ConfiguracaoDePalavras;
  if (data.funilId && evento.funilId && data.funilId !== evento.funilId) return false;
  if (data.etapaId && evento.etapaId && data.etapaId !== evento.etapaId) return false;

  // Automação de comentário pode valer só pra UMA publicação. Vazio = qualquer publicação.
  if (data.publicacaoId && evento.publicacaoId && data.publicacaoId !== evento.publicacaoId) return false;

  // Mesma ideia pro story: a automação pode valer só pro story escolhido. Vazio = qualquer story,
  // de qualquer dia, que é o padrão e continua sendo o comportamento de quem nunca abriu o campo.
  //
  // `evento.storyId` ausente NÃO descarta: a Meta nem sempre manda o id do story respondido, e
  // tratar a ausência como "não é este" faria a automação parar de disparar em silêncio. Quando o
  // id vem, ele decide; quando não vem, a automação roda, como rodava antes deste campo existir.
  if (data.storyId && evento.storyId && data.storyId !== evento.storyId) return false;

  // Palavra configurada no gatilho: comentário ou mensagem só dispara se casar.
  const textoDoEvento = typeof evento.mensagem === "string" ? evento.mensagem : undefined;
  if (textoDoEvento !== undefined && !textoCasaComPalavras(textoDoEvento, data)) return false;

  const agora = new Date();
  if (!dentroDaJanela(fluxo, agora)) return false;

  // Se o nó logo depois do gatilho for uma condição, ela também precisa bater
  //. Best-effort, porque aqui a gente ainda não tem o contato completo (só o evento).
  const primeiraAresta = saidasDoNo(fluxo.edges, noGatilho.id)[0];
  if (primeiraAresta) {
    const proximoNo = fluxo.nodes.find((n) => n.id === primeiraAresta.target);
    if (proximoNo?.type === "condicao_grupo") {
      const condicaoData = proximoNo.data as CondicaoGrupoData;
      const contatoParcial = { nome: evento.contatoNome ?? "", etiquetas: [] as string[], ...evento };
      if (!avaliarGrupoCondicoes(condicaoData.grupo, contatoParcial)) return false;
    }
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* executarFluxo                                                             */
/* -------------------------------------------------------------------------- */


