import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

let tabelas: { nome: string }[] = [];
let colunas: { tabela: string; nome: string }[] = [];
let vaiFalhar: Error | null = null;

/**
 * O dublê responde as duas consultas de `information_schema` na ordem em que são feitas.
 *
 * `$queryRaw` é chamado duas vezes com templates diferentes; distinguir pelo texto do template
 * seria frágil, então o dublê alterna. É suficiente porque a ordem é fixa dentro da função e está
 * coberta pelos testes de conteúdo abaixo.
 */
let chamada = 0;
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: async () => {
      if (vaiFalhar) throw vaiFalhar;
      chamada++;
      return chamada % 2 === 1 ? tabelas : colunas;
    },
  },
}));

const { ESTRUTURAS_ESPERADAS, conferirEstruturaDoBanco, resumoDoEstado } = await import("../estrutura-do-banco");

const TODAS_AS_COLUNAS_DE_CONTATO = [
  "consentimentoWhatsApp",
  "consentimentoWhatsAppEm",
  "consentimentoWhatsAppTexto",
  "consentimentoWhatsAppOrigem",
];

function bancoCompleto() {
  tabelas = [{ nome: "ChaveDeIntegracao" }, { nome: "LeadRecebido" }, { nome: "Contato" }];
  colunas = TODAS_AS_COLUNAS_DE_CONTATO.map((nome) => ({ tabela: "Contato", nome }));
}

beforeEach(() => {
  chamada = 0;
  vaiFalhar = null;
  bancoCompleto();
});

describe("conferir a estrutura do banco", () => {
  it("banco completo: ok, sem nada faltando", async () => {
    const estado = await conferirEstruturaDoBanco();
    expect(estado).toEqual({ ok: true, conferido: true, faltando: [] });
  });

  it("acusa a tabela que falta", async () => {
    tabelas = tabelas.filter((t) => t.nome !== "LeadRecebido");
    const estado = await conferirEstruturaDoBanco();
    expect(estado.ok).toBe(false);
    expect(estado.faltando).toContainEqual({ tipo: "tabela", tabela: "LeadRecebido", entrega: "Leads do AZUZ Flow" });
  });

  it("acusa a coluna que falta numa tabela que existe", async () => {
    // É este caso que derruba Contatos e Conversas: o Prisma lista as colunas no SELECT, então uma
    // coluna ausente quebra TODA consulta a Contato.
    colunas = colunas.filter((c) => c.nome !== "consentimentoWhatsAppTexto");
    const estado = await conferirEstruturaDoBanco();
    expect(estado.ok).toBe(false);
    expect(estado.faltando).toEqual([
      { tipo: "coluna", tabela: "Contato", coluna: "consentimentoWhatsAppTexto", entrega: "Leads do AZUZ Flow" },
    ]);
  });

  it("tabela ausente não vira uma notícia por coluna", async () => {
    tabelas = [];
    colunas = [];
    const estado = await conferirEstruturaDoBanco();
    // Três tabelas faltando, não três mais as quatro colunas de Contato.
    expect(estado.faltando).toHaveLength(3);
    expect(estado.faltando.every((f) => f.tipo === "tabela")).toBe(true);
  });

  it("o estado de 14/10/2026: o db push nunca rodou", async () => {
    tabelas = [{ nome: "Contato" }];
    colunas = [];
    const estado = await conferirEstruturaDoBanco();
    expect(estado.faltando.filter((f) => f.tipo === "tabela").map((f) => f.tabela).sort()).toEqual([
      "ChaveDeIntegracao",
      "LeadRecebido",
    ]);
    expect(estado.faltando.filter((f) => f.tipo === "coluna")).toHaveLength(4);
  });

  it("diferença de caixa no nome não conta como ausência", async () => {
    tabelas = [{ nome: "chavedeintegracao" }, { nome: "LEADRECEBIDO" }, { nome: "Contato" }];
    const estado = await conferirEstruturaDoBanco();
    expect(estado.ok).toBe(true);
  });

  it("não conseguir conferir NÃO é a mesma coisa que estar tudo certo", async () => {
    // Responder `ok: true` com o banco fora do ar esconderia exatamente o que se quer enxergar.
    vaiFalhar = new Error("Can't reach database server");
    const estado = await conferirEstruturaDoBanco();
    expect(estado).toMatchObject({ ok: false, conferido: false, faltando: [] });
    expect(estado.erro).toContain("reach database server");
    expect(resumoDoEstado(estado)).toContain("Não foi possível conferir");
  });
});

/**
 * As duas listas de estruturas esperadas precisam dizer a mesma coisa.
 *
 * Elas existem em dobro de propósito — o script `.mjs` roda com o mínimo possível, inclusive quando
 * o build está quebrado, e importar o módulo do Next arrastaria o Prisma Client junto. O risco de
 * divergirem é real, e este teste é o que o torna visível em vez de silencioso.
 */
describe("o script e o módulo não divergem", () => {
  it("conferir-schema.mjs espera as MESMAS tabelas e colunas", () => {
    const fonte = readFileSync("scripts/conferir-schema.mjs", "utf-8");
    const bloco = fonte.slice(fonte.indexOf("const ESPERADAS"), fonte.indexOf("];", fonte.indexOf("const ESPERADAS")));

    for (const esperada of ESTRUTURAS_ESPERADAS) {
      expect(bloco, `tabela ${esperada.tabela} no script`).toContain(`"${esperada.tabela}"`);
      for (const coluna of esperada.colunas ?? []) {
        expect(bloco, `coluna ${coluna} no script`).toContain(`"${coluna}"`);
      }
    }

    // E o contrário: nada de sobrar no script uma tabela que o módulo não cobre mais.
    const tabelasNoScript = [...bloco.matchAll(/tabela:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(tabelasNoScript.sort()).toEqual(ESTRUTURAS_ESPERADAS.map((e) => e.tabela).sort());
  });
});
