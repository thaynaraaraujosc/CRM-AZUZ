import { describe, expect, it } from "vitest";

import { lerOrigemDaUrl, montarFbc } from "../origem";
import { rastreioParaCondicoes } from "../para-condicoes";
import { CHAVES_DO_SCRIPT, juntarToques, scriptDoSite } from "../script-do-site";

const params = (busca: string) => new URLSearchParams(busca);

describe("os identificadores que faltavam", () => {
  it("lê o clique do TikTok e afirma a plataforma por ele", () => {
    const origem = lerOrigemDaUrl(params("ttclid=E.C.P.123"));
    expect(origem?.plataforma).toBe("tiktok");
    expect(origem?.ttclid).toBe("E.C.P.123");
  });

  it("monta o `fbc` no formato que a Meta exige, a partir do fbclid", () => {
    /*
     * O `fbclid` cru num campo de `fbc` é ACEITO pela Conversions API e descartado em silêncio: a
     * chamada responde 200 e o evento não casa com anúncio nenhum. É o pior defeito possível,
     * porque tudo parece ter funcionado.
     */
    const agora = new Date("2026-11-05T12:00:00Z");
    expect(montarFbc("IwAR0abc", undefined, agora)).toBe(`fb.1.${agora.getTime()}.IwAR0abc`);
    // O cookie que o pixel do site já montou ganha: ele tem o momento certo do clique.
    expect(montarFbc("IwAR0abc", "fb.1.1699999999999.outro", agora)).toBe("fb.1.1699999999999.outro");
    expect(montarFbc(undefined)).toBeUndefined();
  });

  it("tira o client_id de dentro do cookie `_ga`, e não manda o cookie inteiro", () => {
    // `GA1.1.<id>.<momento>`: o client_id são as duas últimas partes. Mandar o cookie inteiro faz
    // o GA4 aceitar o evento e contá-lo como um usuário novo a cada envio.
    expect(lerOrigemDaUrl(params("gclid=x&_ga=GA1.1.1234567890.1699999999"))?.gclientid).toBe("1234567890.1699999999");
    expect(lerOrigemDaUrl(params("gclid=x&gclientid=abc.def"))?.gclientid).toBe("abc.def");
  });

  it("guarda referrer, utm_referrer e os campos do anúncio da Meta", () => {
    const origem = lerOrigemDaUrl(
      params("fbclid=IwAR0&utm_referrer=https://parceiro.com&creative_id=777&source=ig&ref=promo-maio"),
      "https://site.com/lp",
      { referrer: "https://google.com/" },
    );
    expect(origem?.referrer).toBe("https://google.com/");
    expect(origem?.utmReferrer).toBe("https://parceiro.com");
    expect(origem?.criativoId).toBe("777");
    expect(origem?.metaSource).toBe("ig");
    expect(origem?.metaRef).toBe("promo-maio");
  });
});

describe("a origem vira campo de condição", () => {
  it("separa o código do clique pelo tipo e inclui os novos campos", () => {
    const campos = rastreioParaCondicoes({
      utmSource: "google",
      cliqueId: "abc",
      tipoDoClique: "ttclid",
      criativoId: "777",
      metaSource: "ig",
      igSid: "17841400000",
      caminho: "instagram",
      referrer: "https://parceiro.com",
    });
    expect(campos).toMatchObject({
      utm_source: "google",
      ttclid: "abc",
      meta_ads_criativo: "777",
      meta_source: "ig",
      ig_sid: "17841400000",
      origem_caminho: "instagram",
      referrer: "https://parceiro.com",
    });
    expect(campos.gclid).toBeUndefined();
    expect(campos.fbclid).toBeUndefined();
  });

  it("o último toque entra com os campos que decidem alguma coisa", () => {
    const campos = rastreioParaCondicoes({
      utmSource: "meta",
      ultimoToque: { utmSource: "google", campanhaNome: "Marca", caminho: "formulario" },
      ultimoToqueEm: new Date("2026-11-05T10:00:00Z"),
    });
    expect(campos.utm_source).toBe("meta");
    expect(campos.ultimo_utm_source).toBe("google");
    expect(campos.ultimo_campanha).toBe("Marca");
    expect(campos.ultimo_toque_em).toBe("2026-11-05");
  });

  it("campo vazio fica de fora, pra \"existe\" poder responder", () => {
    expect(rastreioParaCondicoes({ utmSource: "   ", campanhaNome: null })).toEqual({});
    expect(rastreioParaCondicoes(null)).toEqual({});
  });
});

describe("a regra dos dois toques", () => {
  it("o primeiro nunca é sobrescrito; o último é sempre o mais recente", () => {
    const anuncio = { gclid: "abc", utm_source: "google" };
    const newsletter = { utm_source: "newsletter" };
    const depoisDoPrimeiro = juntarToques({}, anuncio);
    expect(depoisDoPrimeiro).toEqual({ primeiro: anuncio, ultimo: anuncio });

    const depoisDoSegundo = juntarToques(depoisDoPrimeiro, newsletter);
    expect(depoisDoSegundo.primeiro).toEqual(anuncio);
    expect(depoisDoSegundo.ultimo).toEqual(newsletter);
  });

  it("visita sem marca nenhuma não apaga o que já estava guardado", () => {
    // Tráfego orgânico no meio do caminho não pode apagar o anúncio que trouxe a pessoa.
    const guardado = { primeiro: { gclid: "abc" }, ultimo: { gclid: "abc" } };
    expect(juntarToques(guardado, {})).toBe(guardado);
  });
});

describe("o script do site", () => {
  it("carrega a mesma lista de chaves que o servidor lê", () => {
    const js = scriptDoSite();
    for (const chave of CHAVES_DO_SCRIPT) expect(js).toContain(`"${chave}"`);
  });

  it("grava cookie primário, com SameSite e validade de 90 dias", () => {
    const js = scriptDoSite();
    expect(js).toContain("SameSite=Lax");
    expect(js).toContain("max-age=");
    expect(js).toContain("90");
    // Nada sai do navegador: o script copia parâmetros, não manda evento pra lugar nenhum.
    expect(js).not.toContain("fetch(");
    expect(js).not.toContain("XMLHttpRequest");
  });

  it("respeita a recusa de consentimento apagando o que guardou", () => {
    const js = scriptDoSite();
    expect(js).toContain("apagarCookie");
    expect(js).toContain("azuzConsentimento");
  });
});
