import { describe, expect, it } from "vitest";

import { precisaTentarDeNovo } from "../historico-whatsapp";
import { ESPERA_ENTRE_REINICIOS_MS, type HistoricoSync } from "../historico-tipos";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: a conexão presa pra sempre sem as conversas do celular.
 *
 * Uma sessão recém-lida no QR Code demora pra montar a lista de conversas. Quando a importação
 * esgota as tentativas, ela fica gravada como "concluída com zero conversa" — e a regra antiga
 * ("não faz nada se já existe histórico") impedia qualquer nova tentativa, inclusive ao reconectar.
 * Dali em diante o CRM só mostrava mensagem nova, uma a uma, conforme alguém escrevesse.
 */
const base: HistoricoSync = { status: "concluido", totalChats: 10, chatsProcessados: 10, filaRestante: [] };
const agora = Date.parse("2026-10-02T12:00:00Z");

describe("precisaTentarDeNovo", () => {
  it("nunca houve importação: tenta", () => {
    expect(precisaTentarDeNovo(undefined)).toBe(true);
  });

  it("terminou sem conversa nenhuma: tenta de novo", () => {
    expect(precisaTentarDeNovo({ ...base, totalChats: 0 })).toBe(true);
  });

  it("terminou em erro: tenta de novo", () => {
    expect(precisaTentarDeNovo({ ...base, status: "erro" })).toBe(true);
  });

  // O que protege de reprocessar o celular inteiro a cada queda de sinal.
  it("trouxe conversa de verdade: NÃO mexe", () => {
    expect(precisaTentarDeNovo(base)).toBe(false);
  });

  it("em andamento: não atropela o progresso", () => {
    expect(precisaTentarDeNovo({ ...base, status: "em_andamento", totalChats: null })).toBe(false);
  });

  it("pausada pela usuária: não retoma por conta própria", () => {
    expect(precisaTentarDeNovo({ ...base, status: "pausado" })).toBe(false);
  });

  /*
   * A carência existe pro relógio, não pra pessoa. Sem ela, um celular que realmente não devolve
   * lista faria o CRM recomeçar a importação de minuto em minuto, pra sempre.
   */
  it("o relógio espera a carência antes de recomeçar", () => {
    const recem = { ...base, totalChats: 0, reiniciadoEm: new Date(agora - 60_000).toISOString() };

    expect(precisaTentarDeNovo(recem, { respeitarEspera: true, agora })).toBe(false);
  });

  it("passada a carência, o relógio recomeça sozinho", () => {
    const antigo = {
      ...base,
      totalChats: 0,
      reiniciadoEm: new Date(agora - ESPERA_ENTRE_REINICIOS_MS - 1).toISOString(),
    };

    expect(precisaTentarDeNovo(antigo, { respeitarEspera: true, agora })).toBe(true);
  });

  it("conectar na mão não espera carência: foi alguém que pediu", () => {
    const recem = { ...base, totalChats: 0, reiniciadoEm: new Date(agora - 1000).toISOString() };

    expect(precisaTentarDeNovo(recem, { agora })).toBe(true);
  });

  it("a carência não ressuscita uma importação que deu certo", () => {
    const antigo = { ...base, reiniciadoEm: new Date(agora - ESPERA_ENTRE_REINICIOS_MS * 10).toISOString() };

    expect(precisaTentarDeNovo(antigo, { respeitarEspera: true, agora })).toBe(false);
  });
});
