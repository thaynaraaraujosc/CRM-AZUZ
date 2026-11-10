import { describe, expect, it } from "vitest";

import {
  botoesDoTemplateLocal,
  botoesDoTemplateMeta,
  rotulosDosBotoes,
} from "../botoes-do-template";

/**
 * "PRECISO QUE APAREÇA PRA EU IDENTIFICAR SE FOI COM BOTÃO OU NÃO."
 *
 * A bolha já sabia desenhar botão enviado; quem manda MODELO é que não preenchia o campo. O modelo
 * saía com o botão, o cliente via o botão, e o CRM guardava só o texto — então a resposta
 * "CONFIRMAR" aparecia do nada, logo abaixo, sem nada que explicasse de onde tinha vindo.
 */

describe("botões no formato da Meta", () => {
  const componentes = [
    { type: "BODY", text: "Olá, {{1}}!" },
    {
      type: "BUTTONS",
      buttons: [
        { type: "QUICK_REPLY", text: "CONFIRMAR" },
        { type: "URL", text: "Regularize Agora", url: "https://exemplo.com/x" },
        { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5511999999999" },
      ],
    },
  ];

  it("lê os três tipos, com o destino de cada um", () => {
    expect(botoesDoTemplateMeta(componentes)).toEqual([
      { rotulo: "CONFIRMAR" },
      { rotulo: "Regularize Agora", url: "https://exemplo.com/x" },
      { rotulo: "Ligar", telefone: "+5511999999999" },
    ]);
  });

  it("modelo sem botões devolve lista vazia", () => {
    expect(botoesDoTemplateMeta([{ type: "BODY", text: "Oi" }])).toEqual([]);
  });

  /* Componente guardado torto (modelo antigo, campo renomeado pela Meta) não pode derrubar a tela
     de conversas: a ausência do botão é um detalhe, a bolha é o conteúdo. */
  it("aguenta lixo sem quebrar", () => {
    expect(botoesDoTemplateMeta(null)).toEqual([]);
    expect(botoesDoTemplateMeta("texto")).toEqual([]);
    expect(botoesDoTemplateMeta([{ type: "BUTTONS" }])).toEqual([]);
    expect(botoesDoTemplateMeta([{ type: "BUTTONS", buttons: [{ type: "QUICK_REPLY" }] }])).toEqual([]);
  });

  it("não se confunde com minúsculas", () => {
    const emMinusculo = [{ type: "buttons", buttons: [{ type: "quick_reply", text: "Sim" }] }];
    expect(botoesDoTemplateMeta(emMinusculo)).toEqual([{ rotulo: "Sim" }]);
  });
});

describe("botões no formato do CRM", () => {
  it("lê a lista do modelo local", () => {
    expect(botoesDoTemplateLocal([{ texto: "CONFIRMAR" }, { texto: "Reagendar" }])).toEqual([
      { rotulo: "CONFIRMAR" },
      { rotulo: "Reagendar" },
    ]);
  });

  it("ignora rótulo vazio", () => {
    expect(botoesDoTemplateLocal([{ texto: "  " }, { texto: "Sim" }])).toEqual([{ rotulo: "Sim" }]);
  });

  it("aguanta lixo", () => {
    expect(botoesDoTemplateLocal(undefined)).toEqual([]);
    expect(botoesDoTemplateLocal([null, 7, { outro: "x" }])).toEqual([]);
  });
});

describe("rotulosDosBotoes", () => {
  it("devolve só os rótulos", () => {
    expect(rotulosDosBotoes([{ rotulo: "A" }, { rotulo: "B", url: "https://x" }])).toEqual(["A", "B"]);
  });

  /*
   * VAZIO VIRA AUSENTE, e isto decide o que a bolha afirma.
   *
   * `[]` gravado na mensagem diz "este envio não teve botão". `undefined` diz "não há essa
   * informação". Pra um modelo sem botões as duas dão no mesmo; pro registro antigo, gravado antes
   * de isto existir, a diferença é entre não afirmar nada e afirmar errado.
   */
  it("lista vazia vira indefinido", () => {
    expect(rotulosDosBotoes([])).toBeUndefined();
  });
});
