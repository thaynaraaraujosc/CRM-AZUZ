"use client";

import dagre from "dagre";

import { saidasDoNo } from "@/lib/automation-flow/resumo";
import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { AreaAutomacao } from "@/lib/canais/capacidades";
import type {
  FlowEdge,
  FlowNode,
  FlowNodeCategory,
  FlowNodeType,
  ProblemaValidacao,
} from "@/lib/automation-flow/types";

/** `data` do nó React Flow. Embrulha o `FlowNode` de domínio + os problemas de validação vigentes desse nó (mesclados na hora de renderizar, nunca guardados em estado). */
export type FlowRFNodeData = {
  flowNode: FlowNode;
  problemas: ProblemaValidacao[];
  /** Chaves (handleId, ou "__default__" pra saída única sem nome) que já têm uma aresta saindo. Usado pra saber onde mostrar o botão "+" de adicionar o próximo passo. */
  saidasConectadas?: Set<string>;
  /** Quantos caminhos diferentes chegam nesse node. >1 indica que branches diferentes se reencontram aqui (item 31). */
  caminhosConvergindo?: number;
  /** Número de sequência (1, 2, 3...) e frase narrativa do modo "Entender fluxo" (item 24). Os dois só vêm preenchidos quando o modo está ativo. */
  ordemNarrativa?: number;
  explicacao?: string;
  /** Fechado sobre o id do nó lá no FlowEditor. Abre o seletor rápido "O que acontece agora?" pra essa saída específica. */
  onAdicionarApos?: (handleId: string | undefined, ancora?: DOMRect) => void;
  /**
   * A área do fluxo a que este nó pertence. Viaja no `data` porque o nó não a conhece: ela é do
   * FLUXO, e o React Flow entrega ao componente só o nó.
   *
   * Serve pra uma coisa: no Social Seller o bloco mostra a cara do Instagram — a marca no
   * cabeçalho de quem fala com a rede, e o texto numa bolha igual à que o contato vai ver no
   * Direct. Sem isso o canvas do Instagram é idêntico ao do funil, e quem monta não tem como
   * conferir, olhando, o que a pessoa do outro lado vai receber.
   */
  area?: AreaAutomacao;
  /** Copiar e apagar ESTE bloco, pelos dois botões que aparecem em cima dele quando selecionado. */
  aoDuplicar?: () => void;
  aoRemover?: () => void;
  /**
   * O número do bloco, do jeito que a referência mostra: `1`, `3`, `14`.
   *
   * É a ORDEM DE CRIAÇÃO, e não a ordem de execução. Parece um detalhe e não é: a ordem de
   * execução muda conforme o caminho que o contato toma (uma pergunta com três botões tem três
   * ordens possíveis), então um número "de execução" estaria errado na maioria das vezes. O
   * número de criação é estável, serve pra conversar sobre o fluxo ("o bloco 5 está errado") e
   * não promete nada que não cumpre.
   */
  numero?: number;
  /**
   * ESCREVER A MENSAGEM NO PRÓPRIO CARTÃO, sem abrir o painel da direita.
   *
   * É o gesto da referência, e é o que faz o canvas valer a pena: a mensagem que o contato vai
   * receber fica legível e editável no mesmo lugar onde se desenha o caminho dela.
   */
  aoEditarTexto?: (texto: string) => void;
  /** Trocar o nome do bloco, pelo "⋯" do próprio cartão. */
  aoRenomear?: (titulo: string) => void;
  /** Testar a automação a partir do começo, pelo "⋯". */
  aoTestar?: () => void;
  /**
   * Prender um arquivo ao bloco de mensagem: o clipe e o microfone do cartão.
   *
   * O bloco MUDA DE TIPO quando isso acontece (texto vira imagem, áudio, documento…), porque é
   * assim que o motor sabe o que enviar. Quem decide o tipo é o editor, não o cartão: o cartão
   * entrega o arquivo e o que ele é.
   */
  aoAnexar?: (arquivo: { dataUrl: string; nome: string; mimeType: string; bytes: number }) => void;
  /**
   * Os botões de resposta rápida, editados DENTRO da bolha.
   *
   * Acrescentar o primeiro muda o tipo do bloco (`mensagem_texto` vira `mensagem_botoes`) e tirar
   * o último desfaz a mudança — quem faz isso é o editor, porque é ele que conhece o formato do
   * fluxo. Aqui só se diz qual é a lista nova.
   */
  aoMudarOpcoes?: (opcoes: { id: string; rotulo: string; url?: string }[]) => void;
  /**
   * Desligar a saída: o "×" no lugar do "+" quando ela já tem um caminho.
   *
   * Sem isto, desfazer uma ligação exigia achar a linha no meio do desenho, clicar nela e apertar
   * Delete — e num fluxo com vinte linhas que se cruzam, clicar na linha certa é sorte.
   */
  aoDesligarSaida?: (handleId: string | undefined) => void;
  /** Trocar o canal da mensagem pelo cabeçalho do cartão. */
  aoMudarCanal?: (canal: string) => void;
  /** Escrever um campo qualquer do bloco a partir do cartão (o botão "Canais" usa este). */
  aoMudarCampo?: (campo: string, valor: unknown) => void;
  /** O "!" do bloco: seleciona o bloco e abre o painel já na aba Problemas. */
  aoAbrirProblemas?: () => void;
  /*
   * O CARTÃO ÚNICO DE GATILHOS (ver `GrupoGatilhosNode`).
   *
   * Os três campos abaixo só vêm preenchidos no PRIMEIRO bloco de gatilho de um fluxo social: é
   * ele que desenha a lista inteira, e os outros ficam escondidos. Eles descrevem o FLUXO, não o
   * bloco, e por isso são montados no editor — o nó não tem como conhecer os irmãos.
   */
  gatilhosDoGrupo?: { tipo: FlowNodeType; label: string }[];
  palavrasDoGrupo?: string[];
  /** Abre a gaveta na lista de gatilhos. */
  aoAbrirGatilhos?: () => void;
  /** Abre a gaveta direto na etapa das palavras-chave. */
  aoAbrirPalavras?: () => void;
  /** Abre a gaveta já com o modal de acrescentar gatilho na frente. */
  aoAdicionarGatilho?: () => void;
  /** O tempo do cronômetro, em minutos, editado no próprio cartão do bloco de espera. */
  aoMudarCronometro?: (minutos: number) => void;
};

