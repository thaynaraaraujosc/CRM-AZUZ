import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LARGURA_DE_CELULAR } from "@/lib/tela-estreita";

/**
 * A LARGURA DE CELULAR ESTÁ ESCRITA EM DOIS LUGARES, e este teste existe pra garantir que
 * continuem iguais.
 *
 * O `globals.css` tem um `@media (max-width: 820px)` que transforma o CRM inteiro num aplicativo
 * de celular: o menu vira barra horizontal, o funil vira uma etapa por tela, a caixa de entrada
 * vira um painel por tela. O TypeScript precisa saber da mesma largura pra encurtar o texto do
 * campo de mensagem e pra levar a tela até a conversa escolhida.
 *
 * Se alguém mexer num e esquecer do outro, o estrago é silencioso e chato de achar: o layout
 * troca numa largura e o comportamento troca em outra, e no meio fica uma faixa em que o CRM está
 * meio celular e meio computador. Melhor quebrar aqui.
 */
describe("a largura de celular", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("é a mesma do media query que vira o menu em barra", () => {
    // O bloco do menu móvel é o único que redefine `.sidebar.recolhida:not(.sobreposta)`.
    const blocos = [...css.matchAll(/@media \(max-width: (\d+)px\) \{([\s\S]*?)\n\}/g)];
    const doMenu = blocos.find(([, , corpo]) => corpo.includes(".sidebar.recolhida:not(.sobreposta)"));
    expect(doMenu, "o media query que vira o menu em barra sumiu do globals.css").toBeDefined();
    expect(Number(doMenu![1])).toBe(LARGURA_DE_CELULAR);
  });

  it("o mesmo bloco cuida do funil e da caixa de entrada", () => {
    // Se alguém separar essas regras em outro media query, a troca deixa de ser de uma vez só.
    const bloco = css.slice(css.indexOf(`@media (max-width: ${LARGURA_DE_CELULAR}px)`));
    const ateOFim = bloco.slice(0, bloco.indexOf("\n}\n") + 3);
    expect(ateOFim).toContain(".kanban > div");
    expect(ateOFim).toContain(".wa-content");
  });
});
