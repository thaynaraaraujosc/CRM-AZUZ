import { describe, expect, it } from "vitest";

import {
  mostraNome,
  mostraPaginas,
  mostraTitulo,
  numeraPerguntas,
  umaPerguntaPorVez,
} from "@/lib/formularios-context";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: formulário de cliente mudando de cara sozinho.
 *
 * As opções de exibição nasceram agora, mas já existem centenas de formulários gravados sem
 * nenhuma delas. Se `undefined` significasse "esconder", todos eles perderiam título, nome e
 * numeração de uma vez, no ar, sem ninguém ter pedido. Só `false` esconde — e é isso que estes
 * testes travam.
 */
describe("opções de exibição do formulário", () => {
  it("formulário antigo, sem nenhuma opção gravada, mostra tudo", () => {
    const antigo = {};

    expect(mostraPaginas(antigo)).toBe(true);
    expect(mostraTitulo(antigo)).toBe(true);
    expect(mostraNome(antigo)).toBe(true);
    expect(numeraPerguntas(antigo)).toBe(true);
  });

  it("só `false` esconde", () => {
    expect(mostraPaginas({ mostrarPaginas: false })).toBe(false);
    expect(mostraTitulo({ mostrarTitulo: false })).toBe(false);
    expect(mostraNome({ mostrarNome: false })).toBe(false);
    expect(numeraPerguntas({ numerarPerguntas: false })).toBe(false);
  });

  it("`true` explícito mostra, igual ao padrão", () => {
    expect(mostraPaginas({ mostrarPaginas: true })).toBe(true);
    expect(numeraPerguntas({ numerarPerguntas: true })).toBe(true);
  });

  // As quatro são independentes: esconder a barra de progresso e esconder o título são dois
  // pedidos diferentes, e já foram um botão só uma vez.
  it("esconder uma não esconde as outras", () => {
    const tema = { mostrarPaginas: false, mostrarTitulo: undefined, mostrarNome: undefined };

    expect(mostraTitulo(tema)).toBe(true);
    expect(mostraNome(tema)).toBe(true);
  });
});

describe("uma pergunta por vez", () => {
  it("o padrão é a página inteira", () => {
    expect(umaPerguntaPorVez({})).toBe(false);
    expect(umaPerguntaPorVez({ exibicao: "completo" })).toBe(false);
  });

  it("só quando foi escolhido", () => {
    expect(umaPerguntaPorVez({ exibicao: "uma-por-vez" })).toBe(true);
  });
});
