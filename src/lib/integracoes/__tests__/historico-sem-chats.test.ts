import { describe, expect, it } from "vitest";

import {
  CHATS_NA_PRIMEIRA_LEVA,
  TENTATIVAS_MAXIMAS_SEM_CHATS,
  separarPrimeiraLeva,
  type HistoricoSync,
} from "../historico-tipos";

/**
 * A falha que estes testes prendem: "conectei o QR Code e as conversas antigas não vieram".
 *
 * Uma sessão recém-lida demora pra montar a lista de conversas do celular, e a primeira consulta
 * volta vazia com frequência. O código gravava fila vazia, e na rodada seguinte fila vazia virava
 * `concluido`: a importação terminava em segundos, com zero conversa, sem erro em lugar nenhum, e
 * nunca mais tentava. Era uma falha que se parecia exatamente com sucesso.
 *
 * Aqui a decisão é reproduzida na forma pura (a função real fala com a Evolution e com o banco),
 * porque é a regra que decide entre "tenta de novo" e "desiste".
 */
function decidirComListaVazia(historico: HistoricoSync): HistoricoSync {
  const tentativas = (historico.tentativasSemChats ?? 0) + 1;
  return tentativas >= TENTATIVAS_MAXIMAS_SEM_CHATS
    ? {
        ...historico,
        status: "concluido",
        totalChats: 0,
        filaRestante: [],
        tentativasSemChats: tentativas,
        erro: "A Evolution não devolveu nenhuma conversa desse número depois de várias tentativas.",
      }
    : { ...historico, tentativasSemChats: tentativas, filaRestante: null };
}

const recemConectado: HistoricoSync = {
  status: "em_andamento",
  totalChats: null,
  chatsProcessados: 0,
  filaRestante: null,
};

describe("lista de conversas vazia", () => {
  // O defeito original: a primeira resposta vazia encerrava tudo.
  it("não conclui a importação na primeira vez que volta vazia", () => {
    const depois = decidirComListaVazia(recemConectado);
    expect(depois.status).toBe("em_andamento");
    expect(depois.tentativasSemChats).toBe(1);
  });

  // `filaRestante` precisa continuar nula: é isso que faz a rodada seguinte consultar de novo.
  // Gravar `[]` aqui era o que transformava "ainda não chegou" em "acabou".
  it("mantém a fila nula, pra consultar de novo no próximo minuto", () => {
    expect(decidirComListaVazia(recemConectado).filaRestante).toBeNull();
  });

  it("continua tentando durante várias rodadas", () => {
    let atual = recemConectado;
    for (let i = 0; i < TENTATIVAS_MAXIMAS_SEM_CHATS - 1; i += 1) {
      atual = decidirComListaVazia(atual);
      expect(atual.status, `rodada ${i + 1}`).toBe("em_andamento");
    }
  });

  // Não pode tentar pra sempre: uma conta que realmente não tem conversa nenhuma existe.
  it("desiste depois do teto, e escreve o motivo", () => {
    let atual = recemConectado;
    for (let i = 0; i < TENTATIVAS_MAXIMAS_SEM_CHATS; i += 1) atual = decidirComListaVazia(atual);
    expect(atual.status).toBe("concluido");
    expect(atual.erro).toContain("nenhuma conversa");
  });

  it("dá tempo de sobra pra sessão sincronizar", () => {
    // O relógio roda de minuto em minuto: o teto precisa valer mais que alguns minutos.
    expect(TENTATIVAS_MAXIMAS_SEM_CHATS).toBeGreaterThanOrEqual(10);
  });
});

describe("separarPrimeiraLeva", () => {
  const chats = Array.from({ length: 50 }, (_, i) => ({ remoteJid: `${i}@s.whatsapp.net` }));

  it("traz as 30 mais recentes e guarda o resto", () => {
    const { primeiras, guardadas } = separarPrimeiraLeva(chats);
    expect(primeiras).toHaveLength(CHATS_NA_PRIMEIRA_LEVA);
    expect(guardadas).toHaveLength(50 - CHATS_NA_PRIMEIRA_LEVA);
  });

  it("com poucas conversas, traz todas e não guarda nada", () => {
    const { primeiras, guardadas } = separarPrimeiraLeva(chats.slice(0, 7));
    expect(primeiras).toHaveLength(7);
    expect(guardadas).toHaveLength(0);
  });
});
