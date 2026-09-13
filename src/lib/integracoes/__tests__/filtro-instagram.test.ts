import { describe, expect, it } from "vitest";

import { whereDoDirect, type FiltroDireto } from "../filtro-instagram";

/**
 * O defeito que estes testes prendem, relatado assim: "eu desconectei a minha conta e conectei a da
 * empresa, e as mensagens antigas continuaram aparecendo misturadas. Não existe isso."
 *
 * Ela está certa. O WhatsApp sempre teve a regra: desconectou, some da tela e volta ao reconectar.
 * O Instagram tinha sido deixado de fora, e o resultado era pior que o problema que a exceção
 * resolvia: duas contas na mesma lista, sem nada dizendo qual é qual, e responder uma conversa da
 * conta antiga falha, porque o identificador de cada pessoa é amarrado à conta que a recebeu.
 */
describe("whereDoDirect", () => {
  it("mostra só as conversas da conta conectada", () => {
    const filtro: FiltroDireto = { tipo: "daConta", contaCanal: "meta_instagram:178414006" };
    expect(whereDoDirect(filtro)).toEqual({
      OR: [{ contaCanal: "meta_instagram:178414006" }, { contaCanal: null }],
    });
  });

  // Conversa anterior à coluna existir veio de quando havia UMA conexão só: não mistura nada, e
  // escondê-la apagaria histórico da tela sem motivo.
  it("mantém o histórico antigo, que não tem conta marcada", () => {
    const filtro: FiltroDireto = { tipo: "daConta", contaCanal: "meta_instagram:178414006" };
    const where = whereDoDirect(filtro) as { OR: { contaCanal: string | null }[] };
    expect(where.OR).toContainEqual({ contaCanal: null });
  });

  // Instagram desconectado: caixa vazia, igual acontece com um número de WhatsApp desconectado.
  // Nada é apagado; reconectar traz tudo de volta.
  it("esvazia a caixa quando o Instagram não está conectado", () => {
    const where = whereDoDirect({ tipo: "nada" }) as { contaCanal: { in: string[] } };
    expect(where.contaCanal.in).toHaveLength(1);
    expect(where.contaCanal.in[0]).toContain("desconectado");
  });

  /*
   * A proteção que motivou a exceção original, preservada: quando o CRM não sabe o identificador da
   * conta conectada, mostra tudo. Esconder aqui protegeria contra um problema que não existe (duas
   * contas do mesmo provedor) e criaria um que existe (a pessoa não vê a mensagem que chegou).
   */
  it("mostra tudo quando não sabe o identificador da conta ligada", () => {
    expect(whereDoDirect({ tipo: "tudo" })).toEqual({});
  });

  it("o filtro de conta não vaza para outra conta", () => {
    const where = whereDoDirect({ tipo: "daConta", contaCanal: "meta_instagram:AAA" }) as {
      OR: { contaCanal: string | null }[];
    };
    expect(where.OR).not.toContainEqual({ contaCanal: "meta_instagram:BBB" });
  });
});
