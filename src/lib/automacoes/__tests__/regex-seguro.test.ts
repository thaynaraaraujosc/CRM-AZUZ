import { describe, expect, it } from "vitest";

import { casaComRegex, validarRegex } from "../regex-seguro";

describe("validação de regex", () => {
  it("aceita expressão comum de atendimento", () => {
    expect(validarRegex("^(sim|s|claro)$").ok).toBe(true);
    expect(validarRegex("\\d{4}").ok).toBe(true);
  });

  it("recusa o backtracking catastrófico", () => {
    // É este o padrão que derrubaria o servidor: um trecho repetido dentro de um grupo repetido.
    expect(validarRegex("(a+)+$").ok).toBe(false);
    expect(validarRegex("(a*)*b").ok).toBe(false);
  });

  it("recusa expressão vazia, longa demais ou com erro de sintaxe", () => {
    expect(validarRegex("").ok).toBe(false);
    expect(validarRegex("a".repeat(300)).ok).toBe(false);
    expect(validarRegex("(sem fechar").ok).toBe(false);
  });
});

describe("comparação com regex", () => {
  it("casa sem diferenciar maiúscula", () => {
    expect(casaComRegex("SIM", "^sim$")).toBe(true);
  });

  it("não casa o que não bate", () => {
    expect(casaComRegex("talvez", "^sim$")).toBe(false);
  });

  it("padrão perigoso não roda: devolve falso em vez de travar", () => {
    expect(casaComRegex("aaaaaaaaaaaaaaaaaaaaaaaaaaaa!", "(a+)+$")).toBe(false);
  });

  it("texto grande demais não é comparado", () => {
    // Regex linear sobre texto enorme ainda custa. O teto corta antes de virar problema.
    expect(casaComRegex("a".repeat(600), "a")).toBe(false);
  });
});
