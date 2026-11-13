import { describe, expect, it } from "vitest";

import {
  OFFSET_MAXIMO_HORAS,
  ehOMinutoDoCampo,
  horasDeDeslocamento,
  instanteDoCampo,
  rotuloDoCampoDeData,
} from "@/lib/funil/campo-de-data-do-gatilho";

describe("horasDeDeslocamento", () => {
  it("nulo e quebrado são zero: na hora exata da data", () => {
    expect(horasDeDeslocamento(null)).toBe(0);
    expect(horasDeDeslocamento(undefined)).toBe(0);
    expect(horasDeDeslocamento(Number.NaN)).toBe(0);
  });

  it("negativo é antes e positivo é depois, e os dois valem", () => {
    expect(horasDeDeslocamento(-24)).toBe(-24);
    expect(horasDeDeslocamento(2)).toBe(2);
  });

  it("corta nos dois tetos", () => {
    expect(horasDeDeslocamento(OFFSET_MAXIMO_HORAS + 500)).toBe(OFFSET_MAXIMO_HORAS);
    expect(horasDeDeslocamento(-OFFSET_MAXIMO_HORAS - 500)).toBe(-OFFSET_MAXIMO_HORAS);
  });
});

describe("instanteDoCampo", () => {
  /* `<input type="date">` grava "AAAA-MM-DD", e sem hora a data vale como meia-noite daquele dia. */
  it("data sem hora é meia-noite local", () => {
    const d = instanteDoCampo("2026-03-12", 0)!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("24 horas antes de uma consulta do dia 12 cai na meia-noite do dia 11", () => {
    const d = instanteDoCampo("2026-03-12", -24)!;
    expect(d.getDate()).toBe(11);
    expect(d.getHours()).toBe(0);
  });

  it("2 horas depois soma no mesmo dia", () => {
    const d = instanteDoCampo("2026-03-12", 2)!;
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(2);
  });

  it("aceita data com hora, pro dia em que um campo guardar hora", () => {
    const d = instanteDoCampo("2026-03-12T14:30", -1)!;
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(13);
    expect(d.getMinutes()).toBe(30);
  });

  /*
   * NULO QUER DIZER "ESTE LEAD NÃO ENTRA", nunca "use hoje". Um campo em branco ou escrito à mão
   * errado não pode virar uma mensagem disparada numa data qualquer.
   */
  it("vazio, texto livre e formato brasileiro devolvem nulo", () => {
    for (const ruim of ["", "   ", "12/03/2026", "amanhã", "2026-3-12", null, undefined]) {
      expect(instanteDoCampo(ruim, 0)).toBeNull();
    }
  });

  it("data impossível devolve nulo em vez de rolar pro mês seguinte", () => {
    expect(instanteDoCampo("2026-02-31", 0)).toBeNull();
    expect(instanteDoCampo("2026-13-01", 0)).toBeNull();
  });

  it("29 de fevereiro vale em ano bissexto e não vale em ano comum", () => {
    expect(instanteDoCampo("2028-02-29", 0)).not.toBeNull();
    expect(instanteDoCampo("2026-02-29", 0)).toBeNull();
  });
});

describe("ehOMinutoDoCampo", () => {
  it("bate no minuto exato do alvo", () => {
    expect(ehOMinutoDoCampo("2026-03-12", -24, new Date(2026, 2, 11, 0, 0))).toBe(true);
  });

  it("um minuto antes ou depois não bate", () => {
    expect(ehOMinutoDoCampo("2026-03-12", -24, new Date(2026, 2, 10, 23, 59))).toBe(false);
    expect(ehOMinutoDoCampo("2026-03-12", -24, new Date(2026, 2, 11, 0, 1))).toBe(false);
  });

  it("campo sem data nunca bate", () => {
    expect(ehOMinutoDoCampo("", 0, new Date(2026, 2, 11, 0, 0))).toBe(false);
  });

  it("o ano importa: a mesma data no ano seguinte não dispara", () => {
    expect(ehOMinutoDoCampo("2026-03-12", 0, new Date(2027, 2, 12, 0, 0))).toBe(false);
  });
});

describe("rotuloDoCampoDeData", () => {
  it("diz antes, depois ou na data", () => {
    expect(rotuloDoCampoDeData("Data da consulta", -24)).toBe("24 horas antes de Data da consulta");
    expect(rotuloDoCampoDeData("Data da consulta", 2)).toBe("2 horas depois de Data da consulta");
    expect(rotuloDoCampoDeData("Data da consulta", 0)).toBe("Na data de Data da consulta");
  });

  it("uma hora no singular", () => {
    expect(rotuloDoCampoDeData("Consulta", -1)).toBe("1 hora antes de Consulta");
  });

  it("sem nome de campo, não escreve um rótulo vazio", () => {
    expect(rotuloDoCampoDeData("", -3)).toBe("3 horas antes de um campo de data");
  });
});
