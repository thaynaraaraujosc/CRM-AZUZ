import { describe, expect, it } from "vitest";

import {
  formatarEspera,
  medianaDeMinutos,
  minutosAtePrimeiraResposta,
  tomDaEspera,
} from "@/lib/trafego/tempo-de-resposta";

/** Horário relativo a um instante fixo, em minutos, pra os testes lerem como a conversa aconteceu. */
const BASE = new Date("2026-11-12T09:00:00.000Z");
const aos = (minutos: number) => new Date(BASE.getTime() + minutos * 60_000);

describe("minutosAtePrimeiraResposta", () => {
  it("mede da primeira mensagem do lead até a primeira resposta da empresa", () => {
    expect(
      minutosAtePrimeiraResposta([
        { tipo: "in", em: aos(0) },
        { tipo: "out", em: aos(12) },
        { tipo: "in", em: aos(20) },
        { tipo: "out", em: aos(21) },
      ]),
    ).toBe(12);
  });

  it("não depende da ordem em que as mensagens chegam da consulta", () => {
    expect(
      minutosAtePrimeiraResposta([
        { tipo: "out", em: aos(40) },
        { tipo: "in", em: aos(10) },
        { tipo: "out", em: aos(15) },
      ]),
    ).toBe(5);
  });

  it("lead sem resposta é null, não é zero — e é o caso que a tela conta à parte", () => {
    /*
     * O erro que este teste tranca: tratar "ninguém respondeu" como espera 0 faria a campanha com
     * mais leads ignorados aparecer como a mais bem atendida da tabela.
     */
    expect(minutosAtePrimeiraResposta([{ tipo: "in", em: aos(0) }])).toBeNull();
  });

  it("mensagem da empresa ANTES do lead não conta como resposta", () => {
    // Disparo ativo: a empresa escreveu, a pessoa respondeu depois. Medir daqui daria o tempo de
    // resposta DELA, que é outra coisa — e entraria na média como se fosse atendimento lento.
    expect(
      minutosAtePrimeiraResposta([
        { tipo: "out", em: aos(0) },
        { tipo: "in", em: aos(30) },
      ]),
    ).toBeNull();
  });

  it("depois de um disparo ativo, a resposta seguinte da empresa conta normalmente", () => {
    expect(
      minutosAtePrimeiraResposta([
        { tipo: "out", em: aos(0) }, // template
        { tipo: "in", em: aos(30) }, // o lead respondeu
        { tipo: "out", em: aos(33) }, // e a empresa voltou: ESTE é o atendimento
      ]),
    ).toBe(3);
  });

  it("automação gravada no mesmo instante da entrada não vira 'zero minuto'", () => {
    const mesmoInstante = aos(0);
    expect(
      minutosAtePrimeiraResposta([
        { tipo: "in", em: mesmoInstante },
        { tipo: "out", em: mesmoInstante },
      ]),
    ).toBeNull();
  });

  it("mensagem sem horário é ignorada em vez de quebrar a conta", () => {
    expect(
      minutosAtePrimeiraResposta([
        { tipo: "in", em: null },
        { tipo: "in", em: aos(0) },
        { tipo: "out", em: aos(7) },
      ]),
    ).toBe(7);
  });

  it("conversa vazia não produz número", () => {
    expect(minutosAtePrimeiraResposta([])).toBeNull();
  });
});

describe("medianaDeMinutos", () => {
  it("um único atraso enorme não contamina o resultado — é por isso que não é média", () => {
    const esperas = [3, 4, 5, 6, 3600]; // o lead de sexta à noite respondido na segunda
    expect(medianaDeMinutos(esperas)).toBe(5);
    // A média seria 723: a tabela diria que esta campanha demora 12 horas pra ser atendida.
    const media = esperas.reduce((s, v) => s + v, 0) / esperas.length;
    expect(Math.round(media)).toBe(724);
  });

  it("lista par usa os dois centrais", () => {
    expect(medianaDeMinutos([2, 10])).toBe(6);
  });

  it("lista vazia é null", () => {
    expect(medianaDeMinutos([])).toBeNull();
  });
});

describe("formatarEspera", () => {
  it("escreve como alguém diria em voz alta", () => {
    expect(formatarEspera(0)).toBe("na hora");
    expect(formatarEspera(12)).toBe("12 min");
    expect(formatarEspera(60)).toBe("1h");
    expect(formatarEspera(73)).toBe("1h13");
    expect(formatarEspera(1440)).toBe("1 dia");
    expect(formatarEspera(3600)).toBe("2d 12h");
  });

  it("sem medida nenhuma, traço — nunca zero", () => {
    expect(formatarEspera(null)).toBe("—");
    expect(formatarEspera(undefined)).toBe("—");
  });
});

describe("tomDaEspera", () => {
  it("cinco minutos é o corte do lead quente; uma hora é o da concorrência", () => {
    expect(tomDaEspera(4)).toBe("bom");
    expect(tomDaEspera(5)).toBe("bom");
    expect(tomDaEspera(6)).toBe("atencao");
    expect(tomDaEspera(60)).toBe("atencao");
    expect(tomDaEspera(61)).toBe("ruim");
  });

  it("sem medida não há tom: ausência de dado não é um juízo", () => {
    expect(tomDaEspera(null)).toBeNull();
  });
});
