import { describe, expect, it } from "vitest";

import { formatarSubCampanha, parseSubCampanha } from "../metrics";

/**
 * O ida e volta que ninguém vê quebrar.
 *
 * As campanhas viajam do servidor pra tela com leads e investimento DENTRO DE UMA FRASE
 * (`"12 leads · R$ 1.500,00 investidos"`), e a tela extrai os números de volta com expressão
 * regular. É frágil por natureza: quem monta a frase de um jeito e quem lê de outro produz ZERO na
 * tela, sem erro, sem log, sem nada. E zero numa tela de tráfego não parece defeito: parece
 * campanha que não performou.
 *
 * Daí o formato ter uma função só sua, e este teste conferir os dois lados juntos. O caso que
 * motivou: o Google conta conversão fracionada, e `3,5 leads` fazia a regex `(\d+)\s*leads?` casar
 * com o `5` depois da vírgula. A campanha aparecia com 5 leads em vez de 4.
 */
describe("formatarSubCampanha ↔ parseSubCampanha", () => {
  const casos: [number, number][] = [
    [0, 0],
    [1, 9.9],
    [12, 1500],
    [7, 1234.56],
    // Valor grande é onde o separador de milhar entra, e é onde a leitura erra com mais estrago.
    [980, 1_234_567.89],
  ];

  for (const [leads, investido] of casos) {
    it(`mantém ${leads} leads e R$ ${investido} na ida e na volta`, () => {
      const lido = parseSubCampanha(formatarSubCampanha(leads, investido));
      expect(lido.leads).toBe(leads);
      expect(lido.investido).toBeCloseTo(investido, 2);
    });
  }

  it("arredonda conversão fracionada em vez de deixar a leitura adivinhar", () => {
    expect(parseSubCampanha(formatarSubCampanha(3.5, 100)).leads).toBe(4);
    expect(parseSubCampanha(formatarSubCampanha(3.2, 100)).leads).toBe(3);
  });

  it("escreve 1 lead no singular", () => {
    expect(formatarSubCampanha(1, 10)).toContain("1 lead ");
  });

  /**
   * O formato tem que continuar igual ao que o Meta Ads já produz, senão as duas fontes viram dois
   * dialetos e só uma delas é lida corretamente.
   */
  it("mantém o formato que a tela de Tráfego já espera", () => {
    expect(formatarSubCampanha(12, 1500)).toBe("12 leads · R$ 1.500,00 investidos");
  });
});
