import { describe, expect, it } from "vitest";

import {
  gatilhoDaExecucao,
  gatilhosQueCasam,
  nosDeGatilho,
  tipoDoGatilhoQueCasa,
} from "../gatilhos-do-fluxo";
import type { FlowNode } from "../types";

function gatilho(id: string, type: string, data: Record<string, unknown> = {}): FlowNode {
  return { id, type, category: "gatilho", data, posicao: { x: 0, y: 0 } } as unknown as FlowNode;
}
function passo(id: string): FlowNode {
  return { id, type: "mensagem_texto", category: "mensagem", data: {}, posicao: { x: 0, y: 0 } } as unknown as FlowNode;
}

/**
 * O que estes testes prendem: um fluxo com vários gatilhos não pode disparar pelo bloco errado,
 * e um gatilho que não tem nada a ver com o evento não pode entrar na roda.
 */
describe("nosDeGatilho", () => {
  it("devolve todos, na ordem", () => {
    const nodes = [gatilho("g1", "comentario_instagram"), passo("m1"), gatilho("g2", "instagram_story_respondido")];
    expect(nosDeGatilho(nodes).map((n) => n.id)).toEqual(["g1", "g2"]);
  });

  it("fluxo sem gatilho devolve lista vazia", () => {
    expect(nosDeGatilho([passo("m1")])).toEqual([]);
  });
});

describe("tipoDoGatilhoQueCasa", () => {
  it("tipo igual casa", () => {
    expect(tipoDoGatilhoQueCasa("comentario_instagram", "comentario_instagram")).toBe("comentario_instagram");
  });

  it("mensagem recebida também aciona palavra-chave e direct do Instagram", () => {
    // Três formas de dizer o mesmo acontecimento. Sem isto, um fluxo com "Palavra-chave recebida"
    // nunca dispararia: o tipo do evento não bate com o tipo do bloco.
    expect(tipoDoGatilhoQueCasa("mensagem_recebida", "palavra_chave")).toBe("palavra_chave");
    expect(tipoDoGatilhoQueCasa("mensagem_recebida", "instagram_direct_recebido")).toBe(
      "instagram_direct_recebido",
    );
  });

  it("tipos sem relação não casam", () => {
    expect(tipoDoGatilhoQueCasa("comentario_instagram", "aniversario")).toBeNull();
    expect(tipoDoGatilhoQueCasa("comentario_instagram", undefined)).toBeNull();
  });
});

describe("gatilhosQueCasam", () => {
  const nodes = [
    gatilho("g1", "comentario_instagram"),
    gatilho("g2", "instagram_story_respondido"),
    gatilho("g3", "comentario_instagram"),
    passo("m1"),
  ];

  it("devolve só os blocos que o evento aciona", () => {
    expect(gatilhosQueCasam(nodes, "comentario_instagram").map((c) => c.no.id)).toEqual(["g1", "g3"]);
  });

  it("devolve vazio quando nenhum serve", () => {
    expect(gatilhosQueCasam(nodes, "aniversario")).toEqual([]);
  });

  it("carrega o tipo a usar na avaliação, que pode não ser o do evento", () => {
    const comPalavra = [gatilho("g1", "palavra_chave")];
    expect(gatilhosQueCasam(comPalavra, "mensagem_recebida")).toEqual([
      { no: comPalavra[0], tipoAceito: "palavra_chave" },
    ]);
  });
});

describe("gatilhoDaExecucao", () => {
  const nodes = [gatilho("g1", "comentario_instagram"), gatilho("g2", "instagram_story_respondido")];

  it("acha pelo tipo gravado na execução", () => {
    expect(gatilhoDaExecucao(nodes, "instagram_story_respondido")?.id).toBe("g2");
  });

  it("sem tipo, cai no primeiro", () => {
    expect(gatilhoDaExecucao(nodes, undefined)?.id).toBe("g1");
  });

  it("tipo que não existe mais no fluxo também cai no primeiro, em vez de travar a execução", () => {
    // O fluxo pode ter sido editado depois que a execução começou. Parar seria perder a execução.
    expect(gatilhoDaExecucao(nodes, "aniversario")?.id).toBe("g1");
  });

  it("fluxo sem gatilho devolve nulo", () => {
    expect(gatilhoDaExecucao([passo("m1")], "qualquer")).toBeNull();
  });
});
