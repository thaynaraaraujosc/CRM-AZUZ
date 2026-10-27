import { describe, expect, it } from "vitest";

import { escolhasMarcadas } from "../escolhas";

/**
 * O defeito que estes testes prendem não aparece pra quem monta o formulário: aparece pra quem
 * responde, e só nas opções que têm vírgula. A caixa era marcada e voltava desmarcada no mesmo
 * instante, sem erro nenhum na tela.
 */
describe("escolhasMarcadas", () => {
  const opcoes = ["Redes sociais, site e tráfego pago", "Só redes sociais", "Sim", "Sim, com ressalvas"];

  it("vazio não marca nada", () => {
    expect(escolhasMarcadas("", opcoes)).toEqual([]);
    expect(escolhasMarcadas("   ", opcoes)).toEqual([]);
  });

  it("opção com vírgula dentro continua sendo UMA opção", () => {
    expect(escolhasMarcadas("Redes sociais, site e tráfego pago", opcoes)).toEqual([
      "Redes sociais, site e tráfego pago",
    ]);
  });

  it("a opção mais longa vence: 'Sim' não toma o lugar de 'Sim, com ressalvas'", () => {
    expect(escolhasMarcadas("Sim, com ressalvas", opcoes)).toEqual(["Sim, com ressalvas"]);
  });

  it("várias marcadas, inclusive uma com vírgula", () => {
    expect(escolhasMarcadas("Só redes sociais, Sim", opcoes)).toEqual(["Só redes sociais", "Sim"]);
  });

  it("espaço sobrando na opção do construtor não impede o casamento", () => {
    expect(escolhasMarcadas("Azul", ["  Azul  ", "Verde"])).toEqual(["  Azul  "]);
  });

  it("texto que não bate com opção nenhuma não vira escolha", () => {
    expect(escolhasMarcadas("Qualquer outra coisa", opcoes)).toEqual([]);
  });
});
