import { describe, expect, it } from "vitest";

import { BLOCOS_DISPONIVEIS } from "../blocos";
import { PRIMEIROS_NO_PROXIMO_PASSO, separarPrimeirosPassos } from "../sugestoes";
import type { FlowNodeType } from "../types";

const biblioteca = BLOCOS_DISPONIVEIS.filter((b) => b.categoria !== "gatilho");

describe("o que vem primeiro em \"Adicionar próximo passo\"", () => {
  it("os envios vêm na ordem escolhida, não na da biblioteca", () => {
    const { primeiros } = separarPrimeirosPassos(biblioteca);
    expect(primeiros.map((b) => b.tipo)).toEqual(PRIMEIROS_NO_PROXIMO_PASSO);
  });

  it("a mensagem de texto é a primeira de todas", () => {
    const { primeiros } = separarPrimeirosPassos(biblioteca);
    expect(primeiros[0].tipo).toBe("mensagem_texto");
  });

  it("decisão e sorteio saem da frente e vão pro resto", () => {
    // Eram eles que abriam a lista, por estarem declarados antes na biblioteca. É o defeito que
    // esta separação existe pra corrigir.
    const { resto, primeiros } = separarPrimeirosPassos(biblioteca);
    for (const tipo of ["condicao_grupo", "decisao_multipla", "distribuir_sorteio"] as FlowNodeType[]) {
      expect(resto.some((b) => b.tipo === tipo), `"${tipo}" devia estar no resto`).toBe(true);
      expect(primeiros.some((b) => b.tipo === tipo)).toBe(false);
    }
  });

  it("ninguém se perde e ninguém aparece duas vezes", () => {
    const { primeiros, resto } = separarPrimeirosPassos(biblioteca);
    expect(primeiros.length + resto.length).toBe(biblioteca.length);
    expect(new Set([...primeiros, ...resto].map((b) => b.tipo)).size).toBe(biblioteca.length);
  });

  it("o resto continua na ordem da biblioteca", () => {
    const { resto } = separarPrimeirosPassos(biblioteca);
    const naBiblioteca = biblioteca
      .filter((b) => !PRIMEIROS_NO_PROXIMO_PASSO.includes(b.tipo))
      .map((b) => b.tipo);
    expect(resto.map((b) => b.tipo)).toEqual(naBiblioteca);
  });

  it("numa lista filtrada pela busca, só aparece o que sobrou", () => {
    const sóImagem = biblioteca.filter((b) => b.tipo === "mensagem_imagem");
    const { primeiros, resto } = separarPrimeirosPassos(sóImagem);
    expect(primeiros.map((b) => b.tipo)).toEqual(["mensagem_imagem"]);
    expect(resto).toEqual([]);
  });

  it("todo tipo da lista de prioridade existe na biblioteca", () => {
    // Um tipo escrito errado aqui não daria erro nenhum: ele simplesmente nunca casaria, e o
    // bloco continuaria lá embaixo sem ninguém entender por quê.
    for (const tipo of PRIMEIROS_NO_PROXIMO_PASSO) {
      expect(BLOCOS_DISPONIVEIS.some((b) => b.tipo === tipo), `"${tipo}" não existe na biblioteca`).toBe(true);
    }
  });
});
