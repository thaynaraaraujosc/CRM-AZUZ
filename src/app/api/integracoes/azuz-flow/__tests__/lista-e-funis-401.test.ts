import { describe, expect, it, vi } from "vitest";

/**
 * CHAVE INVÁLIDA DEVOLVE 401 COM CORPO JSON — nas duas rotas novas.
 *
 * Este teste existe por um defeito que já foi pra produção: a autenticação consulta o banco, e com
 * a tabela de chaves ausente ela estourava ANTES do `try` da rota. O Flow recebia um 500 de corpo
 * vazio, e um corpo vazio não diz se a chave está errada, se o CRM caiu ou se a coluna entrou.
 *
 * Por isso o teste usa uma chave de FORMATO VÁLIDO: a recusa por formato acontece antes de tocar o
 * banco e não exercitaria nada. Com o formato certo, a consulta acontece — e é aí que o envelope
 * de resposta precisa estar de pé.
 */

const findUnique = vi.fn(async (..._a: unknown[]) => null);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chaveDeIntegracao: { findUnique: (...a: unknown[]) => findUnique(...a), update: vi.fn() },
    funil: { findMany: vi.fn(async () => []) },
    funilEtapa: { findFirst: vi.fn(async () => null) },
    leadRecebido: { findUnique: vi.fn(async () => null), create: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }) }));

const { PREFIXO_CHAVE_FLOW } = await import("@/lib/integracoes/azuz-flow-chave");
const { GET } = await import("../funis/route");
const { POST } = await import("../lista/route");

/** Formato certo, dona nenhuma: é o caso que chega ao banco. */
const CHAVE_FALSA = `${PREFIXO_CHAVE_FLOW}${"z".repeat(43)}`;

describe("GET /api/integracoes/azuz-flow/funis", () => {
  it("401 em JSON com chave desconhecida", async () => {
    const r = await GET(new Request("https://crm/api/integracoes/azuz-flow/funis", {
      headers: { authorization: `Bearer ${CHAVE_FALSA}` },
    }));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ ok: false, erro: "Chave de integração inválida." });
  });

  it("401 também sem cabeçalho nenhum", async () => {
    const r = await GET(new Request("https://crm/api/integracoes/azuz-flow/funis"));
    expect(r.status).toBe(401);
    expect((await r.json()).ok).toBe(false);
  });
});

describe("POST /api/integracoes/azuz-flow/lista", () => {
  it("401 em JSON com chave desconhecida, sem nem ler o corpo", async () => {
    const r = await POST(new Request("https://crm/api/integracoes/azuz-flow/lista", {
      method: "POST",
      headers: { authorization: `Bearer ${CHAVE_FALSA}`, "content-type": "application/json" },
      body: JSON.stringify({ versao: 1, leads: [] }),
    }));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ ok: false, erro: "Chave de integração inválida." });
  });

  it("a recusa é a MESMA pra chave ausente, desconhecida e malformada", async () => {
    /*
     * Distinguir conta a quem está sondando se o palpite acertou, e não ajuda quem é legítimo: a
     * agência vê o estado da chave na tela do CRM, não no corpo de um 401.
     */
    const corpos = await Promise.all(
      [undefined, `Bearer ${CHAVE_FALSA}`, "Bearer nao-e-chave", "sem esquema"].map(async (auth) => {
        const r = await POST(new Request("https://crm/api/integracoes/azuz-flow/lista", {
          method: "POST",
          headers: auth ? { authorization: auth } : {},
          body: "{}",
        }));
        return [r.status, await r.json()] as const;
      }),
    );
    for (const [status, corpo] of corpos) {
      expect(status).toBe(401);
      expect(corpo).toEqual({ ok: false, erro: "Chave de integração inválida." });
    }
  });
});
