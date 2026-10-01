import { describe, expect, it } from "vitest";

import { normalizarTelefoneParaComparacao as n } from "../telefone";

/**
 * O mesmo cliente não pode entrar duas vezes no CRM só porque foi digitado de um jeito e chegou de
 * outro. Quem digita à mão no Brasil escreve "(62) 99999-9999"; o WhatsApp manda "5562999999999".
 */
describe("normalizarTelefoneParaComparacao", () => {
  it("casa o número digitado com máscara e sem DDI com o que o WhatsApp manda", () => {
    expect(n("(62) 99999-9999")).toBe(n("5562999999999"));
  });

  it("casa o fixo/celular antigo de 8 dígitos com a versão de 9", () => {
    expect(n("(62) 9999-9999")).toBe(n("5562999999999"));
  });

  it("casa o formato internacional escrito com +", () => {
    expect(n("+55 62 99999-9999")).toBe(n("5562999999999"));
  });

  it("números diferentes continuam diferentes", () => {
    expect(n("(62) 99999-0001")).not.toBe(n("(62) 99999-0002"));
  });

  // A regra do DDI não pode sair chutando `55` em cima de número de fora.
  it("não inventa DDI brasileiro em número estrangeiro", () => {
    expect(n("+1 415 555 0123")).toBe("14155550123");
  });

  it("texto sem dígito nenhum vira vazio, pra nunca casar com nada", () => {
    expect(n("sem número")).toBe("");
    expect(n("")).toBe("");
  });
});
