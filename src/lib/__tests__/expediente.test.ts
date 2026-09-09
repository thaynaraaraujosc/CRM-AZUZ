import { describe, expect, it } from "vitest";

import {
  dentroDoExpediente,
  proximaAbertura,
  somarMinutosUteis,
  type Expediente,
} from "../expediente";

/** Comercial de segunda a sexta, mais sábado de manhã. */
const comercial: Expediente = {
  dias: {
    "1": { de: "08:00", ate: "18:00" },
    "2": { de: "08:00", ate: "18:00" },
    "3": { de: "08:00", ate: "18:00" },
    "4": { de: "08:00", ate: "18:00" },
    "5": { de: "08:00", ate: "18:00" },
    "6": { de: "08:00", ate: "12:00" },
  },
  fuso: "America/Sao_Paulo",
};

/** 2026-09-11 é uma sexta-feira. */
const sexta = (h: number, m = 0) => new Date(2026, 8, 11, h, m);
const sabado = (h: number, m = 0) => new Date(2026, 8, 12, h, m);
const domingo = (h: number, m = 0) => new Date(2026, 8, 13, h, m);
const segunda = (h: number, m = 0) => new Date(2026, 8, 14, h, m);

describe("estamos abertos?", () => {
  it("dentro da faixa, sim", () => {
    expect(dentroDoExpediente(comercial, sexta(10))).toBe(true);
  });

  it("antes de abrir e depois de fechar, não", () => {
    expect(dentroDoExpediente(comercial, sexta(7, 59))).toBe(false);
    expect(dentroDoExpediente(comercial, sexta(18))).toBe(false);
  });

  it("dia que não está na lista está fechado", () => {
    expect(dentroDoExpediente(comercial, domingo(10))).toBe(false);
  });
});

describe("próxima abertura", () => {
  it("depois de fechar na sexta, é sábado de manhã", () => {
    const abre = proximaAbertura(comercial, sexta(19));
    expect(abre?.getDate()).toBe(12);
    expect(abre?.getHours()).toBe(8);
  });

  it("no domingo, pula pra segunda", () => {
    const abre = proximaAbertura(comercial, domingo(10));
    expect(abre?.getDate()).toBe(14);
  });

  it("com o expediente aberto agora, a próxima abertura é agora", () => {
    const agora = sexta(10);
    expect(proximaAbertura(comercial, agora)?.getTime()).toBe(agora.getTime());
  });

  it("expediente sem nenhum dia aberto não tem próxima abertura", () => {
    // Devolver uma data qualquer aqui faria a automação parada acordar num momento arbitrário.
    expect(proximaAbertura({ dias: {}, fuso: "America/Sao_Paulo" }, sexta(10))).toBeNull();
  });
});

describe("somar minutos úteis", () => {
  it("dentro do mesmo dia, é soma simples", () => {
    const fim = somarMinutosUteis(comercial, sexta(9), 120);
    expect(fim?.getHours()).toBe(11);
  });

  it("atravessa o fechamento e continua no próximo dia aberto", () => {
    // Este é o caso que a função existe pra resolver: 2 horas às 17h20 de sexta não terminam às
    // 19h20 de sexta (fechado), terminam no sábado de manhã.
    const fim = somarMinutosUteis(comercial, sexta(17, 20), 120);
    expect(fim?.getDate()).toBe(12);
    expect(fim?.getHours()).toBe(9);
    expect(fim?.getMinutes()).toBe(20);
  });

  it("começando fora do expediente, conta a partir da abertura", () => {
    const fim = somarMinutosUteis(comercial, domingo(22), 60);
    expect(fim?.getDate()).toBe(14);
    expect(fim?.getHours()).toBe(9);
  });

  it("pula o domingo inteiro", () => {
    // Sábado 11h + 3h úteis: sobra 1h no sábado, o resto vai pra segunda.
    const fim = somarMinutosUteis(comercial, sabado(11), 180);
    expect(fim?.getDate()).toBe(14);
    expect(fim?.getHours()).toBe(10);
  });

  it("zero minuto é agora", () => {
    const agora = segunda(10);
    expect(somarMinutosUteis(comercial, agora, 0)?.getTime()).toBe(agora.getTime());
  });

  it("sem dia aberto, não há quando terminar", () => {
    expect(somarMinutosUteis({ dias: {}, fuso: "America/Sao_Paulo" }, sexta(10), 60)).toBeNull();
  });
});
