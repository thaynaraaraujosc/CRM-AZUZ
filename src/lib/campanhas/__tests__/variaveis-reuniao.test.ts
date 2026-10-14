import { describe, expect, it } from "vitest";

import {
  mapearVariaveis,
  prepararEnvioDeModelo,
  resolverParametros,
  usaReuniao,
  type ContatoParaVariaveis,
  type MapeamentoVariavel,
} from "../variaveis";

/**
 * As variáveis da reunião: o modelo que a Thaynara quer escrever é
 * "Olá, {{primeiroNome}}! Confirmando a sua reunião para {{data}} às {{hora}}."
 *
 * Então `{{data}}` e `{{hora}}` precisam virar origem da Agenda SOZINHAS. Se a adivinhação falhar,
 * elas ficam como "texto" e a pessoa preenche na mão sem nunca entender por que aquela não puxou.
 */
const ana: ContatoParaVariaveis = {
  nome: "Ana Souza",
  reuniao: { dataIso: "2026-10-20", hora: "14:00", link: "https://meet.google.com/abc-defg-hij" },
};

describe("adivinhação pelo nome da variável", () => {
  it("{{data}}, {{dataCurta}}, {{hora}} e {{link}} viram origens da reunião", () => {
    const v = mapearVariaveis("Reunião {{data}} ({{dataCurta}}) às {{hora}}, entre por {{link}}");
    expect(v.map((x) => x.origem)).toEqual(["reuniao.data", "reuniao.dataCurta", "reuniao.hora", "reuniao.link"]);
  });

  it("não atropela as origens do contato", () => {
    const v = mapearVariaveis("Olá {{nome}} da {{empresa}}, às {{hora}}");
    expect(v.map((x) => x.origem)).toEqual(["contato.nome", "contato.empresa", "reuniao.hora"]);
  });

  it("a comparação é sem caixa", () => {
    expect(mapearVariaveis("{{datacurta}}")[0].origem).toBe("reuniao.dataCurta");
  });

  it("o que não bate com nada continua sendo texto fixo", () => {
    expect(mapearVariaveis("{{produto}}")[0].origem).toBe("texto");
  });
});

describe("formatação no fuso de Brasília", () => {
  it("escreve a data por extenso, a curta e a hora", () => {
    const v = mapearVariaveis("{{data}} · {{dataCurta}} · {{hora}} · {{link}}");
    expect(resolverParametros(v, ana)).toEqual({
      data: "terça-feira, 20 de outubro",
      dataCurta: "20/10/2026",
      hora: "14:00",
      link: "https://meet.google.com/abc-defg-hij",
    });
  });
});

describe("contato sem reunião", () => {
  const semReuniao: ContatoParaVariaveis = { nome: "Bruno Lima" };

  it("a variável fica vazia", () => {
    const v = mapearVariaveis("{{data}} às {{hora}}");
    expect(resolverParametros(v, semReuniao)).toEqual({ data: "", hora: "" });
  });

  it("o envio é recusado dizendo QUAL variável faltou", () => {
    // A Meta recusa o envio inteiro por um parâmetro vazio. Sem esta conferência, o CRM levaria a
    // recusa em inglês, um destinatário por vez, gastando cota.
    const v = mapearVariaveis("Sua reunião é {{data}} às {{hora}}");
    const r = prepararEnvioDeModelo(v, semReuniao);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.faltando).toEqual(["data", "hora"]);
    expect(r.motivo).toContain("{{data}}, {{hora}}");
    expect(r.motivo).toContain("nada foi enviado");
  });

  it("com valor reserva, o envio acontece", () => {
    const v: MapeamentoVariavel[] = [
      { chave: "data", indice: 1, origem: "reuniao.data", reserva: "a data combinada" },
    ];
    const r = prepararEnvioDeModelo(v, semReuniao);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parametros.data).toBe("a data combinada");
  });

  it("reunião sem link deixa só o link vazio", () => {
    const comReuniaoSemLink: ContatoParaVariaveis = {
      nome: "Ana Souza",
      reuniao: { dataIso: "2026-10-20", hora: "14:00", link: null },
    };
    const v = mapearVariaveis("{{data}} {{link}}");
    expect(resolverParametros(v, comReuniaoSemLink)).toEqual({ data: "terça-feira, 20 de outubro", link: "" });
  });
});

describe("usaReuniao", () => {
  it("diz se vale a pena consultar a agenda", () => {
    // É o que evita uma consulta por envio em todo modelo que não fala de reunião.
    expect(usaReuniao(mapearVariaveis("Olá {{nome}}"))).toBe(false);
    expect(usaReuniao(mapearVariaveis("Olá {{nome}}, às {{hora}}"))).toBe(true);
    expect(usaReuniao([])).toBe(false);
  });
});
