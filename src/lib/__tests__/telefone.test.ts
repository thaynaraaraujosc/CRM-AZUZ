import { describe, expect, it } from "vitest";

import { formatarTelefoneParaExibicao, normalizarTelefoneParaComparacao as n } from "../telefone";

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

/**
 * O telefone na tela de contatos. O defeito que isto corrige aparecia em cliente de fora do
 * Brasil: a função devolvia `null` e a tela caía nos dígitos crus — "351910436018", sem um espaço,
 * que não se lê nem se confere.
 */
describe("formatarTelefoneParaExibicao", () => {
  it("brasileiro sai com DDI, DDD entre parênteses e hífen", () => {
    expect(formatarTelefoneParaExibicao("41984877482")).toBe("+55 (41) 98487-7482");
    expect(formatarTelefoneParaExibicao("5541984877482")).toBe("+55 (41) 98487-7482");
    expect(formatarTelefoneParaExibicao("+55 41 98487-7482")).toBe("+55 (41) 98487-7482");
    // Fixo de oito dígitos continua valendo.
    expect(formatarTelefoneParaExibicao("553133334444")).toBe("+55 (31) 3333-4444");
  });

  it("número de fora do Brasil sai com o DDI separado, em grupos legíveis", () => {
    // Portugal: o DDI tem três dígitos, e testar o curto antes cortaria no lugar errado.
    expect(formatarTelefoneParaExibicao("351910436018")).toBe("+351 910 436 018");
    // Argentina, doze dígitos.
    expect(formatarTelefoneParaExibicao("541145551234")).toBe("+54 114 555 1234");
    // Reino Unido.
    expect(formatarTelefoneParaExibicao("447911123456")).toBe("+44 791 112 3456");
  });

  /*
   * UM LIMITE CONHECIDO, escrito aqui pra ninguém "consertar" e quebrar a maioria dos números.
   *
   * Onze dígitos começando com DDD válido é EXATAMENTE a forma de um celular brasileiro sem DDI —
   * e também a de um número dos Estados Unidos com DDI. Não há como distinguir os dois olhando só
   * os dígitos, e o CRM é de clientes brasileiros: a maioria esmagadora do que chega assim é
   * daqui. Então a dúvida é resolvida a favor do Brasil, de propósito.
   *
   * Número de fora com DOZE dígitos ou mais não tem essa ambiguidade e sai certo (ver acima).
   */
  it("onze dígitos é lido como brasileiro, mesmo podendo ser de fora", () => {
    expect(formatarTelefoneParaExibicao("14155552671")).toBe("+55 (14) 15555-2671");
  });

  /*
   * O limite que separa telefone de identificador. O IGSID do Instagram tem 16 ou 17 dígitos e
   * chega por esta mesma porta; carimbar um `+` nele poria um telefone falso na tela.
   */
  it("o que não pode ser telefone continua sendo null", () => {
    expect(formatarTelefoneParaExibicao("")).toBeNull();
    expect(formatarTelefoneParaExibicao("sem dígito nenhum")).toBeNull();
    expect(formatarTelefoneParaExibicao("1234567")).toBeNull();
    expect(formatarTelefoneParaExibicao("17841400000000000")).toBeNull();
  });

  /*
   * O corte em treze dígitos, e por que não são os quinze do E.164.
   *
   * O LID do WhatsApp tem catorze ou quinze e começa por algo que parece código de país:
   * "33230329753761" sairia como francês. Não é telefone, e não dá pra distinguir olhando — então
   * a resposta é não afirmar. Ver `conversas/participantes.ts`, onde essa escolha foi feita
   * primeiro, e os testes de lá que prendem o mesmo caso.
   */
  it("identificador interno do WhatsApp não vira telefone estrangeiro", () => {
    expect(formatarTelefoneParaExibicao("33230329753761")).toBeNull();
    expect(formatarTelefoneParaExibicao("157797132062834")).toBeNull();
  });

  it("DDI que não está na lista não é recortado no chute", () => {
    // Prefixo inexistente: melhor devolver null e a tela mostrar como veio do que inventar um país.
    expect(formatarTelefoneParaExibicao("999988887777")).toBeNull();
  });
});
