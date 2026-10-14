import { describe, expect, it, vi } from "vitest";

import { NextResponse } from "next/server";

import { AVISO_DE_ESTRUTURA, comRespostaEmJson, ehEstruturaDesatualizada } from "../resposta-em-json";

describe("ehEstruturaDesatualizada", () => {
  it("reconhece tabela que não existe (P2021) e coluna que não existe (P2022)", () => {
    expect(ehEstruturaDesatualizada({ code: "P2021" })).toBe(true);
    expect(ehEstruturaDesatualizada({ code: "P2022" })).toBe(true);
  });

  it("reconhece a mensagem crua do MySQL, que é como ela chega em consulta raw", () => {
    expect(ehEstruturaDesatualizada(new Error("Table 'crm.ChaveDeIntegracao' doesn't exist"))).toBe(true);
    expect(ehEstruturaDesatualizada(new Error("Unknown column 'consentimentoWhatsApp' in 'field list'"))).toBe(true);
  });

  it("não confunde com outros erros", () => {
    expect(ehEstruturaDesatualizada({ code: "P2002" })).toBe(false);
    expect(ehEstruturaDesatualizada(new Error("Can't reach database server"))).toBe(false);
    expect(ehEstruturaDesatualizada(null)).toBe(false);
    expect(ehEstruturaDesatualizada("P2021")).toBe(false);
  });
});

describe("comRespostaEmJson", () => {
  it("deixa a resposta normal passar intacta", async () => {
    const r = await comRespostaEmJson("teste", async () => NextResponse.json({ chave: "x" }));
    expect(r.status).toBe(200);
    await expect(r.json()).resolves.toEqual({ chave: "x" });
  });

  it("exceção vira JSON com corpo, NUNCA corpo vazio", async () => {
    // É o contrato inteiro deste módulo: o navegador não pode receber nada pra ler.
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await comRespostaEmJson("teste", async () => {
      throw new Error("explodiu");
    });
    expect(r.status).toBe(500);
    const corpo = await r.json();
    expect(corpo.ok).toBe(false);
    expect(typeof corpo.erro).toBe("string");
    expect(corpo.erro.length).toBeGreaterThan(0);
    // A mensagem técnica fica no servidor; quem está na tela não lê "explodiu".
    expect(corpo.erro).not.toContain("explodiu");
    erros.mockRestore();
  });

  it("schema atrasado vira 503 com a frase que diz o que fazer", async () => {
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await comRespostaEmJson("teste", async () => {
      throw Object.assign(new Error("Table 'crm.LeadRecebido' doesn't exist"), { code: "P2021" });
    });
    expect(r.status).toBe(503);
    await expect(r.json()).resolves.toEqual({ ok: false, erro: AVISO_DE_ESTRUTURA });
    erros.mockRestore();
  });
});
