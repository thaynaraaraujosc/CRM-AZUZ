/**
 * O SCRIPT QUE O CLIENTE COLA NO PRÓPRIO SITE.
 *
 * É a peça que faltava pro rastreamento de quem tem site. Os dois caminhos que já existiam cobrem
 * quem chega direto na conversa (a referência da Meta, no webhook) e quem clica num botão do CRM
 * (o link rastreado, com o código curto). Quem clica no anúncio, cai num site qualquer e preenche
 * o formulário DAQUELE site ficava de fora: o `gclid` estava na URL, na frente, e ninguém lia.
 *
 * O QUE ELE FAZ, e nada além disso:
 * 1. lê as marcas da URL em que a pessoa caiu;
 * 2. guarda o PRIMEIRO toque num cookie primário e vai atualizando o ÚLTIMO;
 * 3. preenche campos escondidos do formulário, pra eles viajarem no envio.
 *
 * O QUE ELE NÃO FAZ: não manda nada pra lugar nenhum, não lê o que a pessoa digita, não põe
 * cookie de terceiro, não identifica ninguém. Ele é uma cópia local de parâmetros que já estavam
 * na barra de endereço — e é por isso que ele cabe num site de terceiro sem virar um problema.
 *
 * CONSENTIMENTO: com `consent=0`/`gcs=G100` na URL, ou com a função `azuzConsentimento(false)`
 * chamada pelo banner do site, ele APAGA o que guardou e para de guardar. O padrão é guardar,
 * porque o dado já está na URL e guardar no próprio domínio não amplia nada — mas a escolha de
 * quem navega ganha de qualquer padrão.
 */

/** As marcas que o script copia. Só estas: a query inteira traria o que um terceiro pendurar. */
export const CHAVES_DO_SCRIPT = [
  // Códigos de clique.
  "gclid",
  "wbraid",
  "gbraid",
  "fbclid",
  "ttclid",
  // Marcação escrita à mão.
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_referrer",
  // O que o ValueTrack do Google e os macros da Meta mandam.
  "campaignid",
  "campaign_id",
  "adgroupid",
  "adset_id",
  "creative",
  "creative_id",
  "ad_id",
  "keyword",
  "matchtype",
  "source",
  "ref",
  // Consentimento, do jeito que cada site escreve.
  "consent",
  "consentimento",
  "gcs",
];

export const COOKIE_PRIMEIRO = "azuz_origem";
export const COOKIE_ULTIMO = "azuz_origem_ultimo";
/** 90 dias: a janela de atribuição mais longa que Google e Meta usam por padrão. */
export const DIAS_DE_VALIDADE = 90;

/**
 * A REGRA DOS DOIS TOQUES, escrita aqui pra poder ser testada.
 *
 * O script faz o mesmo em três linhas lá dentro; esta função é a definição. O primeiro toque é
 * imutável — é ele que explica como a pessoa conheceu a empresa, e deixar o último sobrescrevê-lo
 * é o erro clássico de atribuição, o que faz toda venda parecer ter vindo do último clique. O
 * último é sempre o mais recente, porque é ele que explica por que ela voltou agora.
 *
 * Visita sem marca nenhuma não mexe em nada: tráfego orgânico no meio do caminho não pode apagar
 * o anúncio que trouxe a pessoa.
 */
export function juntarToques(
  guardado: { primeiro?: Record<string, string>; ultimo?: Record<string, string> },
  agora: Record<string, string>,
): { primeiro?: Record<string, string>; ultimo?: Record<string, string> } {
  if (Object.keys(agora).length === 0) return guardado;
  return { primeiro: guardado.primeiro ?? agora, ultimo: agora };
}

/** O nome do campo escondido que o script cria pra cada marca. */
export function nomeDoCampoEscondido(chave: string, toque: "primeiro" | "ultimo"): string {
  return toque === "primeiro" ? chave : `ultimo_${chave}`;
}

/**
 * O JavaScript servido pro site do cliente.
 *
 * Sai daqui como texto, e não de um arquivo estático, por dois motivos: a lista de chaves é a
 * MESMA que o servidor lê na hora de gravar (duas listas divergiriam na primeira chave nova), e o
 * endereço do CRM muda por ambiente.
 */
