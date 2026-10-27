import { describe, expect, it } from "vitest";

import { explicarErroDoWhatsApp } from "../erro-whatsapp-oficial";

/**
 * O erro que motivou isto: "(#132001) Template name does not exist in the translation" aparecia
 * inteiro na tela de quem só queria mandar a primeira mensagem pra um cliente.
 */
describe("explicarErroDoWhatsApp", () => {
  it("traduz o modelo que não existe mais, e diz o que fazer", () => {
    const frase = explicarErroDoWhatsApp("(#132001) Template name does not exist in the translation");
    expect(frase).toContain("não existe mais");
    expect(frase).toContain("WhatsApp Manager");
    expect(frase).not.toContain("132001");
  });

  it("acha o código em qualquer formato que a Meta mandar", () => {
    expect(explicarErroDoWhatsApp('{"code":131047,"message":"Re-engagement message"}')).toContain("24 horas");
    expect(explicarErroDoWhatsApp("Erro 131026 ao enviar")).toContain("não recebe pelo WhatsApp");
  });

  /*
   * Erro desconhecido sai COMO VEIO, e isso é deliberado: inventar uma explicação genérica
   * esconderia a única pista que existe pra descobrir o que houve de verdade.
   */
  it("o que não tem tradução conhecida passa inteiro", () => {
    expect(explicarErroDoWhatsApp("Something entirely new went wrong")).toBe("Something entirely new went wrong");
  });

  it("vazio vira uma frase, nunca uma tela em branco", () => {
    expect(explicarErroDoWhatsApp("")).toBe("Falha ao enviar pelo WhatsApp.");
  });
});