/**
 * `"inicio"` entra no tipo mas NÃO é uma categoria de bloco.
 *
 * É a pastilha verde de começo, desenhada no canvas e nunca salva no fluxo: ver `InicioNode`. Ela
 * precisa existir aqui só porque o React Flow tipa o nó pelo nome do componente que o desenha.
 */
export type FlowRFNode = Node<FlowRFNodeData, FlowNodeCategory | "inicio" | "grupo-gatilhos">;
/**
 * A aresta carrega `aoApagar` no `data` — a lixeira que aparece ao passar o mouse por cima dela
 * (ver `ArestaSocial`). Era `Record<string, never>`, que é "nada aqui dentro": o componente de
 * aresta não recebe props soltas, e o jeito do React Flow de entregar um callback pra ele é o
 * `data` da própria aresta.
 */
export type FlowRFEdge = Edge<{ aoApagar?: (id: string) => void }>;

export function domainNodesToRF(nodes: FlowNode[]): FlowRFNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.category,
    position: n.position,
    data: { flowNode: n, problemas: [] },
  }));
}

export function rfNodesToDomain(nodes: FlowRFNode[]): FlowNode[] {
  return nodes.map((n) => ({ ...n.data.flowNode, position: n.position }));
}

export function domainEdgesToRF(edges: FlowEdge[]): FlowRFEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: e.cor ? { stroke: e.cor } : undefined,
  }));
}

export function rfEdgesToDomain(edges: FlowRFEdge[]): FlowEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    label: typeof e.label === "string" ? e.label : undefined,
  }));
}

