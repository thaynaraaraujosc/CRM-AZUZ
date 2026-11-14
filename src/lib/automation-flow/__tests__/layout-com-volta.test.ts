import { describe, expect, it } from "vitest";

import { layoutFluxo } from "@/lib/automation-flow/migracao";
import type { FlowEdge, FlowNode } from "@/lib/automation-flow/types";

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

  /* O teto não pode mudar o desenho de quem não tem volta, que é a maioria. */
  it("fluxo sem volta continua em níveis crescentes", () => {
    const nodes = [no("a"), no("b"), no("c")];
    const edges = [aresta("a", "b"), aresta("b", "c")];
    layoutFluxo(nodes, edges);
    const [a, b, c] = nodes;
    expect(b.position.y).toBeGreaterThan(a.position.y);
    expect(c.position.y).toBeGreaterThan(b.position.y);
  });

  it("blocos no mesmo nível não ficam sobrepostos", () => {
    const nodes = [no("raiz"), no("e1"), no("e2")];
    const edges = [aresta("raiz", "e1"), aresta("raiz", "e2")];
    layoutFluxo(nodes, edges);
    expect(nodes[1].position.x).not.toBe(nodes[2].position.x);
  });
});
