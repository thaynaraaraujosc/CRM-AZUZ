import { describe, expect, it } from "vitest";

import {
  botoesDaMensagem,
  contaComercialDaMensagem,
  formatoDeEmpresa,
} from "@/lib/integracoes/mensagem-de-empresa";
import { desembrulharMensagem } from "@/lib/integracoes/texto-da-mensagem";

describe("formatoDeEmpresa", () => {
  it("reconhece os formatos que só a API de negócios manda", () => {
    expect(formatoDeEmpresa({ templateMessage: {} })).toBe(true);
    expect(formatoDeEmpresa({ buttonsMessage: {} })).toBe(true);
    expect(formatoDeEmpresa({ listMessage: {} })).toBe(true);
    expect(formatoDeEmpresa({ interactiveMessage: {} })).toBe(true);
    expect(formatoDeEmpresa({ highlyStructuredMessage: {} })).toBe(true);
  });

  it("não marca mensagem de pessoa", () => {
    expect(formatoDeEmpresa({ conversation: "oi" })).toBe(false);
    expect(formatoDeEmpresa({ extendedTextMessage: { text: "oi" } })).toBe(false);
    expect(formatoDeEmpresa({ imageMessage: {} })).toBe(false);
    expect(formatoDeEmpresa(null)).toBe(false);
  });
});

describe("contaComercialDaMensagem", () => {
  it("usa o nome que a Meta verificou", () => {
    const conta = contaComercialDaMensagem({ verifiedBizName: "G4 Valley" }, { conversation: "oi" });
    expect(conta).toEqual({ nome: "G4 Valley", peloFormato: false });
  });

  /*
   * Conta comercial NÃO verificada existe, e é comum. Sem `verifiedBizName`, a única coisa que
   * ainda afirma "isto saiu de um sistema" é o formato — e é por isso que ele vale sozinho.
   */
  it("marca pelo formato quando não há nome verificado", () => {
    expect(contaComercialDaMensagem({}, { templateMessage: {} })).toEqual({ peloFormato: true });
  });

  it("não marca nada numa mensagem de pessoa", () => {
    expect(contaComercialDaMensagem({ pushName: "Maria" }, { conversation: "oi" })).toBeNull();
  });

  /*
   * Mensagem de empresa dentro de conversa com mensagens temporárias chega embrulhada. Passar o
   * nível de cima faria o CRM responder "não é empresa" justamente pra quem liga esse recurso.
   */
  it("enxerga o formato através do embrulho de mensagem temporária", () => {
    const evento = { message: { ephemeralMessage: { message: { templateMessage: {} } } } };
    expect(formatoDeEmpresa(desembrulharMensagem(evento.message))).toBe(true);
  });
});

