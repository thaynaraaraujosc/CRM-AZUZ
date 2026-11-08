import { describe, expect, it } from "vitest";

import { textoCasaComPalavras } from "@/lib/automation-flow/avaliacao";

/**
 * A regra de palavra-chave decide se uma automação dispara ou não. É o ponto onde um engano custa
 * caro dos dois lados: não disparar deixa o lead sem resposta, e disparar errado manda mensagem
 * comercial pra quem não pediu.
 */
describe("textoCasaComPalavras", () => {
  it("sem palavra configurada, qualquer texto dispara", () => {
    expect(textoCasaComPalavras("qualquer coisa", {})).toBe(true);
    expect(textoCasaComPalavras("", { palavras: [] })).toBe(true);
  });

  it("ignora caixa e acento por padrão", () => {
    const config = { palavras: ["GUIA"] };
    expect(textoCasaComPalavras("quero o guia", config)).toBe(true);
    expect(textoCasaComPalavras("quero o GUÍA", config)).toBe(true);
  });

  it("respeita acento quando pedido", () => {
    const config = { palavras: ["guia"], ignorarAcentos: false };
    expect(textoCasaComPalavras("quero o guía", config)).toBe(false);
    expect(textoCasaComPalavras("quero o guia", config)).toBe(true);
  });

  it("no modo palavra inteira, não dispara dentro de outra palavra", () => {
    const config = { palavras: ["quero"], modoPalavra: "qualquer" as const };
    expect(textoCasaComPalavras("eu quero!", config)).toBe(true);
    expect(textoCasaComPalavras("querosene", config)).toBe(false);
  });

  it("no modo contém, dispara mesmo dentro de outra palavra", () => {
    const config = { palavras: ["quero"], modoPalavra: "contem" as const };
    expect(textoCasaComPalavras("querosene", config)).toBe(true);
  });

  it("no modo exato, só o comentário inteiro conta", () => {
    const config = { palavras: ["guia"], modoPalavra: "exata" as const };
    expect(textoCasaComPalavras("guia", config)).toBe(true);
    expect(textoCasaComPalavras("  GUIA  ", config)).toBe(true);
    expect(textoCasaComPalavras("quero o guia", config)).toBe(false);
  });

  it("basta uma das palavras da lista", () => {
    const config = { palavras: ["guia", "quero", "link"], modoPalavra: "qualquer" as const };
    expect(textoCasaComPalavras("manda o link", config)).toBe(true);
    expect(textoCasaComPalavras("bom dia", config)).toBe(false);
  });

  it("aceita o campo antigo de palavra única, que fluxos já salvos ainda usam", () => {
    expect(textoCasaComPalavras("quero o guia", { palavraChave: "guia" })).toBe(true);
  });

  it("palavra com acento na configuração também casa com texto sem acento", () => {
    expect(textoCasaComPalavras("quero informacao", { palavras: ["informação"] })).toBe(true);
  });
});

/**
 * "A PALAVRA APARECE NO COMEÇO".
 *
 * Nasceu de como as pessoas respondem a um story ou a um post: "quero sim, me manda", "link por
 * favor". A intenção está na primeira palavra e o resto é conversa — `exata` não pega, e `contem`
 * pega também o "não quero", que é o contrário do que se quis dizer.
 */
describe("modo começo", () => {
  const config = { palavras: ["quero"], modoPalavra: "comeco" as const };

  it("dispara quando a mensagem começa pela palavra", () => {
    expect(textoCasaComPalavras("quero sim, me manda", config)).toBe(true);
    expect(textoCasaComPalavras("QUERO", config)).toBe(true);
  });

  it("não dispara quando a palavra vem no meio", () => {
    // É o caso que separa este modo do "contém": aqui o "não quero" não entra.
    expect(textoCasaComPalavras("eu não quero", config)).toBe(false);
  });

  it("não dispara dentro de outra palavra", () => {
    // Sem conferir o que vem depois, "quero" pegaria "querosene".
    expect(textoCasaComPalavras("querosene", config)).toBe(false);
  });

  it("aceita frase, não só palavra", () => {
    const frase = { palavras: ["me manda"], modoPalavra: "comeco" as const };
    expect(textoCasaComPalavras("me manda o link", frase)).toBe(true);
    expect(textoCasaComPalavras("oi, me manda o link", frase)).toBe(false);
  });

  it("espaço e acento não atrapalham", () => {
    const comAcento = { palavras: ["começo"], modoPalavra: "comeco" as const };
    expect(textoCasaComPalavras("  COMECO agora", comAcento)).toBe(true);
  });
});

describe("maiúscula nunca conta, em modo nenhum", () => {
  // A pessoa escreve "ASOS", "Asos" ou "asos" e a automação precisa disparar nos três. Não há
  // botão pra isso de propósito: um jeito de a automação falhar sem ninguém entender por quê.
  for (const modo of ["contem", "exata", "qualquer", "comeco"] as const) {
    it(`no modo ${modo}`, () => {
      expect(textoCasaComPalavras("ASOS", { palavras: ["asos"], modoPalavra: modo })).toBe(true);
      expect(textoCasaComPalavras("asos", { palavras: ["ASOS"], modoPalavra: modo })).toBe(true);
    });
  }
});