let contadorId = 0;
export function novoIdNo(): string {
  contadorId += 1;
  return `no-${Date.now()}-${contadorId}`;
}
export function novoIdAresta(): string {
  contadorId += 1;
  return `aresta-${Date.now()}-${contadorId}`;
}

/** Cor de identificação por categoria. Usada no minimapa (FlowEditor/VisualizarFluxo) e espelhada em
 * CSS (".flow-cat-*", globals.css) pra colorir a barra lateral de cada nó. Um lugar só, pra não
 * divergir entre os dois usos. */
export const CORES_CATEGORIA: Record<string, string> = {
  gatilho: "#2e6bff",
  condicao: "#8a3ffc",
  mensagem: "#0f9d63",
  espera: "#c9660a",
  acao: "#d8a400",
  humano: "#d84594",
  integracao: "#64748b",
  fim: "#d64545",
};

// Precisa bater aproximadamente com o tamanho real do node em .flow-node (globals.css): usado só
// pra estimar espaço no auto-layout (dagre), não define o tamanho de verdade renderizado.
const LARGURA_NO = 280;
/** Altura de um bloco sem ramificação. Título, resumo e uma saída. */
const ALTURA_NO = 120;
/** Cada saída extra desenha uma linha dentro do bloco (ver `.flow-node-handle-row`). */
const ALTURA_POR_SAIDA = 30;

/**
 * Altura REAL do bloco, contando as saídas.
 *
 * O layout automático media todo bloco por uma altura fixa. Um bloco de decisão com cinco caminhos
 * ocupa mais que o dobro disso. Então o algoritmo reservava espaço a menos e os blocos de baixo
 * subiam por cima dele. Quanto mais ramificada a automação, pior ficava: exatamente o caso em que
 * organizar automaticamente é mais necessário.
 */
function alturaDoNo(node: FlowRFNode): number {
  const saidas = saidasDoNo(node.data.flowNode).length;
  return saidas > 1 ? ALTURA_NO + saidas * ALTURA_POR_SAIDA : ALTURA_NO;
}

/** Recalcula a posição de todo mundo em camadas (dagre, topo→baixo): usado pelo botão "organizar automaticamente". */
/**
 * Organiza o fluxo. `direcao` escolhe o sentido da leitura.
 *
 * "TB" (de cima pra baixo) é o do funil, e sempre foi o único. "LR" (da esquerda pra direita) é o
 * do Social Seller, e veio da referência: no ManyChat o passo seguinte fica ao LADO, e a ligação
 * sai pela lateral do bloco. Num fluxo de atendimento, que é uma conversa, ler na horizontal é
 * ler na ordem em que as mensagens acontecem.
 */
export function autoLayout(
  nodes: FlowRFNode[],
  edges: FlowRFEdge[],
  direcao: "TB" | "LR" = "TB",
): FlowRFNode[] {
  const g = new dagre.graphlib.Graph();
  // `nodesep` sobe junto: com blocos altos lado a lado, 70px de folga lateral fazia dois ramos
  // vizinhos parecerem colados mesmo sem se sobrepor.
  //
  // Na horizontal os papéis se invertem: `ranksep` passa a ser a distância ENTRE um passo e o
  // seguinte (que precisa caber a curva da ligação) e `nodesep` a distância entre dois ramos
  // paralelos (que são blocos altos, e por isso pedem mais folga).
  const horizontal = direcao === "LR";
  g.setGraph({
    rankdir: direcao,
    nodesep: horizontal ? 60 : 90,
    ranksep: horizontal ? 120 : 140,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => g.setNode(n.id, { width: LARGURA_NO, height: alturaDoNo(n) }));
  edges.forEach((e) => {
    if (nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)) {
      g.setEdge(e.source, e.target);
    }
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const posicionado = g.node(n.id);
    if (!posicionado) return n;
    // O dagre devolve o CENTRO do bloco; o canvas posiciona pelo canto. Descontar a altura real (e
    // não a fixa) é o que mantém o bloco alinhado com o espaço que foi reservado pra ele.
    return { ...n, position: { x: posicionado.x - LARGURA_NO / 2, y: posicionado.y - alturaDoNo(n) / 2 } };
  });
}
