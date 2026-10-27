import { describe, expect, it } from "vitest";

import { TENTATIVAS_DE_ASSINATURA } from "../instagram-login";

/**
 * O que estes testes prendem é a falha mais cara desta integração, e ela é silenciosa: a conta
 * aparece "Conectada" e NENHUMA mensagem do Direct chega, porque a Meta derruba a chamada inteira
 * quando um único campo é recusado.
 *
 * Já aconteceu uma vez por causa de um nome escrito errado (`messaging_reactions` em vez de
 * `message_reactions`). O recuo por etapas existe pra que, quando acontecer de novo, a caixa de
 * entrada continue funcionando — e a ORDEM das etapas é o que decide se isso dá certo.
 */
describe("as etapas de assinatura do webhook do Instagram", () => {
  it("começa pela lista completa", () => {
    expect(TENTATIVAS_DE_ASSINATURA[0]).toContain("messages");
    expect(TENTATIVAS_DE_ASSINATURA[0]).toContain("message_echoes");
    expect(TENTATIVAS_DE_ASSINATURA[0]).toContain("messaging_seen");
  });

  it("encurta a cada etapa, nunca cresce", () => {
    for (let i = 1; i < TENTATIVAS_DE_ASSINATURA.length; i += 1) {
      expect(TENTATIVAS_DE_ASSINATURA[i].length).toBeLessThan(TENTATIVAS_DE_ASSINATURA[i - 1].length);
    }
  });

  /*
   * O defeito que isto prende: o recuo ia direto pra "sem message_echoes". Com OUTRO campo sendo o
   * recusado, jogava fora o eco (que funciona) e mantinha o problemático — a chamada falhava de
   * novo e a conta ficava sem assinatura nenhuma.
   */
  it("o eco só sai depois do campo mais novo, e não antes", () => {
    const saiuSeen = TENTATIVAS_DE_ASSINATURA.findIndex((c) => !c.includes("messaging_seen"));
    const saiuEco = TENTATIVAS_DE_ASSINATURA.findIndex((c) => !c.includes("message_echoes"));
    expect(saiuSeen).toBeGreaterThan(0);
    expect(saiuEco).toBeGreaterThan(saiuSeen);
  });

  it("a última etapa é o núcleo que a conta precisa pra não ficar muda", () => {
    const ultima = TENTATIVAS_DE_ASSINATURA[TENTATIVAS_DE_ASSINATURA.length - 1];
    expect(ultima).toEqual(["messages", "comments"]);
  });
});