describe("botoesDaMensagem", () => {
  it("lê os botões de resposta rápida de um template", () => {
    const botoes = botoesDaMensagem({
      templateMessage: {
        hydratedTemplate: {
          hydratedContentText: "Deseja saber mais?",
          hydratedButtons: [
            { index: 0, quickReplyButton: { displayText: "SIM", id: "sim_1" } },
            { index: 1, quickReplyButton: { displayText: "NÃO", id: "nao_1" } },
          ],
        },
      },
    });
    expect(botoes).toEqual([
      { rotulo: "SIM", id: "sim_1" },
      { rotulo: "NÃO", id: "nao_1" },
    ]);
  });

  it("separa botão de link e botão de ligar do botão de responder", () => {
    const botoes = botoesDaMensagem({
      templateMessage: {
        hydratedTemplate: {
          hydratedButtons: [
            { urlButton: { displayText: "Ver ingresso", url: "https://g4valley.com/ingresso" } },
            { callButton: { displayText: "Ligar", phoneNumber: "+5541999999999" } },
          ],
        },
      },
    });
    expect(botoes).toEqual([
      { rotulo: "Ver ingresso", url: "https://g4valley.com/ingresso" },
      { rotulo: "Ligar", telefone: "+5541999999999" },
    ]);
  });

  it("lê o formato antigo de botões", () => {
    expect(
      botoesDaMensagem({
        buttonsMessage: {
          contentText: "Escolha",
          buttons: [{ buttonId: "1", buttonText: { displayText: "SIM" }, type: "RESPONSE" }],
        },
      }),
    ).toEqual([{ rotulo: "SIM", id: "1" }]);
  });

  it("lê os itens de um menu de lista, de todas as seções", () => {
    expect(
      botoesDaMensagem({
        listMessage: {
          sections: [
            { title: "Planos", rows: [{ title: "Individual", rowId: "p1" }] },
            { title: "Outros", rows: [{ title: "Familiar", rowId: "p2" }] },
          ],
        },
      }),
    ).toEqual([
      { rotulo: "Individual", id: "p1" },
      { rotulo: "Familiar", id: "p2" },
    ]);
  });

  it("lê o formato interativo novo, cujos parâmetros vêm como texto com JSON dentro", () => {
    expect(
      botoesDaMensagem({
        interactiveMessage: {
          body: { text: "Deseja saber mais?" },
          nativeFlowMessage: {
            buttons: [
              { name: "quick_reply", buttonParamsJson: '{"display_text":"SIM","id":"sim_1"}' },
              { name: "cta_url", buttonParamsJson: '{"display_text":"Site","url":"https://exemplo.com"}' },
            ],
          },
        },
      }),
    ).toEqual([
      { rotulo: "SIM", id: "sim_1" },
      { rotulo: "Site", url: "https://exemplo.com" },
    ]);
  });

  /*
   * `buttonParamsJson` é texto vindo de fora. JSON quebrado não pode derrubar o recebimento da
   * mensagem: a mensagem é o que importa, o botão é o enfeite.
   */
  it("ignora parâmetro com JSON quebrado em vez de estourar", () => {
    expect(() =>
      botoesDaMensagem({
        interactiveMessage: { nativeFlowMessage: { buttons: [{ buttonParamsJson: "{não é json" }] } },
      }),
    ).not.toThrow();
    expect(
      botoesDaMensagem({
        interactiveMessage: { nativeFlowMessage: { buttons: [{ buttonParamsJson: "{não é json" }] } },
      }),
    ).toEqual([]);
  });

  /*
   * A REGRA QUE IMPEDE O BOTÃO INVENTADO. A mensagem do print dizia "Deseja saber mais? 1 SIM
   * 2 NÃO" — e aquilo é TEXTO que a empresa digitou, não botão. Transformar em botão clicável daria
   * à tela um botão que o celular de quem mandou não tem, e a resposta sairia num formato que o
   * sistema do outro lado pode não esperar.
   */
  it("não transforma menu numerado escrito no texto em botão", () => {
    expect(botoesDaMensagem({ conversation: "Deseja saber mais?\n1️⃣ SIM\n2️⃣ NÃO" })).toEqual([]);
    expect(
      botoesDaMensagem({ extendedTextMessage: { text: "Responda 1 para SIM ou 2 para NÃO" } }),
    ).toEqual([]);
  });

  it("não repete o mesmo rótulo quando ele chega em dois formatos", () => {
    expect(
      botoesDaMensagem({
        templateMessage: { hydratedTemplate: { hydratedButtons: [{ quickReplyButton: { displayText: "SIM" } }] } },
        interactiveMessage: {
          nativeFlowMessage: { buttons: [{ buttonParamsJson: '{"display_text":"sim"}' }] },
        },
      }),
    ).toEqual([{ rotulo: "SIM" }]);
  });

  it("não estoura com payload fora do formato esperado", () => {
    expect(botoesDaMensagem({ listMessage: { sections: "não é lista" } })).toEqual([]);
    expect(botoesDaMensagem({ buttonsMessage: { buttons: [null, 7, {}] } })).toEqual([]);
    expect(botoesDaMensagem(null)).toEqual([]);
  });

  it("corta uma quantidade absurda de botões", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => ({ title: `Opção ${i}`, rowId: `r${i}` }));
    expect(botoesDaMensagem({ listMessage: { sections: [{ rows: muitos }] } })).toHaveLength(12);
  });
});
