import { describe, expect, it } from "vitest";

import {
  deveRodarAgora,
  repeticaoGravada,
  rotuloDaRepeticao,
} from "@/lib/funil/repeticao-do-gatilho";

/** Hora LOCAL, que é como a varredura compara: o horário é o do relógio de quem marcou. */
function em(iso: string): Date {
  return new Date(iso);
}

describe("repeticaoGravada", () => {
  /* Compatibilidade: todo gatilho programado gravado antes desta coluna repete todo dia. */
  it("nulo, vazio ou desconhecido é diária", () => {
    expect(repeticaoGravada(null)).toBe("diaria");
    expect(repeticaoGravada("")).toBe("diaria");
    expect(repeticaoGravada("quinzenal")).toBe("diaria");
  });
});

describe("deveRodarAgora — a hora manda em todas", () => {
  it("minuto diferente não roda, em nenhuma repetição", () => {
    const agora = em("2026-03-10T12:01:00");
    for (const repeticao of ["diaria", "semanal", "mensal", "anual"]) {
      expect(
        deveRodarAgora(
          { repeticao, horarioDiario: "12:00", diasAtivos: [2], diaDoMes: 10, dataAnual: "03-10" },
          agora,
        ),
      ).toBe(false);
    }
  });

  it("sem hora nenhuma, nada roda: o gatilho não tem quando", () => {
    expect(deveRodarAgora({ repeticao: "diaria", horarioDiario: null }, em("2026-03-10T12:00:00"))).toBe(false);
  });
});

describe("diária", () => {
  it("roda todo dia na hora marcada", () => {
    for (const dia of ["2026-03-09", "2026-03-10", "2026-03-15"]) {
      expect(deveRodarAgora({ repeticao: "diaria", horarioDiario: "12:00" }, em(`${dia}T12:00:00`))).toBe(true);
    }
  });
});

describe("semanal", () => {
  // 10/03/2026 é uma terça-feira (dia 2).
  it("roda no dia da semana marcado", () => {
    expect(
      deveRodarAgora({ repeticao: "semanal", horarioDiario: "09:00", diasAtivos: [2] }, em("2026-03-10T09:00:00")),
    ).toBe(true);
  });

  it("não roda nos outros dias", () => {
    expect(
      deveRodarAgora({ repeticao: "semanal", horarioDiario: "09:00", diasAtivos: [2] }, em("2026-03-11T09:00:00")),
    ).toBe(false);
  });

  /*
   * `diasAtivos` vazio quer dizer "todos os dias" na JANELA de funcionamento. Herdar esse sentido
   * aqui viraria "uma vez por semana" em "todo dia" — o oposto do pedido.
   */
  it("sem dia escolhido não roda: meia regra não dispara nada", () => {
    expect(
      deveRodarAgora({ repeticao: "semanal", horarioDiario: "09:00", diasAtivos: [] }, em("2026-03-10T09:00:00")),
    ).toBe(false);
    expect(
      deveRodarAgora({ repeticao: "semanal", horarioDiario: "09:00", diasAtivos: null }, em("2026-03-10T09:00:00")),
    ).toBe(false);
  });

  it("aceita mais de um dia", () => {
    const cfg = { repeticao: "semanal", horarioDiario: "09:00", diasAtivos: [1, 3, 5] };
    expect(deveRodarAgora(cfg, em("2026-03-09T09:00:00"))).toBe(true); // segunda
    expect(deveRodarAgora(cfg, em("2026-03-10T09:00:00"))).toBe(false); // terça
    expect(deveRodarAgora(cfg, em("2026-03-11T09:00:00"))).toBe(true); // quarta
  });
});

