import { describe, expect, it } from "vitest";

import {
  componentesParaMeta,
  extrairVariaveis,
  mapearVariaveis,
  paraNomeadas,
  paraNumeradas,
  preencherVariaveis,
  quantidadeNumeradas,
  resolverParametros,
  variaveisSemValor,
} from "../variaveis";

/**
 * O que está em jogo aqui é dinheiro e reputação: uma variável trocada de posição manda "Olá,
 * Plano X" pra Maria, e um parâmetro vazio faz a Meta recusar o envio inteiro. Depois de a cota
 * do dia já ter sido gasta. Os testes fixam as regras de conversão pra que nenhuma mexida no
 * editor de templates as mude sem querer.
 */
describe("variáveis nomeadas", () => {
  it("extrai na ordem em que aparecem, sem repetir", () => {
    expect(extrairVariaveis("Olá {{nome}}, o {{produto}} que {{ nome }} pediu")).toEqual(["nome", "produto"]);
  });

  it("adivinha a origem pelo nome do campo e deixa o resto como texto", () => {
    const mapa = mapearVariaveis("Olá {{nome}} da {{empresa}}, sobre {{produto}}");
    expect(mapa).toEqual([
      { chave: "nome", indice: 1, origem: "contato.nome" },
      { chave: "empresa", indice: 2, origem: "contato.empresa" },
      { chave: "produto", indice: 3, origem: "texto" },
    ]);
  });

  it("preserva índice e origem ao editar o texto. A Meta já conhece {{1}} pelo número", () => {
    const anterior = mapearVariaveis("Olá {{nome}}, sobre {{produto}}");
    // Tirou {{nome}} e acrescentou {{empresa}}: {{produto}} continua sendo o 2.
    const novo = mapearVariaveis("Sobre {{produto}}, {{empresa}}", anterior);
    expect(novo.find((v) => v.chave === "produto")?.indice).toBe(2);
    expect(novo.find((v) => v.chave === "empresa")?.indice).toBe(1);
  });

  it("preenche e deixa visível o que não tem valor", () => {
    expect(preencherVariaveis("Olá {{nome}}, {{produto}}", { nome: "Maria" })).toBe("Olá Maria, {{produto}}");
  });
});

describe("resolução por pessoa", () => {
  const mapa = mapearVariaveis("Olá {{nome}} da {{empresa}}, sobre {{produto}}");
  const comValorFixo = mapa.map((v) => (v.chave === "produto" ? { ...v, valor: "Plano Anual" } : v));

  it("lê do contato ou do valor fixo, conforme a origem", () => {
    const parametros = resolverParametros(comValorFixo, { nome: "Maria", empresa: "  Azuz " });
    expect(parametros).toEqual({ nome: "Maria", empresa: "Azuz", produto: "Plano Anual" });
    expect(variaveisSemValor(comValorFixo, parametros)).toEqual([]);
  });

  it("aponta o que ficou vazio, pra tela avisar antes do disparo", () => {
    const parametros = resolverParametros(comValorFixo, { nome: "Maria", empresa: null });
    expect(variaveisSemValor(comValorFixo, parametros)).toEqual(["empresa"]);
  });
});

describe("conversão pra Meta", () => {
  const mapa = mapearVariaveis("Olá {{nome}}, sobre {{produto}}");

  it("vai e volta entre nomeada e numerada", () => {
    const numerada = paraNumeradas("Olá {{nome}}, sobre {{produto}}", mapa);
    expect(numerada).toBe("Olá {{1}}, sobre {{2}}");
    expect(paraNomeadas(numerada, mapa)).toBe("Olá {{nome}}, sobre {{produto}}");
    expect(quantidadeNumeradas(numerada)).toBe(2);
  });

  it("monta os parâmetros na ordem dos índices, nunca na ordem do objeto", () => {
    const invertido = [...mapa].reverse();
    const componentes = componentesParaMeta(invertido, { produto: "Plano X", nome: "Maria" });
    expect(componentes?.[0].parameters.map((p) => p.text)).toEqual(["Maria", "Plano X"]);
  });

  it("não manda componente nenhum quando o modelo não tem variável", () => {
    expect(componentesParaMeta([], {})).toBeUndefined();
  });
});
