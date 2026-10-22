import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A pergunta do Flow: "o que aconteceu com estas respostas?"
 *
 * O defeito que isto conserta: a tela de Respostas do Flow ficava parada em "Confirmação de
 * reunião na fila para envio." — a mensagem sai minutos depois, pelo cron, e ninguém avisava o
 * outro lado. A agência via "na fila" numa mensagem que já tinha chegado no WhatsApp.
 */

type Confirmacao = {
  id: string;
  respostaId: string | null;
  situacao: string;
  motivo: string | null;
  enviadaEm: Date | null;
};
type Entrega = { chaveExterna: string; confirmacaoId: string | null };

let confirmacoes: Confirmacao[] = [];
let entregas: Entrega[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    confirmacaoDeReuniao: {
      findMany: async ({ where }: { where: { respostaId?: { in: string[] }; id?: { in: string[] } } }) => {
        if (where.respostaId) return confirmacoes.filter((c) => c.respostaId && where.respostaId!.in.includes(c.respostaId));
        if (where.id) return confirmacoes.filter((c) => where.id!.in.includes(c.id));
        return [];
      },
    },
    leadRecebido: {
      findMany: async ({ where }: { where: { chaveExterna: { in: string[] } } }) =>
        entregas.filter((e) => where.chaveExterna.in.includes(e.chaveExterna) && e.confirmacaoId),
    },
  },
}));

const { situacaoDasConfirmacoes, MAXIMO_DE_IDS } = await import("../azuz-flow-confirmacoes-consulta");

const ENVIADA_EM = new Date("2026-10-21T23:59:00.000Z");

beforeEach(() => {
  confirmacoes = [];
  entregas = [];
});

describe("a entrega que criou a confirmação", () => {
  it("devolve situação, motivo e quando saiu", async () => {
    confirmacoes = [{ id: "conf-1", respostaId: "resp-1", situacao: "enviada", motivo: null, enviadaEm: ENVIADA_EM }];

    const r = await situacaoDasConfirmacoes("w1", ["resp-1"]);

    expect(r).toEqual({
      "resp-1": { situacao: "enviada", motivo: null, enviadaEm: "2026-10-21T23:59:00.000Z" },
    });
  });

  it("o motivo é a frase em português, a mesma da bolha", async () => {
    confirmacoes = [
      {
        id: "conf-2",
        respostaId: "resp-2",
        situacao: "nao_enviada",
        motivo: "Confirmação não enviada: este número não tem WhatsApp.",
        enviadaEm: null,
      },
    ];

    const r = await situacaoDasConfirmacoes("w1", ["resp-2"]);

    expect(r["resp-2"].situacao).toBe("nao_enviada");
    expect(r["resp-2"].motivo).toBe("Confirmação não enviada: este número não tem WhatsApp.");
    expect(r["resp-2"].enviadaEm).toBeNull();
  });
});

describe("a MESMA pessoa preenchendo de novo, com a mesma reunião", () => {
  it("a resposta nova aponta pra confirmação que já existia", async () => {
    /*
     * O caso que exige o segundo caminho de busca. A entrega nova tem `respostaId` novo e NÃO cria
     * confirmação nova — a trava de telefone + início recusa, e isso é o certo: ninguém deve
     * receber a mesma confirmação duas vezes.
     *
     * Sem a ligação guardada na ENTREGA, perguntar pelo id novo não acharia nada, e a tela do Flow
     * continuaria mostrando "na fila" pra sempre — que é exatamente o defeito original.
     */
    confirmacoes = [{ id: "conf-1", respostaId: "resp-1", situacao: "enviada", motivo: null, enviadaEm: ENVIADA_EM }];
    entregas = [
      { chaveExterna: "resp-1", confirmacaoId: "conf-1" },
      { chaveExterna: "resp-2", confirmacaoId: "conf-1" },
    ];

    const r = await situacaoDasConfirmacoes("w1", ["resp-1", "resp-2"]);

    // Os dois ids respondem a mesma coisa, porque é a mesma confirmação.
    expect(r["resp-1"]).toEqual(r["resp-2"]);
    expect(r["resp-2"].situacao).toBe("enviada");
  });
});

describe("o que fica de fora", () => {
  it("id desconhecido não aparece — e isso não é erro", async () => {
    // O Flow pergunta por um lote, e um lote contém entregas que nunca geraram confirmação: lead
    // sem reunião, sem consentimento, sem WhatsApp.
    confirmacoes = [{ id: "conf-1", respostaId: "resp-1", situacao: "na_fila", motivo: null, enviadaEm: null }];

    const r = await situacaoDasConfirmacoes("w1", ["resp-1", "resp-nunca-existiu"]);

    expect(Object.keys(r)).toEqual(["resp-1"]);
  });

  it("lista vazia não consulta nada", async () => {
    expect(await situacaoDasConfirmacoes("w1", [])).toEqual({});
    expect(await situacaoDasConfirmacoes("w1", ["   "])).toEqual({});
  });

  it("ids repetidos contam uma vez", async () => {
    confirmacoes = [{ id: "conf-1", respostaId: "resp-1", situacao: "na_fila", motivo: null, enviadaEm: null }];
    const r = await situacaoDasConfirmacoes("w1", ["resp-1", "resp-1", " resp-1 "]);
    expect(Object.keys(r)).toEqual(["resp-1"]);
  });

  it("o lote tem teto", async () => {
    // Um lote sem limite é uma consulta sem limite.
    confirmacoes = Array.from({ length: 60 }, (_, i) => ({
      id: `conf-${i}`,
      respostaId: `resp-${i}`,
      situacao: "na_fila",
      motivo: null,
      enviadaEm: null,
    }));

    const r = await situacaoDasConfirmacoes("w1", confirmacoes.map((c) => c.respostaId!));

    expect(Object.keys(r)).toHaveLength(MAXIMO_DE_IDS);
  });
});
