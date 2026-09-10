import { describe, expect, it } from "vitest";

import { chaveDeContato, mesmoContato } from "../chave-nome";

/**
 * Os dois casos abaixo saíram do diagnóstico da conta real, não de imaginação: um negócio chamado
 * "Thais " com espaço no fim, e um negócio "Lucas Arantes" cuja conversa está gravada como
 * "LUCAS ARANTES". Nos dois, a conversa existia e o funil dizia que não.
 */
describe("reconhecer que dois registros são a mesma pessoa", () => {
  it("ignora espaço sobrando no fim", () => {
    expect(mesmoContato("Thais ", "Thais")).toBe(true);
  });

  it("ignora maiúsculas e minúsculas", () => {
    expect(mesmoContato("Lucas Arantes", "LUCAS ARANTES")).toBe(true);
  });

  it("ignora espaço duplo no meio", () => {
    expect(mesmoContato("Ana  Maria", "Ana Maria")).toBe(true);
  });

  it("mantém a acentuação como parte do nome", () => {
    expect(mesmoContato("Émelin Alves", "Émelin Alves")).toBe(true);
    expect(mesmoContato("Emelin Alves", "Émelin Alves")).toBe(false);
  });

  it("pessoas diferentes continuam diferentes", () => {
    expect(mesmoContato("Thais", "Thaynara")).toBe(false);
  });

  it("nome vazio não casa com nada, nem com outro vazio", () => {
    expect(mesmoContato("", "")).toBe(false);
    expect(mesmoContato(null, "Thais")).toBe(false);
    expect(chaveDeContato("  ")).toBe("");
  });
});
