import { describe, expect, it } from "vitest";

import { dentroDaJanelaDoGatilho, quandoAceitos } from "../gatilhos-etapa-tipos";

/** Uma terça-feira, pra os testes de dia da semana não dependerem de quando rodam. */
function terca(hora: number, minuto = 0): Date {
  return new Date(2026, 8, 8, hora, minuto);
}

describe("janela do gatilho de etapa", () => {
  it("sem dia e sem hora, vale sempre", () => {
    expect(dentroDaJanelaDoGatilho({ diasAtivos: null, horaInicio: null, horaFim: null }, terca(3))).toBe(true);
    expect(dentroDaJanelaDoGatilho({ diasAtivos: [], horaInicio: "", horaFim: "" }, terca(23, 59))).toBe(true);
  });

  it("respeita os dias marcados. Domingo é 7 na tela, 0 no JavaScript", () => {
    const so_terca = { diasAtivos: [2], horaInicio: null, horaFim: null };
    expect(dentroDaJanelaDoGatilho(so_terca, terca(10))).toBe(true);
    // 6 de setembro de 2026 é um domingo.
    expect(dentroDaJanelaDoGatilho(so_terca, new Date(2026, 8, 6, 10))).toBe(false);
    expect(
      dentroDaJanelaDoGatilho({ diasAtivos: [7], horaInicio: null, horaFim: null }, new Date(2026, 8, 6, 10)),
    ).toBe(true);
  });

  it("respeita o horário", () => {
    const comercial = { diasAtivos: null, horaInicio: "10:00", horaFim: "19:00" };
    expect(dentroDaJanelaDoGatilho(comercial, terca(9, 59))).toBe(false);
    expect(dentroDaJanelaDoGatilho(comercial, terca(10, 0))).toBe(true);
    expect(dentroDaJanelaDoGatilho(comercial, terca(19, 0))).toBe(true);
    expect(dentroDaJanelaDoGatilho(comercial, terca(19, 1))).toBe(false);
  });

  it("janela que atravessa a meia-noite vale dos dois lados", () => {
    const madrugada = { diasAtivos: null, horaInicio: "22:00", horaFim: "06:00" };
    expect(dentroDaJanelaDoGatilho(madrugada, terca(23))).toBe(true);
    expect(dentroDaJanelaDoGatilho(madrugada, terca(2))).toBe(true);
    expect(dentroDaJanelaDoGatilho(madrugada, terca(12))).toBe(false);
  });
});

describe("quais gatilhos um evento aciona", () => {
  it("mover aciona o de mover e o combinado, nunca o de criar", () => {
    expect(quandoAceitos("movido")).toEqual(["movido", "movido_ou_criado"]);
    expect(quandoAceitos("criado")).toEqual(["criado", "movido_ou_criado"]);
  });

  it("troca de responsável não aciona os de entrada na etapa", () => {
    expect(quandoAceitos("responsavel_alterado")).toEqual(["responsavel_alterado"]);
  });
});
