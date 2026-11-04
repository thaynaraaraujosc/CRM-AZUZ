import { describe, expect, it } from "vitest";

import {
  CATEGORIAS_GATILHO,
  dentroDaJanelaDoGatilho,
  ehOMinutoMarcado,
  EVENTO_DO_QUANDO,
  limiteDeSilencio,
  minutoLocal,
  QUANDO_ROTULO,
  quandoAceitos,
  QUANDOS_DE_ENTRADA,
  QUANDOS_VARRIDOS,
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

  it("todo gatilho tem quem o acione: entrada na etapa, varredura, ou um evento do CRM", () => {
    /*
     * A REGRA QUE IMPEDE O PIOR DEFEITO: um gatilho que existe na tela e nunca acontece.
     *
     * São três formas de acontecer, e todo `quando` precisa estar em exatamente uma delas. Quem
     * entra na etapa é disparado por quem moveu o card; os de relógio são encontrados pela
     * varredura do cron; o resto depende de um evento do CRM, e a tabela diz qual.
     */
    const todos = Object.keys(QUANDO_ROTULO) as QuandoGatilho[];
    for (const q of todos) {
      const formas = [
        QUANDOS_DE_ENTRADA.includes(q),
        QUANDOS_VARRIDOS.includes(q),
        Boolean(EVENTO_DO_QUANDO[q]),
      ].filter(Boolean);
      expect(formas.length, `"${q}" não tem quem o acione (ou tem mais de um)`).toBe(1);
    }
  });
});

describe("gatilhos de relógio da etapa", () => {
  it("a data e hora marcadas valem no MINUTO delas, e só nele", () => {
    const marcado = "2026-11-04T22:33";
    expect(ehOMinutoMarcado(marcado, new Date(2026, 10, 4, 22, 33))).toBe(true);
    // Um segundo depois ainda é o mesmo minuto: a batida do cron não cai no segundo zero.
    expect(ehOMinutoMarcado(marcado, new Date(2026, 10, 4, 22, 33, 59))).toBe(true);
    expect(ehOMinutoMarcado(marcado, new Date(2026, 10, 4, 22, 34))).toBe(false);
    expect(ehOMinutoMarcado(marcado, new Date(2026, 10, 5, 22, 33))).toBe(false);
  });

  it("aceita o texto com segundos, que alguns navegadores mandam", () => {
    expect(ehOMinutoMarcado("2026-11-04T22:33:00", new Date(2026, 10, 4, 22, 33))).toBe(true);
  });

  it("sem data marcada, nunca é a hora", () => {
    expect(ehOMinutoMarcado(null, new Date())).toBe(false);
    expect(ehOMinutoMarcado("", new Date())).toBe(false);
  });

  it("o minuto é escrito em hora LOCAL, igual ao campo da tela", () => {
    // `toISOString` daria UTC e o gatilho das 22:33 dispararia três horas fora. Este é o ponto da
    // função existir em vez de cada lado formatar do seu jeito.
    expect(minutoLocal(new Date(2026, 10, 4, 22, 33))).toBe("2026-11-04T22:33");
    expect(minutoLocal(new Date(2026, 0, 9, 7, 5))).toBe("2026-01-09T07:05");
  });

  it("o silêncio vira um instante limite, em horas ou em dias", () => {
    const agora = new Date(2026, 10, 4, 12, 0);
    expect(limiteDeSilencio(2, "horas", agora)).toEqual(new Date(2026, 10, 4, 10, 0));
    expect(limiteDeSilencio(3, "dias", agora)).toEqual(new Date(2026, 10, 1, 12, 0));
  });

  it("sem tempo escolhido, o silêncio são duas horas", () => {
    const agora = new Date(2026, 10, 4, 12, 0);
    // Mesmo padrão do gatilho de tempo dos robôs. Zero e negativo caem nele também: um gatilho
    // com prazo zero dispararia pra todo mundo que já falou alguma vez.
    expect(limiteDeSilencio(null, null, agora)).toEqual(new Date(2026, 10, 4, 10, 0));
    expect(limiteDeSilencio(0, "horas", agora)).toEqual(new Date(2026, 10, 4, 10, 0));
  });
});
