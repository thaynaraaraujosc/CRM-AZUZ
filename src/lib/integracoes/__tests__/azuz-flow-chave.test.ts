import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chaveDeIntegracao: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const { autenticarChaveDoFlow, PREFIXO_CHAVE_FLOW } = await import("../azuz-flow-chave");
const { createHash } = await import("node:crypto");

const CHAVE = `${PREFIXO_CHAVE_FLOW}${"a".repeat(43)}`;
const HASH = createHash("sha256").update(CHAVE).digest("hex");

function linha(extra: Record<string, unknown> = {}) {
  return { id: "k1", workspaceId: "w1", revogadaEm: null, ultimoUsoEm: null, hashDaChave: HASH, ...extra };
}

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  update.mockResolvedValue({});
});

describe("autenticarChaveDoFlow", () => {
  it("aceita a chave boa e devolve a empresa DELA", async () => {
    findUnique.mockResolvedValue(linha());
    const r = await autenticarChaveDoFlow(`Bearer ${CHAVE}`);
    // A empresa vem da chave, nunca do corpo: é o que impede escrever no CRM dos outros.
    expect(r).toEqual({ workspaceId: "w1", chaveId: "k1" });
  });

  it("recusa ausente, mal formada, desconhecida e revogada — todas do mesmo jeito", async () => {
    // Nenhuma delas pode ser distinguível de fora: dizer "essa existe mas foi revogada" conta a
    // quem está sondando que o palpite acertou o formato.
    findUnique.mockResolvedValue(null);
    expect(await autenticarChaveDoFlow(null)).toBeNull();
    expect(await autenticarChaveDoFlow("")).toBeNull();
    expect(await autenticarChaveDoFlow("Bearer")).toBeNull();
    expect(await autenticarChaveDoFlow(`Basic ${CHAVE}`)).toBeNull();
    expect(await autenticarChaveDoFlow("Bearer chave-de-outro-formato")).toBeNull();
    expect(await autenticarChaveDoFlow(`Bearer ${CHAVE}`)).toBeNull();

    findUnique.mockResolvedValue(linha({ revogadaEm: new Date() }));
    expect(await autenticarChaveDoFlow(`Bearer ${CHAVE}`)).toBeNull();
  });

  it("nunca procura pela chave em claro: só o hash vai ao banco", async () => {
    findUnique.mockResolvedValue(linha());
    await autenticarChaveDoFlow(`Bearer ${CHAVE}`);
    const consulta = JSON.stringify(findUnique.mock.calls[0]);
    expect(consulta).toContain(HASH);
    expect(consulta).not.toContain(CHAVE);
  });

  it("anota o último uso no máximo uma vez por minuto", async () => {
    findUnique.mockResolvedValue(linha({ ultimoUsoEm: null }));
    await autenticarChaveDoFlow(`Bearer ${CHAVE}`);
    expect(update).toHaveBeenCalledTimes(1);

    // Usada agora há pouco: não grava de novo. Seria uma escrita por lead recebido.
    update.mockReset();
    findUnique.mockResolvedValue(linha({ ultimoUsoEm: new Date() }));
    await autenticarChaveDoFlow(`Bearer ${CHAVE}`);
    expect(update).not.toHaveBeenCalled();
  });

  it("falha ao anotar o uso não recusa a chave", async () => {
    findUnique.mockResolvedValue(linha());
    update.mockRejectedValue(new Error("banco fora"));
    // Anotar o último uso é conveniência de tela; derrubar um lead por causa disso seria perder
    // dado de cliente por causa de um carimbo.
    expect(await autenticarChaveDoFlow(`Bearer ${CHAVE}`)).toEqual({ workspaceId: "w1", chaveId: "k1" });
  });
});