describe("mensal", () => {
  it("roda no dia do mês marcado", () => {
    expect(deveRodarAgora({ repeticao: "mensal", horarioDiario: "08:00", diaDoMes: 15 }, em("2026-03-15T08:00:00"))).toBe(true);
    expect(deveRodarAgora({ repeticao: "mensal", horarioDiario: "08:00", diaDoMes: 15 }, em("2026-03-14T08:00:00"))).toBe(false);
  });

  /*
   * QUEM ESCOLHEU 31 QUIS DIZER "NO FIM DO MÊS". Pular fevereiro, abril, junho, setembro e
   * novembro seria "uma vez por mês" faltando cinco meses do ano, sem avisar ninguém.
   */
  it("dia 31 roda no último dia dos meses que não têm 31", () => {
    const cfg = { repeticao: "mensal", horarioDiario: "08:00", diaDoMes: 31 };
    expect(deveRodarAgora(cfg, em("2026-02-28T08:00:00"))).toBe(true); // fevereiro de ano comum
    expect(deveRodarAgora(cfg, em("2026-04-30T08:00:00"))).toBe(true); // abril
    expect(deveRodarAgora(cfg, em("2026-03-31T08:00:00"))).toBe(true); // março tem 31
    expect(deveRodarAgora(cfg, em("2026-03-30T08:00:00"))).toBe(false);
  });

  it("fevereiro de ano bissexto usa o dia 29", () => {
    const cfg = { repeticao: "mensal", horarioDiario: "08:00", diaDoMes: 31 };
    expect(deveRodarAgora(cfg, em("2028-02-29T08:00:00"))).toBe(true);
    expect(deveRodarAgora(cfg, em("2028-02-28T08:00:00"))).toBe(false);
  });

  it("sem dia, ou com dia impossível, não roda", () => {
    expect(deveRodarAgora({ repeticao: "mensal", horarioDiario: "08:00" }, em("2026-03-15T08:00:00"))).toBe(false);
    expect(deveRodarAgora({ repeticao: "mensal", horarioDiario: "08:00", diaDoMes: 0 }, em("2026-03-15T08:00:00"))).toBe(false);
    expect(deveRodarAgora({ repeticao: "mensal", horarioDiario: "08:00", diaDoMes: 40 }, em("2026-03-15T08:00:00"))).toBe(false);
  });
});

describe("anual", () => {
  it("roda na data marcada", () => {
    const cfg = { repeticao: "anual", horarioDiario: "10:00", dataAnual: "12-25" };
    expect(deveRodarAgora(cfg, em("2026-12-25T10:00:00"))).toBe(true);
    expect(deveRodarAgora(cfg, em("2026-12-24T10:00:00"))).toBe(false);
    expect(deveRodarAgora(cfg, em("2026-11-25T10:00:00"))).toBe(false);
  });

  it("29 de fevereiro em ano comum roda no dia 28", () => {
    const cfg = { repeticao: "anual", horarioDiario: "10:00", dataAnual: "02-29" };
    expect(deveRodarAgora(cfg, em("2026-02-28T10:00:00"))).toBe(true);
    expect(deveRodarAgora(cfg, em("2028-02-29T10:00:00"))).toBe(true);
    expect(deveRodarAgora(cfg, em("2028-02-28T10:00:00"))).toBe(false);
  });

  it("data mal escrita não roda, em vez de rodar num dia qualquer", () => {
    for (const ruim of ["", "25/12", "2026-12-25", "13-01", "12-00"]) {
      expect(deveRodarAgora({ repeticao: "anual", horarioDiario: "10:00", dataAnual: ruim }, em("2026-12-25T10:00:00"))).toBe(false);
    }
  });
});

describe("rotuloDaRepeticao", () => {
  it("diz o período e a hora", () => {
    expect(rotuloDaRepeticao({ repeticao: "diaria", horarioDiario: "12:00" })).toBe("Diariamente às 12:00");
    expect(rotuloDaRepeticao({ repeticao: "mensal", horarioDiario: "08:00", diaDoMes: 5 })).toBe("Todo dia 5 às 08:00");
    expect(rotuloDaRepeticao({ repeticao: "anual", horarioDiario: "10:00", dataAnual: "12-25" })).toBe("Todo 25/12 às 10:00");
    expect(rotuloDaRepeticao({ repeticao: "semanal", horarioDiario: "09:00", diasAtivos: [1] })).toBe("Toda segunda às 09:00");
  });

  /* Configuração pela metade avisa na própria linha: o cartão é onde ela é lida. */
  it("avisa quando falta escolher o dia", () => {
    expect(rotuloDaRepeticao({ repeticao: "semanal", horarioDiario: "09:00", diasAtivos: [] })).toContain("falta escolher");
    expect(rotuloDaRepeticao({ repeticao: "mensal", horarioDiario: "09:00" })).toContain("falta escolher");
    expect(rotuloDaRepeticao({ repeticao: "anual", horarioDiario: "09:00" })).toContain("falta escolher");
  });
});
