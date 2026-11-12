import { describe, expect, it } from "vitest";

import { ORIGENS_DO_LEAD, ORIGENS_PAGAS, origemEhPaga } from "@/lib/contatos/origem-do-lead";

describe("origem do lead", () => {
  it("as pagas são exatamente as três plataformas de anúncio", () => {
    expect([...ORIGENS_PAGAS].sort()).toEqual(["Google Ads", "Meta Ads", "TikTok"]);
  });

  it("Instagram orgânico NÃO é paga — e o custo por lead depende dessa distinção", () => {
    // Perfil achado pelo conteúdo não custou mídia. Contá-lo como pago faria o CPL da tela de
    // Tráfego parecer menor do que é, que é o erro mais caro desta tela.
    expect(origemEhPaga("Instagram")).toBe(false);
    expect(origemEhPaga("Meta Ads")).toBe(true);
  });

  it("origem ausente não é paga, e não quebra", () => {
    expect(origemEhPaga(null)).toBe(false);
    expect(origemEhPaga(undefined)).toBe(false);
    expect(origemEhPaga("")).toBe(false);
  });

  it("toda opção tem descrição: marcar sem saber o que significa é o que faz o campo virar lixo", () => {
    for (const opcao of ORIGENS_DO_LEAD) {
      expect(opcao.descricao.length).toBeGreaterThan(20);
    }
  });

  it("não há valor repetido na lista", () => {
    const valores = ORIGENS_DO_LEAD.map((o) => o.valor);
    expect(new Set(valores).size).toBe(valores.length);
  });
});
