import { describe, expect, it } from "vitest";

import { CHATS_NA_PRIMEIRA_LEVA, separarPrimeiraLeva } from "../historico-tipos";

/**
 * O número aqui não é decoração. Importar o celular inteiro de uma vez já derrubou o CRM numa
 * conexão real, com 41 mil mensagens de enfiada, e importar "as primeiras que vierem" traz
 * conversa de dois anos atrás no lugar da de ontem. A primeira leva é curta e é das recentes.
 */
function chats(n: number) {
  return Array.from({ length: n }, (_, i) => ({ remoteJid: `${i}@s.whatsapp.net` }));
}

describe("primeira leva do histórico do WhatsApp", () => {
  it("traz só as mais recentes e guarda o resto", () => {
    const { primeiras, guardadas } = separarPrimeiraLeva(chats(120));
    expect(primeiras).toHaveLength(CHATS_NA_PRIMEIRA_LEVA);
    expect(guardadas).toHaveLength(120 - CHATS_NA_PRIMEIRA_LEVA);
    // A ordem que chegou é preservada: quem consome já entrega da mais recente pra mais antiga.
    expect(primeiras[0].remoteJid).toBe("0@s.whatsapp.net");
    expect(guardadas[0].remoteJid).toBe(`${CHATS_NA_PRIMEIRA_LEVA}@s.whatsapp.net`);
  });

  it("com poucas conversas não sobra nada guardado", () => {
    const { primeiras, guardadas } = separarPrimeiraLeva(chats(4));
    expect(primeiras).toHaveLength(4);
    expect(guardadas).toHaveLength(0);
  });

  it("celular sem conversa nenhuma não quebra", () => {
    expect(separarPrimeiraLeva([])).toEqual({ primeiras: [], guardadas: [] });
  });
});
