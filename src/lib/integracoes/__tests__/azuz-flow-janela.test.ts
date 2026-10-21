import { describe, expect, it } from "vitest";

import { JANELA_PADRAO, minutosDoRelogio, quandoEnviar } from "../azuz-flow-janela";

/**
 * Mensagem automática às 3 da manhã é o que faz alguém denunciar o número — e denúncia é o que
 * bloqueia a conta da agência. A janela não é cortesia: é o que protege o ativo.
 *
 * O relógio e o sorteio entram por parâmetro de propósito: é o que torna a madrugada e a virada de
 * dia prováveis sem esperar meia-noite.
 */

/** 20/10/2026 às 10:00 em Brasília = 13:00 UTC. */
const MANHA = new Date("2026-10-20T13:00:00.000Z");
/** 20/10/2026 às 03:00 em Brasília = 06:00 UTC. */
const MADRUGADA = new Date("2026-10-20T06:00:00.000Z");
/** 20/10/2026 às 22:30 em Brasília = 21/10 01:30 UTC. */
const NOITE = new Date("2026-10-21T01:30:00.000Z");

const DAQUI_A_DIAS = new Date("2026-10-25T13:00:00.000Z");

describe("dentro da janela", () => {
  it("sai logo, só com o atraso sorteado", () => {
    const r = quandoEnviar({
      agora: MANHA,
      janela: JANELA_PADRAO,
      inicioDaReuniao: DAQUI_A_DIAS,
      atrasoMs: 30_000,
    });

    expect(r.pode).toBe(true);
    if (r.pode) expect(r.enviarApos.getTime()).toBe(MANHA.getTime() + 30_000);
  });
});

describe("fora da janela", () => {
  it("de madrugada, espera abrir NO MESMO DIA", () => {
    // Somar 24h aqui seria adiar em um dia uma mensagem que podia sair daqui a cinco horas.
    const r = quandoEnviar({ agora: MADRUGADA, janela: JANELA_PADRAO, inicioDaReuniao: DAQUI_A_DIAS, atrasoMs: 0 });

    expect(r.pode).toBe(true);
    // 03:00 + 5h = 08:00 de Brasília, que é 11:00 UTC.
    if (r.pode) expect(r.enviarApos.toISOString()).toBe("2026-10-20T11:00:00.000Z");
  });

  it("depois de fechar, espera abrir NO DIA SEGUINTE", () => {
    const r = quandoEnviar({ agora: NOITE, janela: JANELA_PADRAO, inicioDaReuniao: DAQUI_A_DIAS, atrasoMs: 0 });

    expect(r.pode).toBe(true);
    // 22:30 do dia 20 → 08:00 do dia 21 em Brasília = 11:00 UTC do dia 21.
    if (r.pode) expect(r.enviarApos.toISOString()).toBe("2026-10-21T11:00:00.000Z");
  });

  it("o fim da janela é exclusivo: 21:00 em ponto já está fora", () => {
    // 21:00 de Brasília = 00:00 UTC do dia seguinte.
    const r = quandoEnviar({
      agora: new Date("2026-10-21T00:00:00.000Z"),
      janela: JANELA_PADRAO,
      inicioDaReuniao: DAQUI_A_DIAS,
      atrasoMs: 0,
    });

    if (r.pode) expect(r.enviarApos.toISOString()).toBe("2026-10-21T11:00:00.000Z");
  });

  it("janela personalizada é respeitada", () => {
    const r = quandoEnviar({
      agora: MANHA,
      janela: { inicio: "14:00", fim: "18:00" },
      inicioDaReuniao: DAQUI_A_DIAS,
      atrasoMs: 0,
    });

    // 10:00 → 14:00 de Brasília = 17:00 UTC.
    if (r.pode) expect(r.enviarApos.toISOString()).toBe("2026-10-20T17:00:00.000Z");
  });
});

describe("o limite que vence os outros", () => {
  it("reunião que já começou não recebe confirmação", () => {
    const r = quandoEnviar({
      agora: MANHA,
      janela: JANELA_PADRAO,
      inicioDaReuniao: new Date(MANHA.getTime() - 60_000),
      atrasoMs: 0,
    });

    expect(r).toEqual({ pode: false, motivo: "Confirmação não enviada: a reunião já havia começado." });
  });

  it("janela que só abriria depois da reunião é recusa, não adiamento", () => {
    /*
     * Madrugada, reunião às 6h: a janela abre às 8h. Enfileirar seria prometer uma mensagem que
     * sairia duas horas depois de a pessoa já ter entrado na reunião — pior que não mandar, porque
     * fica na fila parecendo resolvido.
     */
    const r = quandoEnviar({
      agora: MADRUGADA,
      janela: JANELA_PADRAO,
      inicioDaReuniao: new Date("2026-10-20T09:00:00.000Z"),
      atrasoMs: 0,
    });

    expect(r.pode).toBe(false);
    if (!r.pode) expect(r.motivo).toContain("só abriria depois do início da reunião");
  });
});

describe("o relógio escrito", () => {
  it("lê o que é válido", () => {
    expect(minutosDoRelogio("08:00")).toBe(480);
    expect(minutosDoRelogio("21:30")).toBe(1290);
    expect(minutosDoRelogio("00:00")).toBe(0);
  });

  it("recusa o que não é hora, pra quem chama cair no padrão", () => {
    for (const ruim of ["25:00", "08:70", "8h", "", "oito"]) {
      expect(minutosDoRelogio(ruim)).toBeNull();
    }
  });

  it("janela com horário inválido cai no padrão em vez de travar a fila", () => {
    const r = quandoEnviar({
      agora: MADRUGADA,
      janela: { inicio: "banana", fim: "21:00" },
      inicioDaReuniao: DAQUI_A_DIAS,
      atrasoMs: 0,
    });

    // Caiu no 08:00 padrão.
    if (r.pode) expect(r.enviarApos.toISOString()).toBe("2026-10-20T11:00:00.000Z");
  });
});
