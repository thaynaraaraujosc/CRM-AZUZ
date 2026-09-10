import { describe, expect, it } from "vitest";

import { rotuloDeConversa } from "../datas";

/**
 * A caixa de entrada mostrava "16h" e "7 dias", e os dois enganavam. "16h" se lê como "às 16
 * horas" ou como "16 horas atrás", e um arredondamento em cima de dias fazia 36 horas virarem "2
 * dias": mensagem de ontem à noite aparecia como anteontem.
 */
const agora = new Date(2026, 8, 10, 16, 30); // 10 de setembro de 2026, 16h30

describe("horário da conversa na caixa de entrada", () => {
  it("mensagem de hoje mostra a hora", () => {
    expect(rotuloDeConversa(new Date(2026, 8, 10, 9, 5), agora)).toBe("09:05");
  });

  it("ontem à noite é Ontem, não dois dias", () => {
    // 18 horas de diferença, e mesmo assim é ontem: o que conta é o dia do calendário.
    expect(rotuloDeConversa(new Date(2026, 8, 9, 22, 40), agora)).toBe("Ontem");
  });

  it("mais pra trás mostra a data", () => {
    expect(rotuloDeConversa(new Date(2026, 8, 3, 10, 0), agora)).toBe("03/09");
  });

  it("de outro ano mostra o ano junto", () => {
    expect(rotuloDeConversa(new Date(2025, 11, 24, 10, 0), agora)).toBe("24/12/25");
  });

  it("relógio adiantado não vira data negativa", () => {
    expect(rotuloDeConversa(new Date(2026, 8, 10, 23, 59), agora)).toBe("23:59");
  });
});
