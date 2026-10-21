import { describe, expect, it } from "vitest";

import { LOGO_AREA, LOGO_DENSIDADE, tamanhoDaLogo } from "../tamanho-da-logo";

/**
 * O tamanho da logo é uma conta que TRÊS lugares precisam dar igual: a tela que reduz a imagem, o
 * quadradinho do menu e a prévia em Configurações. Provar a conta aqui é o que permite que ela
 * exista num lugar só.
 */

const MAX = { largura: LOGO_AREA.largura * LOGO_DENSIDADE, altura: LOGO_AREA.altura * LOGO_DENSIDADE };

describe("reduzir até caber", () => {
  it("uma logo enorme cabe na área, em alta densidade", () => {
    const r = tamanhoDaLogo(2000, 2000);
    expect(r.largura).toBeLessThanOrEqual(MAX.largura);
    expect(r.altura).toBeLessThanOrEqual(MAX.altura);
  });

  it("mantém a proporção de uma logo deitada", () => {
    // Logo larga e baixa não pode virar quadrado: é o que "esticar" significa na prática.
    //
    // A tolerância é de meio ponto porque o resultado é em PIXELS INTEIROS: a 78 × 20, arredondar
    // já move a proporção de 4 pra 3,9. Exigir mais casas seria exigir meio pixel.
    const r = tamanhoDaLogo(1000, 250);
    expect(r.largura / r.altura).toBeCloseTo(4, 0);
    expect(r.largura).toBeLessThanOrEqual(MAX.largura);
  });

  it("mantém a proporção de uma logo em pé", () => {
    const r = tamanhoDaLogo(250, 1000);
    expect(r.altura / r.largura).toBeCloseTo(4, 0);
    expect(r.altura).toBeLessThanOrEqual(MAX.altura);
  });
});

describe("o que já cabe", () => {
  it("não é ampliado", () => {
    // Esticar uma logo pequena não a melhora: deixa borrada e ainda ocupa mais bytes.
    expect(tamanhoDaLogo(20, 20)).toEqual({ largura: 20, altura: 20 });
  });
});

describe("os extremos", () => {
  it("nunca devolve zero", () => {
    // Zero seria um canvas de largura 0: a logo sumiria sem erro nenhum.
    const r = tamanhoDaLogo(10000, 1);
    expect(r.largura).toBeGreaterThan(0);
    expect(r.altura).toBeGreaterThan(0);
  });
});
