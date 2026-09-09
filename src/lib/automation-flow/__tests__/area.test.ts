import { describe, expect, it } from "vitest";

import { areaCombina, areaDoCanal, mesmoCanal } from "../disparar-no-servidor";
import type { FluxoAutomacao } from "../types";

function fluxo(area?: "comercial" | "social"): FluxoAutomacao {
  return { area } as FluxoAutomacao;
}

/**
 * Duas coisas estão em jogo aqui, e as duas custam caro quando erram.
 *
 * A primeira: um robô comercial não pode responder quem escreveu no Direct. O fluxo foi escrito
 * pra outro canal, com outro tom e outras opções, e a pessoa do outro lado recebe uma conversa que
 * não é pra ela.
 *
 * A segunda, oposta: um robô que já está rodando na conta de alguém não pode parar de rodar por
 * causa de uma coluna nova. Fluxo sem área é fluxo anterior a esta mudança, e ele continua se
 * comportando exatamente como antes.
 */
describe("área do evento", () => {
  it("separa Direct de WhatsApp e do CRM", () => {
    expect(areaDoCanal("Instagram")).toBe("social");
    expect(areaDoCanal("WhatsApp")).toBe("comercial");
    expect(areaDoCanal("CRM")).toBe("comercial");
  });
});

describe("qual fluxo atende qual evento", () => {
  it("mantém cada robô na área dele", () => {
    expect(areaCombina(fluxo("social"), "social")).toBe(true);
    expect(areaCombina(fluxo("social"), "comercial")).toBe(false);
    expect(areaCombina(fluxo("comercial"), "comercial")).toBe(true);
    expect(areaCombina(fluxo("comercial"), "social")).toBe(false);
  });

  it("não muda o comportamento de fluxo já existente", () => {
    expect(areaCombina(fluxo(undefined), "social")).toBe(true);
    expect(areaCombina(fluxo(undefined), "comercial")).toBe(true);
  });
});

describe("canal do bloco contra canal da conversa", () => {
  it("não deixa uma letra maiúscula matar o gatilho", () => {
    // Os blocos do Instagram gravam "Instagram"; a conversa chega como "instagram". Com comparação
    // crua, todo fluxo de Instagram era descartado em silêncio: o gatilho existia, o evento
    // chegava, e nada acontecia. Nenhum erro em lugar nenhum, que é o pior tipo de defeito.
    expect(mesmoCanal("Instagram", "instagram")).toBe(true);
    expect(mesmoCanal("instagram", "Instagram")).toBe(true);
    expect(mesmoCanal(" WhatsApp ", "whatsapp")).toBe(true);
  });

  it("continua separando canais diferentes", () => {
    expect(mesmoCanal("whatsapp", "instagram")).toBe(false);
  });
});
