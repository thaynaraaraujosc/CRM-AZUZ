import { describe, expect, it } from "vitest";

import { rotuloDeAtividade } from "../atividade";

/**
 * O funil inteiro dizia "Hoje" porque o rótulo era uma string gravada no nascimento do card. Estes
 * testes existem pra travar o comportamento novo: o texto sai da data, não do que ficou escrito.
 */
describe("rótulo de atividade do card", () => {
  const agora = new Date("2026-03-10T14:00:00");

  it("minutos recentes viram 'Agora'", () => {
    expect(rotuloDeAtividade(new Date("2026-03-10T13:58:00"), agora)).toBe("Agora");
  });

  it("dentro da hora mostra os minutos", () => {
    expect(rotuloDeAtividade(new Date("2026-03-10T13:20:00"), agora)).toBe("40 min");
  });

  it("mais cedo no mesmo dia é 'Hoje'", () => {
    expect(rotuloDeAtividade(new Date("2026-03-10T08:00:00"), agora)).toBe("Hoje");
  });

  it("madrugada: 23:50 de ontem visto às 00:30 é '40 min', não 'Ontem'", () => {
    // A tela de Conversas usa dia de calendário, e ali faz sentido: ela separa as bolhas por dia.
    // No card do funil a pergunta é outra: "isto está quente?". Uma conversa de 40 minutos atrás
    // está, e chamá-la de "Ontem" só porque virou a meia-noite faria ela parecer parada.
    expect(rotuloDeAtividade(new Date("2026-03-09T23:50:00"), new Date("2026-03-10T00:30:00"))).toBe("40 min");
  });

  it("ontem de manhã, visto à tarde, é 'Ontem'", () => {
    expect(rotuloDeAtividade(new Date("2026-03-09T09:00:00"), agora)).toBe("Ontem");
  });

  it("na mesma semana conta os dias", () => {
    expect(rotuloDeAtividade(new Date("2026-03-07T10:00:00"), agora)).toBe("3 dias");
  });

  it("passando de uma semana vira a data", () => {
    expect(rotuloDeAtividade(new Date("2026-02-24T10:00:00"), agora)).toBe("24/02");
  });

  it("de outro ano leva o ano junto", () => {
    expect(rotuloDeAtividade(new Date("2025-12-24T10:00:00"), agora)).toBe("24/12/25");
  });

  it("sem data nenhuma não inventa", () => {
    expect(rotuloDeAtividade(null, agora)).toBe("-");
    expect(rotuloDeAtividade("data inválida", agora)).toBe("-");
  });

  it("data no futuro não vira número negativo", () => {
    expect(rotuloDeAtividade(new Date("2026-03-10T14:30:00"), agora)).toBe("Agora");
  });
});
