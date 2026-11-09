import { describe, expect, it } from "vitest";

import { pedacosDoTexto } from "../variaveis-no-texto";

/**
 * A prévia do bloco mostra a variável como etiqueta, e pra isso precisa achá-la no meio do texto.
 * O motor aceita `{chave}` e `{{chave}}`: reconhecer só uma faria metade das mensagens aparecerem
 * com chave crua na tela que existe pra mostrar o que o contato recebe.
 */
describe("os pedaços do texto de uma mensagem", () => {
  it("separa a variável de chave simples", () => {
    expect(pedacosDoTexto("Oi {primeiro_nome}, tudo bem?")).toEqual([
      { tipo: "texto", valor: "Oi " },
      { tipo: "variavel", valor: "primeiro_nome" },
      { tipo: "texto", valor: ", tudo bem?" },
    ]);
  });

  it("separa a de chave dupla, que o motor também aceita", () => {
    expect(pedacosDoTexto("Oi {{nome_completo}}")).toEqual([
      { tipo: "texto", valor: "Oi " },
      { tipo: "variavel", valor: "nome_completo" },
    ]);
  });

  it("entende a variável de reunião, que tem ponto no nome", () => {
    expect(pedacosDoTexto("{reuniao.data}")).toEqual([{ tipo: "variavel", valor: "reuniao.data" }]);
  });

  it("texto sem variável nenhuma é um pedaço só", () => {
    expect(pedacosDoTexto("Bom dia!")).toEqual([{ tipo: "texto", valor: "Bom dia!" }]);
  });

  it("texto vazio não produz pedaço", () => {
    expect(pedacosDoTexto("")).toEqual([]);
  });
});
