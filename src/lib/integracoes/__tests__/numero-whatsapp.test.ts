import { describe, expect, it } from "vitest";

import { mesmoNumero, numeroComparavel } from "../numero-whatsapp";

/**
 * O caso que importa é o positivo: dizer "é o mesmo número" quando é, mesmo com as duas conexões
 * gravando em formatos diferentes. Um falso negativo aqui deixa passar em silêncio a única
 * configuração que dá problema de verdade.
 */
describe("comparar número entre as duas conexões de WhatsApp", () => {
  it("ignora formatação", () => {
    expect(mesmoNumero("+55 62 9396-1473", "556293961473")).toBe(true);
  });

  it("acerta o celular brasileiro sem o nono dígito", () => {
    // 55 + 62 + oito dígitos é o formato antigo. Vira o atual, com o 9 na frente do celular.
    expect(numeroComparavel("556293961473")).toBe("5562993961473");
    // O mesmo número escrito nos dois formatos tem que bater.
    expect(mesmoNumero("556293961473", "5562993961473")).toBe(true);
  });

  it("números diferentes continuam diferentes", () => {
    expect(mesmoNumero("+55 62 9396-1473", "+55 11 98888-7777")).toBe(false);
  });

  it("sem número dos dois lados não afirma nada", () => {
    expect(mesmoNumero(null, "556293961473")).toBe(false);
    expect(mesmoNumero("", "")).toBe(false);
    expect(mesmoNumero(undefined, undefined)).toBe(false);
  });
});
