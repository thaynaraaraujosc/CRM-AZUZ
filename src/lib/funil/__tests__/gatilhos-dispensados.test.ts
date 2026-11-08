import { describe, expect, it } from "vitest";

import { juntarDispensados } from "@/lib/funil/gatilhos-dispensados";

/**
 * "APAGOU, APAGOU. PERDEU."
 *
 * O defeito de 08/11/2026: apagar a automação da grade e o aviso reaparecer no instante seguinte
 * propondo trazê-la de volta. A causa era não haver memória do que tinha sido apagado, e é essa
 * memória que esta função mantém. Perder um id aqui devolve o laço; guardar lixo enche a coluna.
 */

describe("a memória do que foi apagado", () => {
  it("guarda o que acabou de sair da grade", () => {
    expect(juntarDispensados([], ["fluxo-1"])).toEqual(["fluxo-1"]);
  });

  it("soma ao que já estava guardado, sem repetir", () => {
    expect(juntarDispensados(["fluxo-1"], ["fluxo-2", "fluxo-1"])).toEqual(["fluxo-1", "fluxo-2"]);
  });

  it("ignora o que não é id de verdade", () => {
    // Veio do banco, e o que vem do banco pode ter qualquer forma: linha escrita por uma versão
    // anterior, JSON corrompido. Nada disso pode derrubar o apagar de um gatilho.
    expect(juntarDispensados([1, null, "", "fluxo-1", {}], ["  ", "fluxo-2"])).toEqual([
      "fluxo-1",
      "fluxo-2",
    ]);
  });

  it("dado guardado que não é lista nenhuma vira lista vazia", () => {
    expect(juntarDispensados(null, ["fluxo-1"])).toEqual(["fluxo-1"]);
    expect(juntarDispensados("texto solto", [])).toEqual([]);
  });

  it("tira espaço das pontas", () => {
    expect(juntarDispensados([], [" fluxo-1 "])).toEqual(["fluxo-1"]);
  });

  it("tem teto, e corta o mais antigo", () => {
    // A coluna é JSON; sem teto, um workspace com muitos fluxos a faria crescer pra sempre. O
    // mais antigo é o que menos importa lembrar: a oferta só reaparece pra fluxo que ainda
    // existe e ainda tem bloco de gatilho dentro.
    const muitos = Array.from({ length: 500 }, (_, i) => `f${i}`);
    const resultado = juntarDispensados(muitos, ["novo"]);
    expect(resultado).toHaveLength(500);
    expect(resultado.at(-1)).toBe("novo");
    expect(resultado).not.toContain("f0");
  });
});
