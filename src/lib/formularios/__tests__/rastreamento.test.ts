import { describe, expect, it } from "vitest";

import {
  idDaTagGoogle,
  limparOrigem,
  pixelMetaValido,
  rastreamentoDoFormulario,
  resumoDaOrigem,
  tagGoogleValida,
} from "../rastreamento";

describe("pixel e tag", () => {
  it("aceita ids de verdade", () => {
    expect(pixelMetaValido(" 1234567890123456 ")).toBe("1234567890123456");
    expect(tagGoogleValida("G-ABC123XYZ")).toBe("G-ABC123XYZ");
    expect(tagGoogleValida("AW-123456789")).toBe("AW-123456789");
    expect(tagGoogleValida("AW-123456789/AbC-dEf_123")).toBe("AW-123456789/AbC-dEf_123");
  });

  // O id entra dentro de um <script> na página pública: qualquer outra coisa vira script de terceiro.
  it("recusa o que tentaria sair do script", () => {
    expect(pixelMetaValido("123');alert(1);//")).toBeNull();
    expect(pixelMetaValido("abc")).toBeNull();
    expect(tagGoogleValida("G-ABC</script><script>alert(1)")).toBeNull();
    expect(tagGoogleValida("G-ABC'")).toBeNull();
    expect(tagGoogleValida("javascript:alert(1)")).toBeNull();
    expect(tagGoogleValida(123)).toBeNull();
  });

  it("lê do integracoes descartando o inválido", () => {
    expect(rastreamentoDoFormulario({ pixelMeta: "12345678", tagGoogle: "nada" })).toEqual({
      pixelMeta: "12345678",
      tagGoogle: null,
    });
    expect(rastreamentoDoFormulario(null)).toEqual({ pixelMeta: null, tagGoogle: null });
  });

  it("separa o id da tag do rótulo da conversão", () => {
    expect(idDaTagGoogle("AW-123456789/rotulo")).toBe("AW-123456789");
    expect(idDaTagGoogle("G-ABC123")).toBe("G-ABC123");
  });
});

describe("origem da resposta", () => {
  it("guarda só as chaves conhecidas, em texto e com tamanho limitado", () => {
    const origem = limparOrigem({
      utm_source: "instagram",
      utm_campaign: "x".repeat(500),
      senha: "nao-entra",
      fbclid: 42,
    });
    expect(origem).toEqual({ utm_source: "instagram", utm_campaign: "x".repeat(300) });
  });

  it("não guarda objeto vazio", () => {
    expect(limparOrigem({})).toBeNull();
    expect(limparOrigem({ utm_source: "   " })).toBeNull();
    expect(limparOrigem("texto")).toBeNull();
  });

  it("resume a origem pra tabela", () => {
    expect(resumoDaOrigem({ utm_source: "instagram", utm_campaign: "setembro" })).toBe("instagram · setembro");
    expect(resumoDaOrigem({ fbclid: "abc" })).toBe("Anúncio do Meta");
    expect(resumoDaOrigem({ gclid: "abc" })).toBe("Anúncio do Google");
    expect(resumoDaOrigem(null)).toBe("");
  });
});
