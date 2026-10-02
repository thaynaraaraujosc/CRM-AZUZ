import { describe, expect, it } from "vitest";

import { cepValido, cnpjValido, cpfValido, emailValido, telefoneValido } from "../documentos";

/**
 * POR QUE ISTO IMPORTA: num formulário ligado a anúncio pago, documento inválido é lead sujo
 * entrando direto na lista do cliente — e só se descobre quando alguém liga. Até aqui CPF e CNPJ
 * eram caixas de texto livre: `111.111.111-11` passava.
 */
describe("CPF", () => {
  it("aceita um CPF válido, com e sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cpfValido("529.982.247-24")).toBe(false);
  });

  // O caso clássico: passa em qualquer conferência que só conte dígitos.
  it("recusa todos os dígitos iguais", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });

  it("recusa quantidade errada de dígitos", () => {
    expect(cpfValido("5299822472")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("aceita um CNPJ válido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("recusa dígito verificador errado e repetição", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
  });
});

describe("CEP, telefone e e-mail", () => {
  it("CEP tem oito dígitos", () => {
    expect(cepValido("74000-000")).toBe(true);
    expect(cepValido("7400-000")).toBe(false);
  });

  it("telefone precisa de DDD e número completo", () => {
    expect(telefoneValido("(62) 99999-0001")).toBe(true);
    expect(telefoneValido("99999-0001")).toBe(false);
  });

  it("e-mail sem arroba ou sem domínio não passa", () => {
    expect(emailValido("thay@azuz.com.br")).toBe(true);
    expect(emailValido("thay.azuz.com.br")).toBe(false);
    expect(emailValido("thay@azuz")).toBe(false);
  });
});
