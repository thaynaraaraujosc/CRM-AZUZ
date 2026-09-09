import { describe, expect, it } from "vitest";

import {
  CATEGORIAS_GATILHO,
  dentroDaJanelaDoGatilho,
  EVENTO_DO_QUANDO,
  QUANDO_ROTULO,
  quandoAceitos,
  type QuandoGatilho,
} from "../gatilhos-etapa-tipos";

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

  it("os outros acionam só a si mesmos", () => {
    expect(quandoAceitos("responsavel_alterado")).toEqual(["responsavel_alterado"]);
    expect(quandoAceitos("etiqueta_adicionada")).toEqual(["etiqueta_adicionada"]);
    expect(quandoAceitos("saiu")).toEqual(["saiu"]);
  });
});

describe("o menu de gatilhos", () => {
  it("todo gatilho aparece em alguma categoria", () => {
    // Sem isto, um gatilho novo entraria no tipo e ficaria invisível na tela: existiria no motor
    // e não teria como ser escolhido.
    const noMenu = CATEGORIAS_GATILHO.flatMap((c) => c.quandos);
    const todos = Object.keys(QUANDO_ROTULO) as QuandoGatilho[];
    expect([...noMenu].sort()).toEqual([...todos].sort());
  });

  it("nenhum gatilho aparece em duas categorias", () => {
    const noMenu = CATEGORIAS_GATILHO.flatMap((c) => c.quandos);
    expect(new Set(noMenu).size).toBe(noMenu.length);
  });

  it("os gatilhos que não são de etapa têm um evento do CRM que os aciona", () => {
    // O contrário é o defeito que essa tabela existe pra impedir: oferecer na tela um gatilho que
    // o servidor nunca dispara, e a pessoa monta a automação e fica esperando.
    const deEntrada: QuandoGatilho[] = ["movido", "criado", "movido_ou_criado", "diariamente"];
    const todos = Object.keys(QUANDO_ROTULO) as QuandoGatilho[];
    for (const q of todos.filter((x) => !deEntrada.includes(x))) {
      expect(EVENTO_DO_QUANDO[q], `"${q}" não tem evento do CRM`).toBeTruthy();
    }
  });
});
