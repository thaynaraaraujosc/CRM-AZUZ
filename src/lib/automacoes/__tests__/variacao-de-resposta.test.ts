import { describe, expect, it } from "vitest";

import { escolherVariacao } from "@/lib/automacoes/motor-estado";

/**
 * VÁRIAS RESPOSTAS, UMA ENVIADA.
 *
 * A automação de comentário responde em público e responde muito: a mesma frase repetida vinte
 * vezes embaixo do mesmo post é o que o Instagram lê como spam. A tela deixa escrever várias
 * formas de dizer a mesma coisa, e o motor sorteia uma a cada envio.
 */
describe("escolherVariacao", () => {
  it("sem variação, devolve o texto como sempre", () => {
    expect(escolherVariacao("Oi!")).toBe("Oi!");
    expect(escolherVariacao("Oi!", [])).toBe("Oi!");
  });

  it("devolve SEMPRE uma só, nunca as duas juntas", () => {
    const saida = escolherVariacao("Oi!", ["Olá!", "Oie!"]);
    expect(["Oi!", "Olá!", "Oie!"]).toContain(saida);
  });

  it("o sorteio alcança todas as opções", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 200; i++) vistas.add(escolherVariacao("A", ["B", "C"]));
    expect(vistas).toEqual(new Set(["A", "B", "C"]));
  });

  it("variação em branco não entra no sorteio", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 50; i++) vistas.add(escolherVariacao("A", ["", "   "]));
    expect(vistas).toEqual(new Set(["A"]));
  });

  it("texto principal vazio não deixa a lista sem nada: a variação assume", () => {
    expect(escolherVariacao("", ["B"])).toBe("B");
  });

  it("tudo em branco devolve vazio, e quem chama trata como bloco sem texto", () => {
    expect(escolherVariacao("", ["", " "])).toBe("");
  });
});
