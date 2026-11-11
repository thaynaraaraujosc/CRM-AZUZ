import { describe, expect, it } from "vitest";

import { nomeAindaEhIdCru } from "../exibicao";

/**
 * O NÚMERO VIRA NOME NA PRIMEIRA VEZ QUE O NOME CHEGA.
 *
 * O CRM já puxava o nome de perfil do WhatsApp, mas uma vez só: na criação da conversa. Quem
 * chegou numa mensagem que não trouxe o nome nascia com o telefone no lugar dele e ficava assim pra
 * sempre — um funil cheio de "5511973935384" com o nome disponível a cada mensagem e ninguém
 * escrevendo.
 *
 * A troca é segura numa direção só, e é essa guarda que estes testes prendem: telefone no campo de
 * nome não é informação, é a ausência dela. Trocar um NOME por outro mexeria em automação, filtro
 * salvo e condição escritos com o nome antigo — por isso só o identificador cru é batizado.
 */
describe("o que ainda é identificador cru", () => {
  it("telefone é cru, com ou sem código do país", () => {
    expect(nomeAindaEhIdCru("5511973935384")).toBe(true);
    expect(nomeAindaEhIdCru("6299639023")).toBe(true);
  });

  /* Os ids longos que o WhatsApp passou a mandar (LID) também são número puro, e também precisam
     ser batizados quando o nome aparecer. */
  it("id longo do WhatsApp é cru", () => {
    expect(nomeAindaEhIdCru("131971611123817")).toBe(true);
  });

  it("nome de gente não é cru, nem quando tem número no meio", () => {
    expect(nomeAindaEhIdCru("Lucas Arantes")).toBe(false);
    expect(nomeAindaEhIdCru("Deus é amor")).toBe(false);
    expect(nomeAindaEhIdCru("Loja 24h")).toBe(false);
  });

  /* Número formatado já é vitrine, não identificador: a conversa que se chama "+55 62 9963-9023"
     foi batizada assim por alguém, e trocar isso seria renomear um nome. */
  it("telefone formatado não conta como cru", () => {
    expect(nomeAindaEhIdCru("+55 62 99639-0235")).toBe(false);
  });

  it("vazio não é nada", () => {
    expect(nomeAindaEhIdCru("")).toBe(false);
    expect(nomeAindaEhIdCru(null)).toBe(false);
    expect(nomeAindaEhIdCru(undefined)).toBe(false);
  });
});
