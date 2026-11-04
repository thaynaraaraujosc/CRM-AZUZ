import { describe, expect, it } from "vitest";

import { TETO_DE_DIAS, recortePedido } from "../recorte-do-periodo";

const HOJE = "2026-11-04";
const pedir = (busca: string) => recortePedido(new URLSearchParams(busca), HOJE);

describe("recortePedido pelas pastilhas", () => {
  it("sem nada na URL, é a semana", () => {
    expect(pedir("")).toEqual({ primeiroDia: "2026-10-29", ultimoDia: HOJE, periodoDias: 7 });
  });

  it("dias=1 é só hoje", () => {
    expect(pedir("dias=1")).toEqual({ primeiroDia: HOJE, ultimoDia: HOJE, periodoDias: 1 });
  });

  it("dias=30 termina hoje e começa 29 dias antes", () => {
    expect(pedir("dias=30")).toEqual({ primeiroDia: "2026-10-06", ultimoDia: HOJE, periodoDias: 30 });
  });

  it("apara pedido maior que o teto e menor que um dia", () => {
    expect(pedir("dias=999").periodoDias).toBe(TETO_DE_DIAS);
    expect(pedir("dias=0").periodoDias).toBe(1);
    expect(pedir("dias=-5").periodoDias).toBe(1);
  });

  it("dias sem número cai na semana em vez de quebrar", () => {
    expect(pedir("dias=ontem").periodoDias).toBe(7);
  });
});

describe("recortePedido por intervalo escolhido", () => {
  it("usa as duas datas como vieram", () => {
    expect(pedir("de=2026-10-01&ate=2026-10-10")).toEqual({
      primeiroDia: "2026-10-01",
      ultimoDia: "2026-10-10",
      periodoDias: 10,
    });
  });

  it("um dia só vale 1, e não 0", () => {
    expect(pedir("de=2026-10-07&ate=2026-10-07").periodoDias).toBe(1);
  });

  /* Não há dado do futuro: dez barras vazias à direita parecem defeito, não resposta. */
  it("nunca passa de hoje", () => {
    expect(pedir("de=2026-11-01&ate=2026-12-31").ultimoDia).toBe(HOJE);
  });

  it("intervalo inteiro no futuro encolhe para hoje", () => {
    const r = pedir("de=2027-01-01&ate=2027-01-10");
    expect(r).toEqual({ primeiroDia: HOJE, ultimoDia: HOJE, periodoDias: 1 });
  });

  it("começo depois do fim não vira intervalo negativo", () => {
    expect(pedir("de=2026-10-20&ate=2026-10-10")).toEqual({
      primeiroDia: "2026-10-10",
      ultimoDia: "2026-10-10",
      periodoDias: 1,
    });
  });

  it("intervalo maior que o teto é cortado pelo COMEÇO, mantendo o fim pedido", () => {
    const r = pedir("de=2020-01-01&ate=2026-10-31");
    expect(r.ultimoDia).toBe("2026-10-31");
    expect(r.periodoDias).toBe(TETO_DE_DIAS);
    expect(r.primeiroDia).toBe("2026-08-03");
  });

  it("data malformada é ignorada e cai nas pastilhas", () => {
    expect(pedir("de=01/10/2026&ate=10/10/2026").periodoDias).toBe(7);
    expect(pedir("de=2026-10-01").periodoDias).toBe(7);
    expect(pedir("ate=2026-10-10&dias=30").periodoDias).toBe(30);
  });
});
