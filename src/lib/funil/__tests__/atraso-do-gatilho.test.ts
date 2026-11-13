import { describe, expect, it } from "vitest";

import {
  ATALHOS_DE_ATRASO,
  ATRASO_MAXIMO_MINUTOS,
  ehAtalho,
  intervaloEmHorasEMinutos,
  minutosDeAtraso,
  minutosDoIntervalo,
  quandoRodar,
  rotuloDoAtraso,
} from "@/lib/funil/atraso-do-gatilho";

describe("minutosDeAtraso", () => {
  /*
   * ZERO É O PADRÃO, E ISSO É COMPATIBILIDADE, NÃO PREFERÊNCIA. Todo gatilho gravado antes desta
   * coluna existir tem `atrasoMinutos` nulo, e todos eles rodavam na hora. Nulo precisa continuar
   * querendo dizer exatamente isso, senão a coluna nova muda o comportamento de automações que
   * ninguém tocou.
   */
  it("ausente, nulo ou quebrado é imediatamente", () => {
    expect(minutosDeAtraso(null)).toBe(0);
    expect(minutosDeAtraso(undefined)).toBe(0);
    expect(minutosDeAtraso(Number.NaN)).toBe(0);
    expect(minutosDeAtraso(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("negativo é imediatamente, não um gatilho que roda no passado", () => {
    expect(minutosDeAtraso(-5)).toBe(0);
  });

  it("quebrado vira inteiro pra baixo: meio minuto não é unidade de agendamento", () => {
    expect(minutosDeAtraso(5.9)).toBe(5);
  });

  it("acima do teto fica no teto: trinta dias já não é automação de etapa", () => {
    expect(minutosDeAtraso(ATRASO_MAXIMO_MINUTOS + 1)).toBe(ATRASO_MAXIMO_MINUTOS);
    expect(minutosDeAtraso(999_999)).toBe(ATRASO_MAXIMO_MINUTOS);
  });
});

describe("minutosDoIntervalo", () => {
  it("soma horas e minutos", () => {
    expect(minutosDoIntervalo(1, 30)).toBe(90);
    expect(minutosDoIntervalo(2, 0)).toBe(120);
    expect(minutosDoIntervalo(0, 45)).toBe(45);
  });

  it("campo vazio conta como zero, não trava o outro", () => {
    expect(minutosDoIntervalo("", 20)).toBe(20);
    expect(minutosDoIntervalo(3, "")).toBe(180);
    expect(minutosDoIntervalo("", "")).toBe(0);
  });

  it("texto que não é número não vira NaN", () => {
    expect(minutosDoIntervalo("abc", "x")).toBe(0);
  });

  it("volta pros dois campos sem perder nada", () => {
    for (const total of [0, 5, 45, 60, 90, 1440, 1505]) {
      const { horas, minutos } = intervaloEmHorasEMinutos(total);
      expect(minutosDoIntervalo(horas, minutos)).toBe(total);
    }
  });
});

describe("rotuloDoAtraso", () => {
  it("os atalhos falam o nome deles", () => {
    expect(rotuloDoAtraso(0)).toBe("Imediatamente");
    expect(rotuloDoAtraso(5)).toBe("Depois de 5 minutos");
    expect(rotuloDoAtraso(10)).toBe("Depois de 10 minutos");
    expect(rotuloDoAtraso(1440)).toBe("Um dia");
  });

  /* Quem escolheu uma hora e meia não quer ler "depois de 90 minutos". */
  it("intervalo escrito à mão vira hora e minuto, não um monte de minutos", () => {
    expect(rotuloDoAtraso(90)).toBe("Depois de 1h30");
    expect(rotuloDoAtraso(120)).toBe("Depois de 2h");
    expect(rotuloDoAtraso(45)).toBe("Depois de 45 min");
    expect(rotuloDoAtraso(125)).toBe("Depois de 2h05");
  });

  it("nulo é imediatamente, como todo gatilho antigo", () => {
    expect(rotuloDoAtraso(null)).toBe("Imediatamente");
  });
});

describe("ehAtalho", () => {
  it("separa o que a lista oferece do que foi digitado", () => {
    expect(ehAtalho(0)).toBe(true);
    expect(ehAtalho(10)).toBe(true);
    expect(ehAtalho(1440)).toBe(true);
    expect(ehAtalho(90)).toBe(false);
  });

  it("todo atalho da lista é reconhecido como atalho", () => {
    for (const a of ATALHOS_DE_ATRASO) expect(ehAtalho(a.minutos)).toBe(true);
  });
});

describe("quandoRodar", () => {
  it("soma o atraso ao instante da entrada", () => {
    const entrou = new Date("2026-03-10T14:00:00Z");
    expect(quandoRodar(entrou, 5).toISOString()).toBe("2026-03-10T14:05:00.000Z");
    expect(quandoRodar(entrou, 1440).toISOString()).toBe("2026-03-11T14:00:00.000Z");
  });

  it("sem atraso, roda no mesmo instante", () => {
    const entrou = new Date("2026-03-10T14:00:00Z");
    expect(quandoRodar(entrou, 0).getTime()).toBe(entrou.getTime());
    expect(quandoRodar(entrou, null).getTime()).toBe(entrou.getTime());
  });
});
