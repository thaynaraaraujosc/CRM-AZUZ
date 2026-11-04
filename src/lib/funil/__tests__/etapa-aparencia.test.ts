import { describe, expect, it } from "vitest";

import { CORES_DA_ETAPA, lerCorDaEtapa, lerDicas } from "../etapa-aparencia";

/**
 * Cor e dicas chegam do navegador: a cor vira atributo de estilo, as dicas viram texto mostrado
 * pra equipe. O que estes testes prendem é que nada entre no banco sem passar pelo corte.
 */
describe("lerCorDaEtapa", () => {
  it("aceita as cores da paleta", () => {
    expect(lerCorDaEtapa("#98cbff")).toBe("#98cbff");
    expect(lerCorDaEtapa("  #FF8F92  ")).toBe("#ff8f92");
  });

  it("recusa cor fora da paleta", () => {
    // Paleta fechada é decisão de desenho: catorze tons sem relação entre si fazem a cor deixar
    // de distinguir, porque tudo distingue.
    expect(lerCorDaEtapa("#123456")).toBeNull();
    expect(lerCorDaEtapa("red")).toBeNull();
  });

  it("recusa o que não é texto", () => {
    expect(lerCorDaEtapa(null)).toBeNull();
    expect(lerCorDaEtapa(42)).toBeNull();
    expect(lerCorDaEtapa({ cor: "#98cbff" })).toBeNull();
  });

  it("a paleta tem as 21 cores da referência, sem repetir", () => {
    expect(CORES_DA_ETAPA).toHaveLength(21);
    expect(new Set(CORES_DA_ETAPA).size).toBe(21);
  });
});

describe("lerDicas", () => {
  it("lê os três níveis", () => {
    expect(lerDicas({ iniciante: "a", intermediario: "b", expert: "c" })).toEqual({
      iniciante: "a",
      intermediario: "b",
      expert: "c",
    });
  });

  it("escrever um nível só já vale", () => {
    expect(lerDicas({ iniciante: "ligue em 5 minutos" })).toEqual({ iniciante: "ligue em 5 minutos" });
  });

  it("nível vazio não vira string vazia gravada", () => {
    expect(lerDicas({ iniciante: "   ", expert: "x" })).toEqual({ expert: "x" });
  });

  it("corta o texto comprido: dica é orientação, não manual", () => {
    expect(lerDicas({ iniciante: "a".repeat(2000) })!.iniciante).toHaveLength(600);
  });

  it("ignora chave desconhecida", () => {
    expect(lerDicas({ iniciante: "a", avancado: "b" })).toEqual({ iniciante: "a" });
  });

  it("sem nada escrito devolve indefinido, que é o que apaga a coluna", () => {
    expect(lerDicas({})).toBeUndefined();
    expect(lerDicas({ iniciante: "" })).toBeUndefined();
    expect(lerDicas(null)).toBeUndefined();
    expect(lerDicas(["a"])).toBeUndefined();
  });
});
