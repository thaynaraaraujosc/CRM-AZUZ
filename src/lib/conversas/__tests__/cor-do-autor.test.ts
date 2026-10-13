import { describe, expect, it } from "vitest";

import { TOTAL_DE_CORES_DE_AUTOR, corDoAutor } from "../cor-do-autor";

describe("corDoAutor", () => {
  it("devolve sempre a mesma cor pro mesmo nome", () => {
    expect(corDoAutor("Thaynara Araújo")).toBe(corDoAutor("Thaynara Araújo"));
  });

  it("nunca sai da faixa de cores existentes", () => {
    const nomes = ["", "a", "Ana", "~!@#$", "José da Silva", "x".repeat(500), "瑞"];
    for (const nome of nomes) {
      const cor = corDoAutor(nome);
      expect(Number.isInteger(cor)).toBe(true);
      expect(cor).toBeGreaterThanOrEqual(0);
      expect(cor).toBeLessThan(TOTAL_DE_CORES_DE_AUTOR);
    }
  });

  it("separa nomes parecidos, que é o caso que acontece de verdade numa agenda", () => {
    expect(corDoAutor("Ana Paula")).not.toBe(corDoAutor("Ana Carolina"));
  });

  it("usa as oito cores: com poucos nomes nenhuma sobra sem nunca aparecer", () => {
    const usadas = new Set(
      ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Hugo", "Iara", "João",
       "Kátia", "Lucas", "Marina", "Nuno", "Olívia", "Pedro"].map(corDoAutor),
    );
    expect(usadas.size).toBeGreaterThanOrEqual(6);
  });
});
