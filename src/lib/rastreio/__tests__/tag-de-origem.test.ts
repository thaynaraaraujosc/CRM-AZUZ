import { describe, expect, it } from "vitest";

import { tagDeOrigemDoLead } from "@/lib/rastreio/tag-de-origem";

/**
 * "Eu preciso saber se o lead que entrou no meu chat e no meu funil veio de onde. Veio do
 * Instagram? Veio do anúncio? (…) pra saber se esse lead veio da campanha, se veio direto do
 * tráfego pago, ou se veio do formulário."
 *
 * A ordem das regras é a da CERTEZA. O código do clique é prova — a plataforma só o entrega a quem
 * clicou num anúncio dela. UTM é o que o anunciante escreveu no link, e qualquer um copia e cola:
 * por isso vem depois, nunca antes.
 */
describe("tagDeOrigemDoLead", () => {
  it("gclid é Google Ads, e é pago", () => {
    expect(tagDeOrigemDoLead({ cliqueId: "abc", tipoDoClique: "gclid" })).toMatchObject({
      rotulo: "Google Ads",
      pago: true,
    });
  });

  it("gbraid e wbraid também são do Google", () => {
    expect(tagDeOrigemDoLead({ cliqueId: "g", tipoDoClique: "gbraid" })?.rotulo).toBe("Google Ads");
    expect(tagDeOrigemDoLead({ cliqueId: "w", tipoDoClique: "wbraid" })?.rotulo).toBe("Google Ads");
  });

  it("fbclid e ctwa_clid são Meta Ads", () => {
    expect(tagDeOrigemDoLead({ cliqueId: "f", tipoDoClique: "fbclid" })?.rotulo).toBe("Meta Ads");
    // `ctwa_clid` é o clique de um anúncio de Click-to-WhatsApp: a pessoa veio do anúncio direto
    // pra conversa, sem passar por site nenhum.
    expect(tagDeOrigemDoLead({ cliqueId: "c", tipoDoClique: "ctwa_clid" })?.rotulo).toBe("Meta Ads");
  });

  it("ttclid é TikTok", () => {
    expect(tagDeOrigemDoLead({ cliqueId: "t", tipoDoClique: "ttclid" })?.rotulo).toBe("TikTok");
  });

  it("código de clique sem tipo não vira anúncio", () => {
    // Sem saber de qual plataforma é o código, afirmar "Meta Ads" seria chutar a origem — e a
    // decisão que sai daí é onde investir.
    expect(tagDeOrigemDoLead({ cliqueId: "x", tipoDoClique: null })).toBeNull();
  });

  it("o clique ganha do UTM, porque é prova e o UTM é texto", () => {
    const tag = tagDeOrigemDoLead({
      cliqueId: "abc",
      tipoDoClique: "gclid",
      utmSource: "instagram",
      utmMedium: "cpc",
    });
    expect(tag?.rotulo).toBe("Google Ads");
  });

  it("formulário instantâneo do Meta aparece como tal, e conta como pago", () => {
    expect(tagDeOrigemDoLead({ leadgenId: "123" })).toMatchObject({
      rotulo: "Formulário do Meta",
      pago: true,
    });
  });

  it("formulário do site", () => {
    expect(tagDeOrigemDoLead({ caminho: "formulario" })).toMatchObject({ rotulo: "Formulário", pago: false });
  });

  it("cadastro manual", () => {
    expect(tagDeOrigemDoLead({ caminho: "manual" })?.rotulo).toBe("Salvo manualmente");
  });

  it("utm_medium de mídia paga vira a fonte conhecida, marcada como paga", () => {
    expect(tagDeOrigemDoLead({ utmSource: "instagram", utmMedium: "paid_social" })).toMatchObject({
      rotulo: "Instagram",
      pago: true,
    });
    expect(tagDeOrigemDoLead({ utmSource: "google", utmMedium: "cpc" })?.pago).toBe(true);
  });

  it("mídia paga de fonte desconhecida ainda diz que foi paga", () => {
    expect(tagDeOrigemDoLead({ utmSource: "parceiro-x", utmMedium: "cpc" })).toMatchObject({
      rotulo: "Tráfego pago",
      pago: true,
    });
  });

  it("utm sem medium pago é orgânico", () => {
    expect(tagDeOrigemDoLead({ utmSource: "instagram", utmMedium: "bio" })).toMatchObject({
      rotulo: "Instagram",
      pago: false,
    });
  });

  it("fonte desconhecida e orgânica aparece com o nome que veio", () => {
    expect(tagDeOrigemDoLead({ utmSource: "NewsletterSemanal" })?.rotulo).toBe("NewsletterSemanal");
  });

  it("a origem que a Meta manda no anúncio de WhatsApp vale quando não há clique nem utm", () => {
    expect(tagDeOrigemDoLead({ metaSource: "ig" })?.rotulo).toBe("Instagram");
    expect(tagDeOrigemDoLead({ metaSource: "fb" })?.rotulo).toBe("Facebook");
  });

  it("passou por uma página e nada mais: Site", () => {
    expect(tagDeOrigemDoLead({ paginaEntrada: "https://exemplo.com/planos" })?.rotulo).toBe("Site");
  });

  it("sem nada, NÃO inventa 'Direto'", () => {
    // "Chegou sozinha" e "o CRM não sabe de onde ela veio" se parecem na tela e levam a decisões
    // opostas sobre onde investir.
    expect(tagDeOrigemDoLead({})).toBeNull();
    expect(tagDeOrigemDoLead(null)).toBeNull();
    expect(tagDeOrigemDoLead(undefined)).toBeNull();
  });

  it("campo em branco não conta como preenchido", () => {
    expect(tagDeOrigemDoLead({ utmSource: "   ", cliqueId: "  ", tipoDoClique: "gclid" })).toBeNull();
  });

  it("o detalhe traz a campanha, o anúncio e a palavra-chave", () => {
    const tag = tagDeOrigemDoLead({
      cliqueId: "abc",
      tipoDoClique: "gclid",
      campanhaNome: "Black Friday",
      anuncioNome: "Vídeo 15s",
      palavraChave: "chaveiro 24h",
    });
    expect(tag?.detalhe).toBe('Black Friday · Vídeo 15s · "chaveiro 24h"');
  });

  it("sem campanha nomeada, o detalhe cai no utm_campaign", () => {
    expect(
      tagDeOrigemDoLead({ cliqueId: "f", tipoDoClique: "fbclid", utmCampaign: "remarketing-nov" })?.detalhe,
    ).toBe("remarketing-nov");
  });

  it("sem nada a detalhar, o detalhe é vazio — não a palavra 'undefined'", () => {
    expect(tagDeOrigemDoLead({ cliqueId: "f", tipoDoClique: "fbclid" })?.detalhe).toBe("");
  });
});
