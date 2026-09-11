import { describe, expect, it } from "vitest";

import { ordenarPorQuemFica, type CardComparavel } from "../consolidar";

/**
 * Aqui se decide qual negócio some. Errar apaga trabalho de venda de alguém, então o critério
 * precisa estar preso em teste e ser óbvio de ler: fica o que está mais à frente no funil, porque
 * é ele que carrega o que a pessoa fez com aquele lead.
 */
function card(parcial: Partial<CardComparavel> & { id: string }): CardComparavel {
  return { ordemEtapa: 0, valor: "", responsavel: null, statusFechamento: null, ...parcial };
}

describe("qual negócio duplicado fica", () => {
  it("fica o que está mais à frente no funil", () => {
    const [fica, ...saem] = ordenarPorQuemFica([
      card({ id: "novo", ordemEtapa: 0 }),
      card({ id: "proposta", ordemEtapa: 3 }),
    ]);
    expect(fica.id).toBe("proposta");
    expect(saem.map((c) => c.id)).toEqual(["novo"]);
  });

  it("na mesma etapa, fica o que tem mais coisa preenchida", () => {
    const [fica] = ordenarPorQuemFica([
      card({ id: "vazio", ordemEtapa: 1 }),
      card({ id: "cheio", ordemEtapa: 1, valor: "R$ 2.000", responsavel: "Bruno" }),
    ]);
    expect(fica.id).toBe("cheio");
  });

  it("empate total resolve sempre do mesmo jeito", () => {
    const a = ordenarPorQuemFica([card({ id: "b" }), card({ id: "a" })]).map((c) => c.id);
    const b = ordenarPorQuemFica([card({ id: "a" }), card({ id: "b" })]).map((c) => c.id);
    expect(a).toEqual(b);
    expect(a[0]).toBe("a");
  });

  it("negócio já fechado pesa mais que um aberto na mesma etapa", () => {
    const [fica] = ordenarPorQuemFica([
      card({ id: "aberto", ordemEtapa: 2 }),
      card({ id: "ganho", ordemEtapa: 2, statusFechamento: "ganho" }),
    ]);
    expect(fica.id).toBe("ganho");
  });

  it("a etapa vence o preenchimento: trabalho de funil vale mais que campo digitado", () => {
    const [fica] = ordenarPorQuemFica([
      card({ id: "cheio-atras", ordemEtapa: 0, valor: "R$ 9.000", responsavel: "Ana", statusFechamento: "ganho" }),
      card({ id: "vazio-na-frente", ordemEtapa: 4 }),
    ]);
    expect(fica.id).toBe("vazio-na-frente");
  });
});
