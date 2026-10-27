import { describe, expect, it } from "vitest";

import { contatoFoiSalvo } from "../salvos";

/**
 * O risco destes testes não é mostrar demais: é mostrar DE MENOS. Esconder um contato que a equipe
 * guardou parece perda de dado, e quem vê uma agenda que encolheu sozinha não confia mais nela.
 */
describe("contatoFoiSalvo", () => {
  it("quem a equipe salvou aparece", () => {
    expect(contatoFoiSalvo({ salvoEm: new Date(), criadoVia: "whatsapp" })).toBe(true);
    expect(contatoFoiSalvo({ salvoEm: "2026-10-27T12:00:00.000Z", criadoVia: "instagram" })).toBe(true);
  });

  /*
   * A condição que dispensa migração de dado: todo contato criado na tela de Contatos antes desta
   * mudança nasceu com `criadoVia: "manual"` e `salvoEm` nulo. Sem ela, a tela esvaziaria no dia
   * da publicação.
   */
  it("contato criado à mão antes desta mudança continua aparecendo", () => {
    expect(contatoFoiSalvo({ criadoVia: "manual" })).toBe(true);
    expect(contatoFoiSalvo({ salvoEm: null, criadoVia: "manual" })).toBe(true);
    // Registro antigo sem o campo nenhum: o padrão da coluna sempre foi "manual".
    expect(contatoFoiSalvo({})).toBe(true);
  });

  it("quem nasceu sozinho de uma mensagem não aparece", () => {
    expect(contatoFoiSalvo({ criadoVia: "whatsapp" })).toBe(false);
    expect(contatoFoiSalvo({ criadoVia: "instagram" })).toBe(false);
    expect(contatoFoiSalvo({ salvoEm: null, criadoVia: "azuz-flow" })).toBe(false);
  });
});