export function scriptDoSite(): string {
  const chaves = JSON.stringify(CHAVES_DO_SCRIPT);
  return `(function () {
  "use strict";
  var CHAVES = ${chaves};
  var COOKIE = ${JSON.stringify(COOKIE_PRIMEIRO)};
  var COOKIE_U = ${JSON.stringify(COOKIE_ULTIMO)};
  var DIAS = ${DIAS_DE_VALIDADE};

  function lerCookie(nome) {
    var achado = document.cookie.split("; ").find(function (c) { return c.indexOf(nome + "=") === 0; });
    if (!achado) return null;
    try { return JSON.parse(decodeURIComponent(achado.slice(nome.length + 1))); } catch (e) { return null; }
  }

  function gravarCookie(nome, valor) {
    var texto = encodeURIComponent(JSON.stringify(valor));
    document.cookie = nome + "=" + texto + ";path=/;max-age=" + DIAS * 86400 + ";SameSite=Lax" +
      (location.protocol === "https:" ? ";Secure" : "");
  }

  function apagarCookie(nome) { document.cookie = nome + "=;path=/;max-age=0;SameSite=Lax"; }

  function marcasDaUrl() {
    var busca = new URLSearchParams(location.search);
    var fora = {};
    CHAVES.forEach(function (chave) {
      var valor = busca.get(chave);
      if (valor) fora[chave] = String(valor).slice(0, 512);
    });
    if (document.referrer && document.referrer.indexOf(location.host) === -1) {
      fora.referrer = document.referrer.slice(0, 1000);
    }
    fora.landing_page = (location.origin + location.pathname).slice(0, 1000);
    // Só a página de entrada não é marca nenhuma: sem nada mais, não há origem pra guardar.
    return Object.keys(fora).length > 1 ? fora : {};
  }

  // O consentimento vem da URL (consent=0, gcs=G100) ou do banner do site, por azuzConsentimento().
  function negouNaUrl(marcas) {
    var explicito = String(marcas.consent || marcas.consentimento || "").toLowerCase();
    if (["0", "false", "nao", "não", "denied", "negado"].indexOf(explicito) >= 0) return true;
    var gcs = String(marcas.gcs || "").toUpperCase();
    return /^G1[01][01]$/.test(gcs) && gcs[2] === "0";
  }

  var agora = marcasDaUrl();
  if (negouNaUrl(agora)) {
    apagarCookie(COOKIE); apagarCookie(COOKIE_U);
  } else if (Object.keys(agora).length) {
    // A regra dos dois toques: o primeiro é imutável, o último é sempre o mais recente.
    if (!lerCookie(COOKIE)) gravarCookie(COOKIE, agora);
    gravarCookie(COOKIE_U, agora);
  }

  function preencher(formulario) {
    var primeiro = lerCookie(COOKIE) || {};
    var ultimo = lerCookie(COOKIE_U) || {};
    function por(nome, valor) {
      if (!valor) return;
      var campo = formulario.querySelector('input[name="' + nome + '"]');
      if (!campo) {
        campo = document.createElement("input");
        campo.type = "hidden";
        campo.name = nome;
        formulario.appendChild(campo);
      }
      campo.value = valor;
    }
    Object.keys(primeiro).forEach(function (chave) { por(chave, primeiro[chave]); });
    Object.keys(ultimo).forEach(function (chave) { por("ultimo_" + chave, ultimo[chave]); });
  }

  function preencherTudo() {
    var formularios = document.querySelectorAll("form[data-azuz], form");
    for (var i = 0; i < formularios.length; i++) preencher(formularios[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", preencherTudo);
  } else {
    preencherTudo();
  }
  // Formulário que nasce depois (modal, passo seguinte) também recebe: sem isto, o script só
  // funcionaria em página de HTML pronto, que é a minoria dos sites que vendem.
  document.addEventListener("submit", function (e) { if (e.target && e.target.tagName === "FORM") preencher(e.target); }, true);

  window.azuzOrigem = function () { return { primeiro: lerCookie(COOKIE), ultimo: lerCookie(COOKIE_U) }; };
  window.azuzConsentimento = function (permitido) {
    if (permitido === false) { apagarCookie(COOKIE); apagarCookie(COOKIE_U); return; }
    var atual = marcasDaUrl();
    if (Object.keys(atual).length) { if (!lerCookie(COOKIE)) gravarCookie(COOKIE, atual); gravarCookie(COOKIE_U, atual); }
  };
})();
`;
}
