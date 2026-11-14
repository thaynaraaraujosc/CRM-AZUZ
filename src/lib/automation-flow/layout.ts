import dagre from "dagre";

import { saidasDoNo } from "@/lib/automation-flow/resumo";
import type { FlowEdge, FlowNode } from "@/lib/automation-flow/types";

/**
 * ONDE CADA BLOCO FICA NO QUADRO — uma conta só, pro editor e pros modelos.
 *
 * "Quando aparece a automação, fica extremamente desorganizado, um amontoado em cima do outro."
 *
 * Eram DUAS contas diferentes, e essa era a origem do amontoado:
 *
 *  - O botão "organizar automaticamente" do editor usa o `dagre`, com a largura e a altura reais
 *    de cada bloco. Esse sempre deu um quadro legível.
 *  - Os modelos e a migração usavam outra, escrita à mão: profundidade vira Y, índice dentro do
 *    nível vira X, com 180px entre linhas e 260px entre colunas. Só que um bloco tem 280px de
 *    largura e um bloco de mensagem com três botões passa de 200px de altura. Com 260 de passo
 *    horizontal e 180 de vertical, os blocos se sobrepõem por construção — não é "às vezes fica
 *    apertado", é garantido.
 *
 * E tinha o sentido: aquela conta empilhava de cima pra baixo, e o editor passou a ler da ESQUERDA
 * PRA DIREITA quando os dois módulos viraram o mesmo. O fluxo descia enquanto as ligações saíam
 * pela lateral.
 *
 * Agora é esta função, e as duas pontas chamam ela.
 */

/** A largura do cartão de bloco no canvas (ver `.flow-node` em `globals.css`). */
export const LARGURA_NO = 280;
/** Altura de um bloco sem ramificação: título, resumo e uma saída. */
export const ALTURA_NO = 120;
/** Cada saída extra desenha uma linha dentro do bloco (ver `.flow-node-handle-row`). */
export const ALTURA_POR_SAIDA = 30;

/**
 * A altura que o bloco VAI ocupar, contando as saídas.
 *
 * Medir todo bloco por uma altura fixa é o que fazia o layout reservar espaço a menos: um bloco de
 * decisão com cinco caminhos ocupa mais que o dobro de um simples, e os de baixo subiam por cima
 * dele. Quanto mais ramificada a automação, pior — exatamente o caso em que organizar é mais
 * necessário.
 */
export function alturaEstimadaDoNo(no: FlowNode): number {
  const saidas = saidasDoNo(no).length;
  return saidas > 1 ? ALTURA_NO + saidas * ALTURA_POR_SAIDA : ALTURA_NO;
}

export type DirecaoDoLayout = "TB" | "LR";

/**
 * Calcula a posição de cada bloco. Devolve um mapa id → posição; quem chama aplica.
 *
 * `dagre` e não uma conta própria: ele resolve o que uma conta à mão não resolve — ramos de
 * tamanhos diferentes, blocos que convergem, e o espaço que cada um realmente ocupa. E ele lida
 * com fluxo que VOLTA ATRÁS, que é como se escreve um menu ("Menu principal" que retorna) e uma
 * revalidação ("e-mail inválido" que volta pra pergunta).
 */
export function posicoesDoFluxo(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direcao: DirecaoDoLayout = "LR",
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  const horizontal = direcao === "LR";
  /*
   * Na horizontal os papéis se invertem: `ranksep` é a distância entre um passo e o SEGUINTE (que
   * precisa caber a curva da ligação) e `nodesep` a distância entre dois ramos PARALELOS — que são
   * blocos altos, e por isso pedem mais folga.
   */
  g.setGraph({
    rankdir: direcao,
    nodesep: horizontal ? 60 : 90,
    ranksep: horizontal ? 120 : 140,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(nodes.map((n) => n.id));
  nodes.forEach((n) => g.setNode(n.id, { width: LARGURA_NO, height: alturaEstimadaDoNo(n) }));
  edges.forEach((e) => {
    // Aresta pendurada (apontando pra bloco que não existe mais) derruba o dagre.
    if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  const posicoes = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => {
    const posicionado = g.node(n.id) as { x: number; y: number } | undefined;
    if (!posicionado) return;
    // O dagre devolve o CENTRO do bloco; o canvas posiciona pelo canto. Descontar a altura REAL (e
    // não a fixa) é o que mantém o bloco alinhado com o espaço que foi reservado pra ele.
    posicoes.set(n.id, {
      x: posicionado.x - LARGURA_NO / 2,
      y: posicionado.y - alturaEstimadaDoNo(n) / 2,
    });
  });
  return posicoes;
}

/** Posiciona os blocos no lugar, alterando o array recebido. */
export function posicionarFluxo(nodes: FlowNode[], edges: FlowEdge[], direcao: DirecaoDoLayout = "LR"): void {
  const posicoes = posicoesDoFluxo(nodes, edges, direcao);
  nodes.forEach((n) => {
    const p = posicoes.get(n.id);
    if (p) n.position = p;
  });
}
