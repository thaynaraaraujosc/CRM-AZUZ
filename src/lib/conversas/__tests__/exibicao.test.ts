import { describe, expect, it } from "vitest";

import { iniciaisExibidas, nomeAindaEhIdCru, nomeExibido } from "@/lib/conversas/exibicao";

describe("nomeAindaEhIdCru", () => {
  it("reconhece identificador só de dígitos", () => {
    expect(nomeAindaEhIdCru("3984605438508218")).toBe(true);
    expect(nomeAindaEhIdCru("556294361377")).toBe(true);
  });

  it("não confunde com nome de gente", () => {
    expect(nomeAindaEhIdCru("Maria Fernanda")).toBe(false);
    expect(nomeAindaEhIdCru("@g4valley")).toBe(false);
    expect(nomeAindaEhIdCru("123")).toBe(false);
    expect(nomeAindaEhIdCru(null)).toBe(false);
  });
});

describe("nomeExibido", () => {
  /*
   * O DEFEITO QUE ISTO CONSERTA. Um telefone do WhatsApp é só dígitos, igual ao id do Instagram, e
   * a regra antiga olhava só isso. Toda conversa de WhatsApp de um número sem nome salvo aparecia
   * na caixa de entrada do WhatsApp escrito "Contato do Instagram": o CRM afirmando o canal errado
   * justamente na linha que existe pra dizer quem é.
   */
  it("mostra o telefone formatado numa conversa de WhatsApp, não o rótulo do Instagram", () => {
    expect(nomeExibido("556294361377", "WhatsApp")).toBe("+55 (62) 9436-1377");
    expect(nomeExibido("556294361377", "WhatsApp")).not.toContain("Instagram");
  });

  it("trata o histórico sem canal gravado como WhatsApp, que é o que ele é", () => {
    expect(nomeExibido("556294361377")).toBe("+55 (62) 9436-1377");
    expect(nomeExibido("556294361377", null)).toBe("+55 (62) 9436-1377");
  });

  it("mantém o rótulo neutro no id interno de uma thread do Instagram", () => {
    expect(nomeExibido("3984605438508218", "Instagram")).toBe("Contato do Instagram");
  });

  it("não mexe em nome de verdade", () => {
    expect(nomeExibido("Maria Fernanda", "WhatsApp")).toBe("Maria Fernanda");
    expect(nomeExibido("@g4valley", "Instagram")).toBe("@g4valley");
  });

  /*
   * O LID de participante de grupo tem 14-15 dígitos e NÃO é telefone. O formatador devolve `null`
   * pra ele de propósito (ver `telefone.ts`); aqui isso tem que virar os dígitos crus, e não uma
   * máscara internacional inventada.
   */
  it("devolve os dígitos crus quando o número não é telefone reconhecível", () => {
    expect(nomeExibido("33230329753761", "WhatsApp")).toBe("33230329753761");
  });
});

describe("iniciaisExibidas", () => {
  it("usa o arroba só no Instagram", () => {
    expect(iniciaisExibidas("3984605438508218", "39", "Instagram")).toBe("@");
  });

  it("não marca um telefone de WhatsApp com o arroba do Instagram", () => {
    expect(iniciaisExibidas("556294361377", "55", "WhatsApp")).toBe("55");
  });

  it("não mexe nas iniciais de um nome de verdade", () => {
    expect(iniciaisExibidas("Maria Fernanda", "MF", "WhatsApp")).toBe("MF");
    expect(iniciaisExibidas("@g4valley", "G4", "Instagram")).toBe("G4");
  });
});
