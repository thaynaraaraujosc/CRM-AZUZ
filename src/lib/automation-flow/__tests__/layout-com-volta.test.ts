import { describe, expect, it } from "vitest";

import { layoutFluxo } from "@/lib/automation-flow/migracao";
import type { FlowEdge, FlowNode } from "@/lib/automation-flow/types";
import { alturaEstimadaDoNo } from "@/lib/automation-flow/layout";
import { MODELOS_DE_ROBO } from "@/lib/automacoes/modelos-de-robo";

function no(id: string): FlowNode {
  return { id, type: "mensagem_texto", category: "mensagem", position: { x: 0, y: 0 }, data: {} } as FlowNode;
}

function aresta(source: string, target: string): FlowEdge {
  return { id: `${source}->${target}`, source, target } as FlowEdge;
}

/**
 * FLUXO QUE VOLTA ATRÁS TRAVAVA A ABA.
 *
 * O layout empurra o bloco de novo toda vez que acha um caminho MAIS LONGO até ele. Sem volta
 * isso acaba — o caminho mais longo tem no máximo o número de blocos. Com volta ("Menu principal"
 * que retorna ao menu, "e-mail inválido" que volta pra pergunta) cada passagem acha um caminho um
 * nível mais longo, pra sempre, e a aba congela.
 *
 * E volta não é caso raro nem erro: é como se escreve um menu e uma revalidação.
 */
describe("layoutFluxo com fluxo que volta atrás", () => {
  it("termina num laço simples, em vez de rodar pra sempre", () => {
    const nodes = [no("a"), no("b"), no("c")];
    const edges = [aresta("a", "b"), aresta("b", "c"), aresta("c", "b")];
    layoutFluxo(nodes, edges);
    expect(nodes.every((n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
  });

  it("termina quando o laço volta pro primeiro bloco", () => {
    const nodes = [no("menu"), no("x"), no("y")];
    const edges = [aresta("menu", "x"), aresta("x", "y"), aresta("y", "menu")];
    layoutFluxo(nodes, edges);
    expect(nodes.every((n) => Number.isFinite(n.position.x))).toBe(true);
  });

  it("termina com dois laços encadeados", () => {
    const nodes = ["a", "b", "c", "d"].map(no);
    const edges = [aresta("a", "b"), aresta("b", "c"), aresta("c", "b"), aresta("c", "d"), aresta("d", "a")];
    layoutFluxo(nodes, edges);
    expect(nodes.every((n) => Number.isFinite(n.position.y))).toBe(true);
  });

  /*
   * O PASSO SEGUINTE FICA À DIREITA, não embaixo.
   *
   * O editor lê da esquerda pra direita desde que os dois módulos viraram o mesmo. O layout
   * empilhava de cima pra baixo: o fluxo descia enquanto as ligações saíam pela lateral.
   */
  it("fluxo sem volta avança para a direita", () => {
    const nodes = [no("a"), no("b"), no("c")];
    const edges = [aresta("a", "b"), aresta("b", "c")];
    layoutFluxo(nodes, edges);
    const [a, b, c] = nodes;
    expect(b.position.x).toBeGreaterThan(a.position.x);
    expect(c.position.x).toBeGreaterThan(b.position.x);
  });

  it("ramos paralelos ficam um acima do outro, e não no mesmo lugar", () => {
    const nodes = [no("raiz"), no("e1"), no("e2")];
    const edges = [aresta("raiz", "e1"), aresta("raiz", "e2")];
    layoutFluxo(nodes, edges);
    expect(nodes[1].position.y).not.toBe(nodes[2].position.y);
  });
});

/**
 * NENHUM BLOCO EM CIMA DE OUTRO — que é a reclamação, dita como teste.
 *
 * "Quando aparece a automação, fica extremamente desorganizado, um amontoado em cima do outro."
 *
 * A conta antiga usava passo de 260px na horizontal e 180 na vertical, com blocos de 280 de
 * largura e até 220 de altura. A sobreposição não era azar: era garantida por construção.
 */
describe("nenhum bloco se sobrepõe a outro", () => {
  const LARGURA = 280;

  function seSobrepoem(a: FlowNode, b: FlowNode, alturaA: number, alturaB: number): boolean {
    return (
      a.position.x < b.position.x + LARGURA &&
      a.position.x + LARGURA > b.position.x &&
      a.position.y < b.position.y + alturaB &&
      a.position.y + alturaA > b.position.y
    );
  }

  it("num fluxo em linha", () => {
    const nodes = ["a", "b", "c", "d"].map(no);
    const edges = [aresta("a", "b"), aresta("b", "c"), aresta("c", "d")];
    layoutFluxo(nodes, edges);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(seSobrepoem(nodes[i], nodes[j], 120, 120), `${nodes[i].id} × ${nodes[j].id}`).toBe(false);
      }
    }
  });

  it("num fluxo com quatro ramos saindo do mesmo bloco", () => {
    const nodes = ["raiz", "a", "b", "c", "d"].map(no);
    const edges = ["a", "b", "c", "d"].map((t) => aresta("raiz", t));
    layoutFluxo(nodes, edges);
    for (let i = 1; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(seSobrepoem(nodes[i], nodes[j], 120, 120), `${nodes[i].id} × ${nodes[j].id}`).toBe(false);
      }
    }
  });

  /* Todo modelo da galeria, que é onde ela viu o amontoado. */
  it("em todos os modelos prontos da galeria", () => {
    for (const modelo of MODELOS_DE_ROBO) {
      const { nodes } = modelo.construir();
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const sobrepoe = seSobrepoem(
            nodes[i],
            nodes[j],
            alturaEstimadaDoNo(nodes[i]),
            alturaEstimadaDoNo(nodes[j]),
          );
          expect(sobrepoe, `${modelo.id}: ${nodes[i].id} em cima de ${nodes[j].id}`).toBe(false);
        }
      }
    }
  });
});
