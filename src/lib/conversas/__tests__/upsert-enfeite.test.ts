import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: nenhuma mensagem chegando no CRM, por causa de uma FOTO.
 *
 * `Conversa.fotoUrl` estava declarada sem `@db.Text`, virava VARCHAR(191) no MySQL, e a URL de foto
 * do WhatsApp não cabia. O erro real, visto em produção:
 *
 *   "The provided value for the column is too long for the column's type. Column: fotoUrl"
 *
 * O efeito não era conversa sem foto: era a gravação da CONVERSA falhar, e com ela a mensagem.
 * Nenhuma conversa nova entrava, de pessoa nem de grupo, e nenhuma importação de histórico
 * terminava. A coluna foi corrigida; isto garante que um campo decorativo nunca mais fique entre o
 * cliente e a mensagem dele.
 */
const upsert = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { conversa: { upsert: (...a: unknown[]) => upsert(...a) } } }));

const { upsertConversaAoReceberMensagem } = await import("../upsert");

const base = { workspaceId: "w1", nome: "Gabriela", canal: "WhatsApp", contato: "5562999990001" };

beforeEach(() => {
  upsert.mockReset();
  upsert.mockResolvedValue({});
});

describe("upsertConversaAoReceberMensagem", () => {
  it("grava com a foto quando a foto cabe", async () => {
    await upsertConversaAoReceberMensagem({ ...base, fotoUrl: "https://cdn/foto.jpg" });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].create.fotoUrl).toBe("https://cdn/foto.jpg");
  });

  it("a foto falhando NÃO perde a conversa: regrava sem ela", async () => {
    upsert
      .mockRejectedValueOnce(new Error("The provided value for the column is too long. Column: fotoUrl"))
      .mockResolvedValueOnce({});

    await upsertConversaAoReceberMensagem({ ...base, fotoUrl: "x".repeat(5000) });

    expect(upsert).toHaveBeenCalledTimes(2);
    // A segunda tentativa entra sem nenhum enfeite, e com os dados que importam intactos.
    const segunda = upsert.mock.calls[1][0].create;
    expect(segunda.fotoUrl).toBeUndefined();
    expect(segunda.nome).toBe("Gabriela");
    expect(segunda.contato).toBe("5562999990001");
  });

  it("vale pra grupo também: participantes e descrição são enfeite", async () => {
    upsert.mockRejectedValueOnce(new Error("too long")).mockResolvedValueOnce({});

    await upsertConversaAoReceberMensagem({
      ...base,
      nome: "Clientes AZUZ",
      ehGrupo: true,
      participantesGrupo: [{ nome: "A", telefone: "1" }],
      descricaoGrupo: "d".repeat(5000),
      fotoUrl: "x".repeat(5000),
    });

    const segunda = upsert.mock.calls[1][0].create;
    expect(segunda.ehGrupo).toBe(true);
    expect(segunda.participantesGrupo).toBeUndefined();
    expect(segunda.descricaoGrupo).toBeUndefined();
  });

  it("não engole um erro que não é de enfeite: a segunda falha sobe", async () => {
    // Banco fora do ar não pode virar "gravei sem foto" em silêncio.
    upsert.mockRejectedValue(new Error("connection refused"));

    await expect(upsertConversaAoReceberMensagem({ ...base })).rejects.toThrow("connection refused");
  });
});
