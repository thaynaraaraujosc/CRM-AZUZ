import { describe, expect, it } from "vitest";

import { traduzirRotuloDoSistema } from "../rotulos-do-sistema";

/** Dicionário de mentira, pra o teste não depender do arquivo de traduções de verdade. */
const traduzir = (chave: string, valores?: Record<string, string | number>) => {
  const tabela: Record<string, string> = {
    "[Imagem]": "[Image]",
    "Você foi marcado em um story": "You were tagged in a story",
    "Respondeu ao story de {arroba}": "Replied to {arroba}'s story",
  };
  const base = tabela[chave] ?? chave;
  return valores
    ? Object.entries(valores).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, String(v)), base)
    : base;
};

describe("traduzirRotuloDoSistema", () => {
  it("traduz o que foi o SISTEMA que escreveu", () => {
    expect(traduzirRotuloDoSistema("[Imagem]", traduzir)).toBe("[Image]");
    expect(traduzirRotuloDoSistema("Você foi marcado em um story", traduzir)).toBe(
      "You were tagged in a story",
    );
  });

  it("resolve o story com @, que não cabe num conjunto fixo", () => {
    expect(traduzirRotuloDoSistema("Respondeu ao story de @ag.azuzdigital", traduzir)).toBe(
      "Replied to @ag.azuzdigital's story",
    );
  });

  it("NÃO toca no que a pessoa escreveu — é a razão de este módulo existir", () => {
    const daPessoa = [
      "Oi, tudo bem?",
      "Compartilhou uma publicação no meu grupo ontem",
      "[Imagem] era pra ter vindo aqui",
      "Respondeu ao story de ontem sem querer",
      "",
    ];
    for (const texto of daPessoa) {
      expect(traduzirRotuloDoSistema(texto, traduzir)).toBe(texto);
    }
  });
});
