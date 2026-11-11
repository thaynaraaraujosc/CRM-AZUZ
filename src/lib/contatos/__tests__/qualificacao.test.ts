import { describe, expect, it } from "vitest";

import {
  ehQualificacao,
  QUALIFICACOES,
  rotuloDaQualificacao,
  viraSinalDeAnuncio,
} from "../qualificacao";

/**
 * A QUALIFICAÇÃO É JULGAMENTO HUMANO, e é por isso que ela vale: o algoritmo de anúncio só aprende
 * a procurar gente boa se alguém disser quem foi boa.
 */
describe("qualificação do lead", () => {
  it("são três, e com rótulo e explicação", () => {
    expect(QUALIFICACOES).toHaveLength(3);
    QUALIFICACOES.forEach((q) => {
      expect(q.label.trim()).not.toBe("");
      expect(q.descricao.trim()).not.toBe("");
    });
  });

  it("reconhece só os três valores", () => {
    expect(ehQualificacao("bom")).toBe(true);
    expect(ehQualificacao("curioso")).toBe(true);
    expect(ehQualificacao("ruim")).toBe(true);
    expect(ehQualificacao("otimo")).toBe(false);
    expect(ehQualificacao(null)).toBe(false);
    expect(ehQualificacao("")).toBe(false);
  });

  it("sem qualificação, o rótulo é vazio — e não um palpite", () => {
    expect(rotuloDaQualificacao(null)).toBe("");
    expect(rotuloDaQualificacao("bom")).toBe("Bom");
  });

  /*
   * SÓ "BOM" VIRA SINAL, e esta é a regra que impede o erro que esvaziaria o recurso inteiro.
   *
   * Devolver "curioso" como lead qualificado ensina o algoritmo a procurar mais curiosos — a
   * qualificação passaria a PIORAR a campanha, com a aparência de estar melhorando.
   */
  it("só o bom vira sinal pra plataforma", () => {
    expect(viraSinalDeAnuncio("bom")).toBe(true);
    expect(viraSinalDeAnuncio("curioso")).toBe(false);
    expect(viraSinalDeAnuncio("ruim")).toBe(false);
    expect(viraSinalDeAnuncio(null)).toBe(false);
  });
});
