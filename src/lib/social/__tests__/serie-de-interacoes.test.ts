import { describe, expect, it } from "vitest";

import {
  agrupamentosPossiveis,
  agrupar,
  baldesVazios,
  montarSerie,
  segundaDaSemana,
} from "../serie-de-interacoes";

describe("baldesVazios", () => {
  it("abre 24 baldes de hora, de 00 a 23", () => {
    const baldes = baldesVazios("hora", "2026-11-04", "2026-11-04");
    expect(baldes.size).toBe(24);
    expect([...baldes.keys()][0]).toBe("00");
    expect([...baldes.keys()][23]).toBe("23");
    expect([...baldes.values()].every((v) => v === 0)).toBe(true);
  });

  it("abre um balde por dia, inclusive o primeiro e o último", () => {
    const baldes = baldesVazios("dia", "2026-10-29", "2026-11-04");
    expect([...baldes.keys()]).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("atravessa a virada do ano sem pular dia", () => {
    expect([...baldesVazios("dia", "2026-12-30", "2027-01-02").keys()]).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });
});

describe("montarSerie", () => {
  it("conta cada interação no dia dela, e deixa zero onde não houve nenhuma", () => {
    const serie = montarSerie(
      [
        new Date("2026-11-03T14:00:00Z"),
        new Date("2026-11-03T15:30:00Z"),
        new Date("2026-11-04T10:00:00Z"),
      ],
      "dia",
      "2026-11-02",
      "2026-11-04",
    );
    expect(serie).toEqual([
      { chave: "2026-11-02", total: 0 },
      { chave: "2026-11-03", total: 2 },
      { chave: "2026-11-04", total: 1 },
    ]);
  });

  /*
   * O caso que justifica o módulo inteiro. O servidor roda em UTC: 23h de Brasília é 02h do DIA
   * SEGUINTE em UTC. Contado pelo relógio do servidor, tudo que chega à noite cai no dia errado.
   */
  it("conta a noite de Brasília no dia de Brasília, e não no dia UTC", () => {
    const serie = montarSerie(
      [new Date("2026-11-04T02:00:00Z")], // 23h do dia 3 em Brasília
      "dia",
      "2026-11-03",
      "2026-11-04",
    );
    expect(serie).toEqual([
      { chave: "2026-11-03", total: 1 },
      { chave: "2026-11-04", total: 0 },
    ]);
  });

  it("por hora, usa a hora de Brasília", () => {
    const serie = montarSerie([new Date("2026-11-04T16:20:00Z")], "hora", "2026-11-04", "2026-11-04");
    expect(serie.find((p) => p.chave === "13")).toEqual({ chave: "13", total: 1 });
    expect(serie.filter((p) => p.total > 0)).toHaveLength(1);
  });

  it("ignora interação fora do recorte em vez de criar balde solto", () => {
    const serie = montarSerie(
      [new Date("2026-10-01T12:00:00Z")],
      "dia",
      "2026-11-03",
      "2026-11-04",
    );
    expect(serie.every((p) => p.total === 0)).toBe(true);
    expect(serie).toHaveLength(2);
  });

  it("o total da série bate com o número de interações dentro do recorte", () => {
    const instantes = [
      new Date("2026-11-03T13:00:00Z"),
      new Date("2026-11-03T18:00:00Z"),
      new Date("2026-11-04T13:00:00Z"),
      new Date("2026-11-04T19:00:00Z"),
    ];
    const serie = montarSerie(instantes, "dia", "2026-11-01", "2026-11-04");
    expect(serie.reduce((s, p) => s + p.total, 0)).toBe(instantes.length);
  });
});

describe("segundaDaSemana", () => {
  it("devolve a própria data quando já é segunda", () => {
    expect(segundaDaSemana("2026-11-02")).toBe("2026-11-02");
  });

  it("puxa o domingo pra segunda ANTERIOR, e não pra seguinte", () => {
    // 2026-11-01 é domingo: pertence à semana que começou em 26/10.
    expect(segundaDaSemana("2026-11-01")).toBe("2026-10-26");
  });

  it("agrupa a semana inteira na mesma segunda", () => {
    const semana = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];
    expect(new Set(semana.map(segundaDaSemana))).toEqual(new Set(["2026-11-02"]));
  });
});

describe("agrupamentosPossiveis", () => {
  it("num período de um dia só oferece a hora", () => {
    expect(agrupamentosPossiveis("hora", 1)).toEqual(["hora"]);
  });

  it("não oferece semana numa semana, nem mês num mês", () => {
    expect(agrupamentosPossiveis("dia", 7)).toEqual(["dia"]);
    expect(agrupamentosPossiveis("dia", 30)).toEqual(["dia", "semana"]);
  });

  it("oferece os três no trimestre", () => {
    expect(agrupamentosPossiveis("dia", 90)).toEqual(["dia", "semana", "mes"]);
  });
});

describe("agrupar", () => {
  const dias = [
    { chave: "2026-11-01", total: 1 }, // domingo
    { chave: "2026-11-02", total: 2 }, // segunda
    { chave: "2026-11-03", total: 3 },
    { chave: "2026-11-04", total: 4 },
  ];

  it("por dia, mantém um ponto por dia e rotula com dia/mês", () => {
    const pontos = agrupar(dias, "dia");
    expect(pontos).toHaveLength(4);
    expect(pontos[3].rotulo).toBe("04/11");
  });

  it("por semana, o domingo vai pra semana anterior", () => {
    const pontos = agrupar(dias, "semana");
    expect(pontos.map((p) => p.chave)).toEqual(["2026-10-26", "2026-11-02"]);
    expect(pontos[0].total).toBe(1);
    expect(pontos[1].total).toBe(9);
  });

  it("por mês, soma o mês inteiro", () => {
    const pontos = agrupar([...dias, { chave: "2026-10-31", total: 5 }], "mes");
    expect(pontos.find((p) => p.chave === "2026-11")?.total).toBe(10);
    expect(pontos.find((p) => p.chave === "2026-10")?.total).toBe(5);
  });

  it("agrupar nunca perde nem inventa interação", () => {
    const total = dias.reduce((s, p) => s + p.total, 0);
    for (const modo of ["dia", "semana", "mes"] as const) {
      expect(agrupar(dias, modo).reduce((s, p) => s + p.total, 0)).toBe(total);
    }
  });

  it("por hora, rotula com a hora e diz o intervalo no título", () => {
    const pontos = agrupar([{ chave: "13", total: 2 }], "hora");
    expect(pontos[0].rotulo).toBe("13h");
    expect(pontos[0].titulo).toBe("13:00 às 13:59");
  });
});
