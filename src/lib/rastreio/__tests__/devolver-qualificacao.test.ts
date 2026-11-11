import { beforeEach, describe, expect, it, vi } from "vitest";

type Pedido = { plataforma: string; evento: string; valor: unknown; moeda: unknown; resultadoId: unknown };

let contato: { id: string; email: string | null; whatsapp: string | null; origemDoLead: unknown } | null = null;
let pedidos: Pedido[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contato: { findFirst: async () => contato },
  },
}));

vi.mock("@/lib/rastreio/fila-de-conversoes", () => ({
  enfileirarConversao: async (_cliente: unknown, pedido: Pedido) => {
    pedidos.push(pedido);
    return { enfileirado: true, id: "x" };
  },
}));

const { aoQualificarLead } = await import("../devolver-qualificacao");

function qualificar(antes: unknown, depois: unknown) {
  return aoQualificarLead({ workspaceId: "w1", contatoId: "c1", antes, depois });
}

beforeEach(() => {
  pedidos = [];
  contato = { id: "c1", email: "a@b.com", whatsapp: "5562999990000", origemDoLead: { cliqueId: "ct1", tipoDoClique: "ctwa_clid" } };
});

/**
 * "Coloca pra eu dizer se o cliente é bom, curioso — porque todas essas inteligências têm que
 * levar a um lugar, que é um retorno pros anúncios que estão ativos." Plataformas escolhidas por
 * ela: Meta e Google.
 */
describe("aoQualificarLead", () => {
  it("marcar BOM enfileira lead_qualified pra Meta e pro Google", async () => {
    await qualificar(null, "bom");
    expect(pedidos.map((p) => p.plataforma).sort()).toEqual(["google", "meta"]);
    expect(pedidos.every((p) => p.evento === "lead_qualified")).toBe(true);
  });

  it("CURIOSO não manda nada", async () => {
    // Devolver "curioso" como lead qualificado ensinaria o algoritmo a procurar mais curiosos: a
    // qualificação passaria a piorar a campanha em vez de melhorá-la.
    await qualificar(null, "curioso");
    expect(pedidos).toEqual([]);
  });

  it("RUIM não manda nada", async () => {
    await qualificar(null, "ruim");
    expect(pedidos).toEqual([]);
  });

  it("qualificação apagada não manda nada", async () => {
    await qualificar("bom", null);
    expect(pedidos).toEqual([]);
  });

  it("salvar outro campo de quem já era bom não gera sinal novo", async () => {
    await qualificar("bom", "bom");
    expect(pedidos).toEqual([]);
  });

  it("vai SEM valor: um lead qualificado não tem preço", async () => {
    // Zero não é "sem valor": zero afirma que vale nada, e as duas plataformas leem isso como dado.
    await qualificar(null, "bom");
    expect(pedidos.every((p) => p.valor === null)).toBe(true);
    expect(pedidos.every((p) => p.moeda === null)).toBe(true);
  });

  it("o resultado é o próprio lead: vale uma vez, não uma por ida e volta", async () => {
    // `resultadoId` nulo vira "unico" na chave de idempotência da fila. Marcar bom, trocar pra
    // curioso e voltar pra bom manda um sinal, não três.
    await qualificar(null, "bom");
    expect(pedidos.every((p) => p.resultadoId === null)).toBe(true);
  });

  it("contato que não existe mais não quebra nada", async () => {
    contato = null;
    await expect(qualificar(null, "bom")).resolves.toBeUndefined();
    expect(pedidos).toEqual([]);
  });
});

/**
 * O GANCHO PRECISA ESTAR ONDE A MARCAÇÃO PASSA.
 *
 * O chip de qualificação no painel do contato chama `salvarDadosContato`, que grava por
 * `POST /api/contatos` (upsert pelo nome) — NÃO pelo `PATCH /api/contatos/[id]`. Ficando só no
 * PATCH, o recurso inteiro não dispararia pelo caminho que a tela usa, e isso não aparece em
 * nenhum erro: o lead fica marcado como bom e a plataforma nunca sabe.
 *
 * E o gancho fica nas ROTAS COM SESSÃO, não dentro de `upsertContato`: aquela função também atende
 * a rota pública do formulário e os webhooks, onde um "bom" vindo de fora viraria sinal de anúncio
 * sem ninguém da equipe ter olhado o lead.
 */
describe("onde o gancho está ligado", () => {
  const rotas = [
    "src/app/api/contatos/route.ts",
    "src/app/api/contatos/[id]/route.ts",
  ];

  it("as duas rotas de contato com sessão chamam `aoQualificarLead`", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const rota of rotas) {
      const texto = readFileSync(join(process.cwd(), rota), "utf8");
      expect(texto, rota).toContain("aoQualificarLead(");
    }
  });

  it("a rota de upsert liga nos DOIS caminhos de escrita que ela tem", async () => {
    // Ela grava direto quando mescla por telefone e via `upsertContato` no resto. Um caminho sem o
    // gancho é uma marcação que não vira sinal, em silêncio.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const texto = readFileSync(join(process.cwd(), "src/app/api/contatos/route.ts"), "utf8");
    expect(texto.match(/aoQualificarLead\(/g) ?? []).toHaveLength(2);
  });

  it("`upsertContato` NÃO chama: ele também atende rota pública e webhook", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const texto = readFileSync(join(process.cwd(), "src/lib/contatos/upsert.ts"), "utf8");
    expect(texto).not.toContain("aoQualificarLead");
  });
});
