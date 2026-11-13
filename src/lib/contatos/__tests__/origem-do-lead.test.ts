import { describe, expect, it } from "vitest";

import {
  ORIGENS_DO_LEAD,
  ORIGENS_PAGAS,
  origemEhPaga,
  origemMarcavel,
  rotuloCurtoDaOrigem,
} from "@/lib/contatos/origem-do-lead";

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

describe("origemMarcavel", () => {
  it("procedência é marcável; canal não é", () => {
    /*
     * `Contato.origem` guarda as duas coisas no mesmo campo: o que alguém escolheu na ficha e o
     * que o CRM gravou sozinho ao receber a primeira mensagem. No cartão do funil só a primeira
     * merece destaque — dar relevo dourado a "WhatsApp" seria pintar de ouro a mesma palavra em
     * vinte cartões, que é o problema que o destaque veio resolver.
     */
    expect(origemMarcavel("Meta Ads")).toBe(true);
    expect(origemMarcavel("Indicação")).toBe(true);
    expect(origemMarcavel("Formulário: Consultoria Gratis")).toBe(true);

    expect(origemMarcavel("WhatsApp")).toBe(false);
    expect(origemMarcavel("Salvo manualmente")).toBe(false);
    expect(origemMarcavel("Direto")).toBe(false);
    expect(origemMarcavel("Outro")).toBe(false);
  });

  it("vazio não é marcação", () => {
    expect(origemMarcavel(null)).toBe(false);
    expect(origemMarcavel(undefined)).toBe(false);
    expect(origemMarcavel("   ")).toBe(false);
  });
});

describe("rotuloCurtoDaOrigem", () => {
  it("corta pela parte que INFORMA, não pelo tamanho", () => {
    /*
     * "Formulário" é o genérico — a agência tem vários. O que distingue um cartão do outro é o
     * nome: "Consultoria Gratis" é aquisição, "Seleção Desing" é contratação. Reticências no meio
     * ("FORMULÁRIO: CONSUL…") perderiam exatamente o pedaço que decide.
     */
    expect(rotuloCurtoDaOrigem("Formulário: Consultoria Gratis")).toBe("Consultoria Gratis");
    expect(rotuloCurtoDaOrigem("Formulário: Seleção Desing")).toBe("Seleção Desing");
  });

  it("origem sem dois-pontos passa inteira", () => {
    expect(rotuloCurtoDaOrigem("Meta Ads")).toBe("Meta Ads");
    expect(rotuloCurtoDaOrigem("Indicação")).toBe("Indicação");
  });

  it("prefixo sem nada depois não vira etiqueta vazia", () => {
    expect(rotuloCurtoDaOrigem("Formulário:")).toBe("Formulário:");
    expect(rotuloCurtoDaOrigem("Formulário:   ")).toBe("Formulário:");
  });
});
