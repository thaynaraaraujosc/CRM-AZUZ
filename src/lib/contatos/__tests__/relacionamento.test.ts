import { describe, expect, it } from "vitest";

import { diasDesde, tempoDeRelacionamento } from "../relacionamento";

const AGORA = new Date("2026-11-05T12:00:00");

describe("há quanto tempo a pessoa é contato", () => {
  it("conta em dias de calendário, não em blocos de 24h", () => {
    // Às 12h de quinta, um contato criado às 23h de quarta é "ontem", e não "hoje" por ter 13h.
    expect(diasDesde(new Date("2026-11-04T23:00:00"), AGORA)).toBe(1);
    expect(diasDesde(new Date("2026-11-05T01:00:00"), AGORA)).toBe(0);
  });

  it("data no futuro conta como hoje", () => {
    // Relógio do navegador atrás do servidor: "há -2 dias" não ajuda ninguém.
    expect(diasDesde(new Date("2026-11-07T12:00:00"), AGORA)).toBe(0);
  });

  it("troca de unidade quando o número deixa de caber na cabeça", () => {
    expect(tempoDeRelacionamento(new Date("2026-11-05T09:00:00"), AGORA)).toBe("hoje");
    expect(tempoDeRelacionamento(new Date("2026-11-04T09:00:00"), AGORA)).toBe("ontem");
    expect(tempoDeRelacionamento(new Date("2026-10-24T09:00:00"), AGORA)).toBe("12 dias");
    expect(tempoDeRelacionamento(new Date("2026-08-05T09:00:00"), AGORA)).toBe("3 meses");
    expect(tempoDeRelacionamento(new Date("2024-11-05T09:00:00"), AGORA)).toBe("2 anos");
  });

  it("sem data, sem resposta inventada", () => {
    expect(tempoDeRelacionamento(null, AGORA)).toBeNull();
    expect(tempoDeRelacionamento("não é data", AGORA)).toBeNull();
  });
});
