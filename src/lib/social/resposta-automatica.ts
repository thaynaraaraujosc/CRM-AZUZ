import { layoutFluxo } from "@/lib/automation-flow/migracao";
import type { FlowEdge, FlowNode, FlowNodeType } from "@/lib/automation-flow/types";

/**
 * Resposta automática: a forma curta de um robô social.
 *
 * A maior parte do que as pessoas querem no Instagram é uma frase só: "quem comentar X recebe Y no
 * Direct". Pedir que isso seja montado no construtor de fluxo é pedir que se aprenda um editor
 * inteiro pra escrever duas linhas de texto.
 *
 * Mas isto NÃO é um segundo motor. Uma resposta automática É um fluxo social, com os mesmos nós,
 * a mesma execução e o mesmo versionamento; esta tela só monta e lê aquele fluxo por cima. Quem
 * quiser continuar dali abre no construtor e acrescenta o que quiser: nada precisa ser refeito.
 *
 * A ida e a volta são simétricas de propósito (`montar` e `ler`): sem isso, editar uma resposta
 * automática significaria adivinhar o que ela era, e a segunda edição estragaria a primeira.
 */

/** A categoria que marca o fluxo como "nascido da tela curta". É o que `ler` procura. */
export const CATEGORIA_RESPOSTA = "resposta_automatica";

export type QuandoResposta = "comentario" | "direct" | "story";

export type RespostaAutomatica = {
  nome: string;
  quando: QuandoResposta;
  /** Vazio = qualquer mensagem/comentário daquele tipo dispara. */
  palavras: string[];
  /** O que vai pro Direct da pessoa. Obrigatório: sem isso a resposta não responde nada. */
  mensagem: string;
  /**
   * Resposta pública ao comentário. Só existe quando o gatilho é comentário, porque só ali existe
   * um comentário a responder.
   */
  respostaPublica?: string;
  /** Etiqueta aplicada ao contato. Vazio = nenhuma. */
  etiqueta?: string;
};

const GATILHO_DO_QUANDO: Record<QuandoResposta, FlowNodeType> = {
  comentario: "comentario_instagram",
  direct: "instagram_direct_recebido",
  story: "instagram_story_respondido",
};

/*
 * `mensagem_recebida` continua aqui, mapeado, e não é sobra: é o gatilho genérico do funil, e foi
 * o que estas respostas automáticas usaram enquanto o bloco próprio do Direct não existia. Uma
 * resposta salva antes da mudança abre pelo caminho certo por causa desta linha. Tirar seria
 * quebrar o que já está no ar pra ganhar uma linha a menos.
 */
const QUANDO_DO_GATILHO: Partial<Record<FlowNodeType, QuandoResposta>> = {
  comentario_instagram: "comentario",
  instagram_direct_recebido: "direct",
  mensagem_recebida: "direct",
  instagram_story_respondido: "story",
};

export const OPCOES_QUANDO: { valor: QuandoResposta; label: string; ajuda: string }[] = [
  {
    valor: "comentario",
    label: "Comentou numa publicação",
    ajuda: "Vale pra qualquer publicação ou reel. Dá pra responder o comentário em público também.",
  },
  {
    valor: "direct",
    label: "Mandou mensagem no Direct",
    ajuda: "Qualquer mensagem nova no Direct.",
  },
  {
    valor: "story",
    label: "Respondeu um story",
    ajuda: "Quando alguém responde um story seu pelo Direct.",
  },
];

function no<T>(id: string, type: FlowNodeType, category: FlowNode["category"], data: T): FlowNode<T> {
  return { id, type, category, position: { x: 0, y: 0 }, data };
}

function aresta(source: string, target: string): FlowEdge {
  return { id: `${source}->${target}`, source, target };
}

/** Os problemas que impedem de salvar, em português. Lista vazia = pode salvar. */
export function validarResposta(r: RespostaAutomatica): string[] {
  const problemas: string[] = [];
  if (!r.nome?.trim()) problemas.push("Dê um nome pra esta resposta.");
  if (!r.mensagem?.trim()) problemas.push("Escreva a mensagem que vai pro Direct.");
  // Teto real do Direct: acima disso a API recusa a mensagem inteira, não corta o excedente.
  if (r.mensagem && r.mensagem.length > 1000) problemas.push("A mensagem passa de 1.000 caracteres, o limite do Direct.");
  if (r.respostaPublica && r.quando !== "comentario") {
    problemas.push("Resposta pública só existe quando o gatilho é um comentário.");
  }
  if (r.respostaPublica && r.respostaPublica.length > 1000) {
    problemas.push("A resposta pública passa de 1.000 caracteres.");
  }
  return problemas;
}

