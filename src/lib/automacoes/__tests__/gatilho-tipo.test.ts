import { describe, expect, it } from "vitest";

import { tipoDoGatilhoDosNodes } from "@/lib/automacoes/gatilho-tipo";

/**
 * Esta função decide se um fluxo é lido ou ignorado pela varredura que roda a cada minuto. Errar
 * pra menos faz uma automação de aniversário nunca disparar, em silêncio; errar pra mais traz de
 * volta a leitura cara que ela existe pra evitar.
 */
describe("tipo do gatilho a partir dos nodes", () => {
  it("acha o bloco de gatilho no meio dos outros", () => {
    const nodes = [
      { id: "a", category: "mensagem", type: "mensagem_texto" },
      { id: "b", category: "gatilho", type: "aniversario" },
      { id: "c", category: "fim", type: "encerrar_fluxo" },
    ];
    expect(tipoDoGatilhoDosNodes(nodes)).toBe("aniversario");
  });

  it("fluxo sem gatilho devolve vazio, nunca nulo", () => {
    expect(tipoDoGatilhoDosNodes([{ id: "a", category: "mensagem", type: "mensagem_texto" }])).toBe("");
    expect(tipoDoGatilhoDosNodes([])).toBe("");
  });

  it("aguenta nodes ausente ou com formato inesperado sem estourar", () => {
    expect(tipoDoGatilhoDosNodes(null)).toBe("");
    expect(tipoDoGatilhoDosNodes(undefined)).toBe("");
    expect(tipoDoGatilhoDosNodes("nada disso")).toBe("");
    expect(tipoDoGatilhoDosNodes([null, { category: "gatilho", type: "horario_programado" }])).toBe(
      "horario_programado",
    );
  });

  it("gatilho sem type devolve vazio: é a resposta 'conferido, não tem'", () => {
    expect(tipoDoGatilhoDosNodes([{ category: "gatilho" }])).toBe("");
  });
});

/**
 * Com vários gatilhos, a coluna tem que carregar o de RELÓGIO — ela serve só pra varredura de
 * minuto em minuto decidir se olha este fluxo. Guardar "comentário" num fluxo que também dispara
 * às 12h faria a varredura pular o fluxo, e o disparo das 12h não aconteceria.
 */
describe("tipoDoGatilhoDosNodes com vários gatilhos", () => {
  it("o gatilho de tempo ganha do que vem primeiro", () => {
    const nodes = [
      { id: "g1", category: "gatilho", type: "comentario_instagram" },
      { id: "g2", category: "gatilho", type: "horario_programado" },
    ];
    expect(tipoDoGatilhoDosNodes(nodes)).toBe("horario_programado");
  });

  it("sem gatilho de tempo, continua sendo o primeiro", () => {
    const nodes = [
      { id: "g1", category: "gatilho", type: "comentario_instagram" },
      { id: "g2", category: "gatilho", type: "instagram_story_respondido" },
    ];
    expect(tipoDoGatilhoDosNodes(nodes)).toBe("comentario_instagram");
  });
});
