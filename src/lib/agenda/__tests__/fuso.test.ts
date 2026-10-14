import { describe, expect, it } from "vitest";

import {
  dataCurta,
  dataIsoEmBrasilia,
  dataPorExtenso,
  hojeEmBrasilia,
  horaEmBrasilia,
} from "../fuso";

/**
 * A virada de dia é o bug que estes testes existem para impedir.
 *
 * O servidor da Vercel roda em UTC. Uma reunião marcada às 23h30 de Brasília chega como
 * `2026-10-21T02:30:00Z` — dia 21 em UTC, dia 20 em Brasília. Se o CRM gravasse o dia de UTC, o
 * cliente receberia "sua reunião é dia 21 às 02:30". Daí a conversão ser sempre explícita.
 */
describe("fuso de Brasília", () => {
  it("converte instante UTC para o relógio de Brasília (UTC-3)", () => {
    const instante = new Date("2026-10-20T17:00:00Z");
    expect(dataIsoEmBrasilia(instante)).toBe("2026-10-20");
    expect(horaEmBrasilia(instante)).toBe("14:00");
  });

  it("mantém o dia anterior quando em UTC já virou (23h30 de Brasília)", () => {
    const instante = new Date("2026-10-21T02:30:00Z");
    expect(dataIsoEmBrasilia(instante)).toBe("2026-10-20");
    expect(horaEmBrasilia(instante)).toBe("23:30");
  });

  it("usa 00:00 para a meia-noite, não 24:00", () => {
    const instante = new Date("2026-10-21T03:00:00Z");
    expect(dataIsoEmBrasilia(instante)).toBe("2026-10-21");
    expect(horaEmBrasilia(instante)).toBe("00:00");
  });

  it("não adianta o ano na virada de 31 de dezembro", () => {
    const instante = new Date("2027-01-01T01:00:00Z");
    expect(dataIsoEmBrasilia(instante)).toBe("2026-12-31");
    expect(horaEmBrasilia(instante)).toBe("22:00");
  });

  it("escreve a data por extenso em português sem cair no dia anterior", () => {
    expect(dataPorExtenso("2026-10-20")).toBe("terça-feira, 20 de outubro");
    expect(dataPorExtenso("2026-01-01")).toBe("quinta-feira, 1 de janeiro");
  });

  it("escreve a data curta com dia, mês e ano", () => {
    expect(dataCurta("2026-10-20")).toBe("20/10/2026");
    expect(dataCurta("2026-01-05")).toBe("05/01/2026");
  });

  it("devolve texto vazio para data inválida, em vez de 'Invalid Date'", () => {
    expect(dataPorExtenso("")).toBe("");
    expect(dataPorExtenso("20/10/2026")).toBe("");
    expect(dataCurta("amanhã")).toBe("");
  });

  it("calcula hoje em Brasília mesmo quando em UTC já é amanhã", () => {
    expect(hojeEmBrasilia(new Date("2026-10-21T00:30:00Z"))).toBe("2026-10-20");
  });
});