/** Vira o fluxo que o motor executa. */
export function montarFluxoDaResposta(r: RespostaAutomatica): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const palavras = r.palavras.map((p) => p.trim()).filter(Boolean);
  nodes.push(
    no("ra-gatilho", GATILHO_DO_QUANDO[r.quando], "gatilho", {
      canal: "Instagram",
      palavras,
      // "qualquer" compara palavra inteira: uma resposta de "quero" não deve disparar em "não
      // quero", e é essa a diferença entre uma automação útil e uma que constrange.
      modoPalavra: "qualquer",
      ignorarAcentos: true,
      publicacaoId: "",
    }),
  );

  let anterior = "ra-gatilho";

  // A resposta pública vem ANTES do Direct, e não é ordem por acaso: é ela que aparece pra quem
  // está lendo os comentários, e é o que faz a próxima pessoa comentar também.
  if (r.quando === "comentario" && r.respostaPublica?.trim()) {
    nodes.push(no("ra-publica", "responder_comentario_instagram", "acao", { texto: r.respostaPublica.trim() }));
    edges.push(aresta(anterior, "ra-publica"));
    anterior = "ra-publica";
  }

  nodes.push(no("ra-direct", "mensagem_texto", "mensagem", { canal: "instagram", texto: r.mensagem.trim() }));
  edges.push(aresta(anterior, "ra-direct"));
  anterior = "ra-direct";

  if (r.etiqueta?.trim()) {
    nodes.push(no("ra-etiqueta", "adicionar_etiqueta", "acao", { etiquetaNome: r.etiqueta.trim() }));
    edges.push(aresta(anterior, "ra-etiqueta"));
    anterior = "ra-etiqueta";
  }

  nodes.push(no("ra-fim", "encerrar_fluxo", "fim", { observacao: "Resposta automática enviada." }));
  edges.push(aresta(anterior, "ra-fim"));

  layoutFluxo(nodes, edges);
  return { nodes, edges };
}

/**
 * Lê de volta um fluxo como resposta automática, ou devolve `null`.
 *
 * `null` quer dizer "este fluxo já não cabe na tela curta": alguém abriu no construtor e
 * acrescentou uma pergunta, uma condição, uma espera. Nesse caso a tela curta se recusa a
 * mostrá-lo em vez de exibir uma versão empobrecida que, ao salvar, apagaria o resto do trabalho.
 */
export function lerRespostaDoFluxo(fluxo: {
  nome: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}): RespostaAutomatica | null {
  const gatilho = fluxo.nodes.find((n) => n.category === "gatilho");
  const quando = gatilho ? QUANDO_DO_GATILHO[gatilho.type] : undefined;
  if (!gatilho || !quando) return null;

  const direct = fluxo.nodes.find((n) => n.type === "mensagem_texto");
  if (!direct) return null;

  const publica = fluxo.nodes.find((n) => n.type === "responder_comentario_instagram");
  const etiqueta = fluxo.nodes.find((n) => n.type === "adicionar_etiqueta");

  // Qualquer nó fora do repertório da tela curta: o fluxo cresceu além dela.
  const conhecidos = new Set<FlowNodeType>([
    gatilho.type,
    "mensagem_texto",
    "responder_comentario_instagram",
    "adicionar_etiqueta",
    "encerrar_fluxo",
  ]);
  if (fluxo.nodes.some((n) => !conhecidos.has(n.type))) return null;

  const dadosGatilho = gatilho.data as { palavras?: string[] };
  return {
    nome: fluxo.nome,
    quando,
    palavras: Array.isArray(dadosGatilho.palavras) ? dadosGatilho.palavras : [],
    mensagem: String((direct.data as { texto?: string }).texto ?? ""),
    respostaPublica: publica ? String((publica.data as { texto?: string }).texto ?? "") : undefined,
    etiqueta: etiqueta ? String((etiqueta.data as { etiquetaNome?: string }).etiquetaNome ?? "") : undefined,
  };
}
