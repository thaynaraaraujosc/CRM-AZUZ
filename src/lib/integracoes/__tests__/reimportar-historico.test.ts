import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A REGRESSÃO QUE ESTE TESTE PRENDE: "quero que cheguem os grupos antigos", sem caminho de volta.
 *
 * Só as 30 conversas mais recentes do celular vinham sozinhas. As outras ficavam em `filaGuardada`,
 * atrás do botão "Trazer as mais antigas" — que só existia enquanto sobrasse algo guardado. Com a
 * fila vazia e a importação concluída, não havia NENHUMA forma de rodar de novo: a conversa antiga
 * só apareceria se alguém escrevesse nela outra vez. O único escape era ler o QR Code de novo.
 */
const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    integracao: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const { reimportarHistorico } = await import("../historico-whatsapp");

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  update.mockResolvedValue({});
});

describe("reimportarHistorico", () => {
  it("volta a fila pra `null`, que é o que faz buscar a lista do celular de novo", async () => {
    findUnique.mockResolvedValue({
      metadados: { historico: { status: "concluido", totalChats: 30, chatsProcessados: 30, filaRestante: [], filaGuardada: [] } },
    });

    const historico = await reimportarHistorico("w1");

    // `filaRestante: null` é o sinal de "ainda não busquei a lista" lido por `avancarHistorico`.
    expect(historico.filaRestante).toBeNull();
    expect(historico.status).toBe("em_andamento");
  });

  it("não zera o que já foi importado, pra tela não parecer que perdeu o trabalho", async () => {
    findUnique.mockResolvedValue({
      metadados: { historico: { status: "concluido", totalChats: 30, chatsProcessados: 27, filaRestante: [] } },
    });

    expect((await reimportarHistorico("w1")).chatsProcessados).toBe(27);
  });

  it("limpa as tentativas sem conversa, senão a desistência anterior ainda valeria", async () => {
    findUnique.mockResolvedValue({
      metadados: { historico: { status: "concluido", totalChats: 0, chatsProcessados: 0, filaRestante: [], tentativasSemChats: 15 } },
    });

    expect((await reimportarHistorico("w1")).tentativasSemChats).toBe(0);
  });

  it("funciona em quem nunca importou nada", async () => {
    findUnique.mockResolvedValue({ metadados: {} });

    const historico = await reimportarHistorico("w1");

    expect(historico.chatsProcessados).toBe(0);
    expect(historico.filaRestante).toBeNull();
  });

  it("preserva o resto dos metadados: número e webhook não podem ser perdidos", async () => {
    findUnique.mockResolvedValue({
      metadados: { numero: "5562999990000", webhook: { ultimoEvento: "messages.upsert" }, historico: { status: "concluido" } },
    });

    await reimportarHistorico("w1");

    const gravado = update.mock.calls[0][0].data.metadados as Record<string, unknown>;
    expect(gravado.numero).toBe("5562999990000");
    expect(gravado.webhook).toEqual({ ultimoEvento: "messages.upsert" });
  });
});
