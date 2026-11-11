import { describe, expect, it } from "vitest";

import { cpfValido, digitosDoCpf, formatarCpf } from "@/lib/equipe/cpf";

describe("digitosDoCpf", () => {
  it("tira a máscara", () => {
    expect(digitosDoCpf("529.982.247-25")).toBe("52998224725");
  });

  it("vazio continua vazio", () => {
    expect(digitosDoCpf(null)).toBe("");
    expect(digitosDoCpf(undefined)).toBe("");
  });
});

describe("formatarCpf", () => {
  it("põe a máscara", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("o que não tem onze dígitos volta como veio", () => {
    expect(formatarCpf("123")).toBe("123");
  });
});

/**
 * A conferência é o DÍGITO VERIFICADOR, não o tamanho: onze dígitos quaisquer passam num teste de
 * tamanho, e o erro de digitação mais comum — um número trocado — tem exatamente onze.
 */
describe("cpfValido", () => {
  it("aceita um CPF de verdade, com e sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("recusa um dígito trocado", () => {
    expect(cpfValido("52998224726")).toBe(false);
  });

  it("recusa tamanho errado", () => {
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("529982247250")).toBe(false);
  });

  it("recusa os onze dígitos iguais", () => {
    // Passam no cálculo do módulo 11 e não são CPF de ninguém. É o que todo mundo digita pra testar.
    for (const n of ["00000000000", "11111111111", "99999999999"]) {
      expect(cpfValido(n), n).toBe(false);
    }
  });

  it("vazio é válido: o campo é opcional", () => {
    expect(cpfValido("")).toBe(true);
    expect(cpfValido(null)).toBe(true);
    expect(cpfValido(undefined)).toBe(true);
  });
});
