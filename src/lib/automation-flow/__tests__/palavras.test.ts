import { describe, expect, it } from "vitest";

import { textoCasaComPalavras } from "@/lib/automation-flow/motor";

/**
 * A regra de palavra-chave decide se uma automação dispara ou não — é o ponto onde um engano custa
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
