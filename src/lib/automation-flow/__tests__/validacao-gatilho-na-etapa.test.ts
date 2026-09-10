import { describe, expect, it } from "vitest";

import type { FluxoAutomacao, FlowEdge, FlowNode } from "../types";
import { validarFluxo } from "../validacao";

/**
 * O robô criado por "Automatizar funil" não tem bloco de gatilho no canvas: quem dispara é a etapa
 * do funil. O motor sabe disso desde sempre (`primeiroNoDepoisDoGatilho`, em
 * `src/lib/automacoes/iniciar.ts`: sem bloco de gatilho, começa pelo único nó em que ninguém
 * entra). A validação não sabia, e cobrava um bloco de gatilho que aquele caminho nunca teria.
 *
 * O efeito era que o caminho principal do produto gerava robôs impossíveis de publicar. Estes
 * testes prendem as duas metades: o caso legítimo publica, e o caso que o motor não sabe executar
 * (mais de uma entrada) continua sendo erro.
 */
function no(id: string, category: FlowNode["category"], type: string): FlowNode {
  return { id, type, category, position: { x: 0, y: 0 }, data: {} } as FlowNode;
}

function aresta(source: string, target: string): FlowEdge {
  return { id: `${source}-${target}`, source, target } as FlowEdge;
}

function fluxo(parcial: Partial<FluxoAutomacao>): FluxoAutomacao {
  return { nodes: [], edges: [], ...parcial } as FluxoAutomacao;
}

const erros = (f: FluxoAutomacao) => validarFluxo(f).filter((p) => p.severidade === "erro");

describe("validação de robô cujo gatilho está na etapa do funil", () => {
  it("publica sem bloco de gatilho quando há uma entrada só", () => {
    const f = fluxo({
      funilId: "funil-principal",
      etapaId: "proposta",
      nodes: [no("a", "mensagem", "mensagem_texto"), no("z", "fim", "encerrar_fluxo")],
      edges: [aresta("a", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    expect(erros(f).map((p) => p.mensagem)).toEqual([]);
  });

  it("recusa quando há mais de um ponto de partida, que é o que o motor não sabe executar", () => {
    const f = fluxo({
      funilId: "funil-principal",
      etapaId: "proposta",
      nodes: [
        no("a", "mensagem", "mensagem_texto"),
        no("b", "mensagem", "mensagem_texto"),
        no("z", "fim", "encerrar_fluxo"),
      ],
      edges: [aresta("a", "z"), aresta("b", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };
    (f.nodes[1] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    expect(erros(f).some((p) => p.mensagem.includes("pontos de partida"))).toBe(true);
  });

  it("continua cobrando bloco de gatilho quando a etapa não dispara o robô", () => {
    const f = fluxo({
      nodes: [no("a", "mensagem", "mensagem_texto"), no("z", "fim", "encerrar_fluxo")],
      edges: [aresta("a", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    expect(erros(f).some((p) => p.mensagem.includes("não tem nenhum gatilho"))).toBe(true);
  });
});
