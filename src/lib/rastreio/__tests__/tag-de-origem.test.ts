import { describe, expect, it } from "vitest";

import { previaDaOrigem, tagDeOrigemDoLead } from "@/lib/rastreio/tag-de-origem";

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

/**
 * A PRÉVIA DO CRIATIVO. "Tem como aparecer o criativo em miniatura, o nome do criativo pelo qual
 * essa pessoa veio?"
 *
 * Tem, e o dado já estava no banco: quando alguém clica num anúncio de Click-to-WhatsApp, a Meta
 * manda junto da primeira mensagem um bloco `referral` com título, texto, imagem, miniatura e o
 * link de origem. O CRM guarda esse bloco inteiro e nunca o leu de volta.
 */
describe("previaDaOrigem", () => {
  const referral = {
    headline: "KTM 390 Adventure — 0km",
    body: "Entrada facilitada, fale agora",
    source_url: "https://fb.me/anuncio123",
    source_type: "ad",
    image_url: "https://cdn.meta.com/criativo.jpg",
    thumbnail_url: "https://cdn.meta.com/mini.jpg",
  };

  it("monta título, detalhe, miniatura e link de um anúncio", () => {
    const previa = previaDaOrigem({
      cliqueId: "ct1",
      tipoDoClique: "ctwa_clid",
      campanhaNome: "KTM Novembro",
      bruto: referral,
    });
    expect(previa).toMatchObject({
      rotulo: "Meta Ads",
      pago: true,
      titulo: "KTM 390 Adventure — 0km",
      detalhe: "KTM Novembro · Entrada facilitada, fale agora",
      miniatura: "https://cdn.meta.com/mini.jpg",
      link: "https://fb.me/anuncio123",
    });
  });

  it("sem miniatura própria, usa o criativo em tamanho cheio", () => {
    const { thumbnail_url: _semMini, ...semMiniatura } = referral;
    const previa = previaDaOrigem({ cliqueId: "c", tipoDoClique: "ctwa_clid", bruto: semMiniatura });
    expect(previa?.miniatura).toBe("https://cdn.meta.com/criativo.jpg");
  });

  it("só aceita endereço http(s): JSON não vira `javascript:` na tela", () => {
    const previa = previaDaOrigem({
      cliqueId: "c",
      tipoDoClique: "ctwa_clid",
      bruto: { thumbnail_url: "javascript:alert(1)", source_url: "data:text/html,<script>" },
    });
    expect(previa?.miniatura).toBeUndefined();
    expect(previa?.link).toBeUndefined();
  });

  it("formulário do CRM aparece com o nome dele", () => {
    const previa = previaDaOrigem({ caminho: "formulario" }, "Orçamento rápido");
    expect(previa).toMatchObject({ rotulo: "Formulário", titulo: "Orçamento rápido", pago: false });
  });

  it("sem o nome do formulário, a prévia existe e fica sem título", () => {
    const previa = previaDaOrigem({ caminho: "formulario" });
    expect(previa?.rotulo).toBe("Formulário");
    expect(previa?.titulo).toBeUndefined();
  });

  it("sem rastreio nenhum, não há prévia", () => {
    expect(previaDaOrigem({})).toBeNull();
    expect(previaDaOrigem(null)).toBeNull();
  });

  it("`bruto` que não é objeto não quebra nada", () => {
    // O campo é Json e já recebeu coisas diferentes ao longo do tempo.
    const previa = previaDaOrigem({ cliqueId: "c", tipoDoClique: "fbclid", bruto: "texto solto" });
    expect(previa?.rotulo).toBe("Meta Ads");
    expect(previa?.miniatura).toBeUndefined();
  });

  it("o título cai no nome do anúncio quando o referral não veio", () => {
    // É o caso de quem chegou por link rastreado, e não por clique pra WhatsApp.
    const previa = previaDaOrigem({ cliqueId: "g", tipoDoClique: "gclid", anuncioNome: "Pesquisa — marca" });
    expect(previa?.titulo).toBe("Pesquisa — marca");
  });
});
