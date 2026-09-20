/**
 * Lê a marca que o anúncio deixa em quem clicou.
 *
 * TODA A DEVOLUÇÃO DE CONVERSÃO DEPENDE DESTE ARQUIVO. O Google e a Meta só conseguem ligar uma
 * venda ao anúncio que a produziu se receberem de volta o MESMO código que puseram no clique. Se
 * ele não for capturado no momento em que a pessoa chega, não existe jeito de descobrir depois:
 * o dado não está em lugar nenhum, nem no CRM nem na plataforma. Lead que entra sem marca entra
 * sem origem para sempre.
 *
 * É por isso que capturar vem antes de devolver, mesmo com as aprovações ainda na fila: guardar
 * hoje é o que permite mandar amanhã.
 */

/** Os códigos de clique, e por que são vários. */
const CODIGOS: { chave: string; plataforma: "google" | "meta" }[] = [
  // O clique normal do Google. É o que aparece na esmagadora maioria dos casos.
  { chave: "gclid", plataforma: "google" },
  // Quando o iOS impede o gclid, o Google manda um destes. Eles NÃO são gclid e não entram no
  // mesmo campo na hora de devolver a conversão: mandar no campo errado faz o Google aceitar a
  // chamada e descartar o dado em silêncio, que é o pior resultado possível.
  { chave: "wbraid", plataforma: "google" },
  { chave: "gbraid", plataforma: "google" },
  // A marca da Meta no tráfego que passa por site.
  { chave: "fbclid", plataforma: "meta" },
];

export type OrigemCapturada = {
  plataforma: "google" | "meta";
  cliqueId: string;
  tipoDoClique: string;
  campanhaId?: string;
  campanhaNome?: string;
  conjuntoId?: string;
  conjuntoNome?: string;
  anuncioId?: string;
  anuncioNome?: string;
  palavraChave?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  paginaEntrada?: string;
  bruto: Record<string, string>;
};

/** Corta o que for grande demais pra coluna e descarta o que veio vazio. */
function texto(valor: string | null | undefined, limite = 255): string | undefined {
  const limpo = (valor ?? "").trim();
  if (!limpo) return undefined;
  return limpo.slice(0, limite);
}

/**
 * Descobre a origem a partir dos parâmetros da URL em que a pessoa caiu.
 *
 * Devolve `null` quando não há marca NENHUMA. Isso é o caso normal e não é erro: a maioria das
 * visitas é orgânica, e inventar uma origem pra elas contaminaria exatamente o número que a tela
 * de Tráfego existe pra mostrar. Melhor um lead sem origem do que um lead com origem errada.
 *
 * UTM sozinha não basta pra afirmar plataforma: `utm_source=google` é texto que qualquer um
 * escreve, inclusive por engano num link de e-mail. Só o código do clique é prova.
 */
export function lerOrigemDaUrl(parametros: URLSearchParams, paginaEntrada?: string): OrigemCapturada | null {
  const achado = CODIGOS.map((c) => ({ ...c, valor: texto(parametros.get(c.chave), 512) })).find((c) => c.valor);
  if (!achado?.valor) return null;

  // Guarda tudo que veio, inclusive o que não tem coluna. Parâmetro novo que a plataforma invente
  // continua gravado, e lead mal atribuído vira investigação em vez de mistério.
  const bruto: Record<string, string> = {};
  for (const [chave, valor] of parametros.entries()) {
    if (valor) bruto[chave.slice(0, 64)] = valor.slice(0, 512);
  }

  return {
    plataforma: achado.plataforma,
    cliqueId: achado.valor,
    tipoDoClique: achado.chave,
    // Os nomes abaixo são os do ValueTrack do Google e os equivalentes da Meta. Quem configura o
    // anúncio escolhe mandá-los ou não; quando não vêm, ficam vazios e a campanha é resolvida
    // depois pelo id, na própria API da plataforma.
    campanhaId: texto(parametros.get("campaignid") ?? parametros.get("campaign_id")),
    campanhaNome: texto(parametros.get("campaign_name") ?? parametros.get("utm_campaign")),
    conjuntoId: texto(parametros.get("adgroupid") ?? parametros.get("adset_id")),
    conjuntoNome: texto(parametros.get("adgroup_name") ?? parametros.get("adset_name")),
    anuncioId: texto(parametros.get("creative") ?? parametros.get("ad_id")),
    anuncioNome: texto(parametros.get("ad_name")),
    palavraChave: texto(parametros.get("keyword") ?? parametros.get("utm_term")),
    utmSource: texto(parametros.get("utm_source")),
    utmMedium: texto(parametros.get("utm_medium")),
    utmCampaign: texto(parametros.get("utm_campaign")),
    utmContent: texto(parametros.get("utm_content")),
    utmTerm: texto(parametros.get("utm_term")),
    paginaEntrada: texto(paginaEntrada, 1000),
    bruto,
  };
}

/**
 * A mesma leitura, a partir de um endereço inteiro.
 *
 * Aceita endereço quebrado sem derrubar nada: um lead com origem ilegível ainda é um lead, e
 * perder o cadastro por causa do rastreio seria trocar o essencial pelo acessório.
 */
export function lerOrigemDoEndereco(endereco: string): OrigemCapturada | null {
  try {
    const url = new URL(endereco);
    return lerOrigemDaUrl(url.searchParams, `${url.origin}${url.pathname}`);
  } catch {
    return null;
  }
}

/**
 * Lê o que a pessoa escolheu no aviso de cookies, quando o site informa.
 *
 * O CRM não tem banner e não tem como perguntar: essa escolha acontece no site do cliente. O que
 * dá pra fazer é ACEITAR o sinal quando ele chega — pendurado no link de rastreamento ou no
 * endereço do formulário — e repassar junto da conversão.
 *
 * Aceita os dois jeitos de escrever que aparecem na prática: o parâmetro explícito (`consent=1`)
 * e o formato do Google (`gcs=G111`, em que o terceiro caractere diz se o uso publicitário foi
 * concedido). Não inventa nada: o que não vier reconhecido vira `null`, que quer dizer
 * "não se sabe" — e é diferente de "negou".
 */
export function lerConsentimento(parametros: URLSearchParams): "concedido" | "negado" | null {
  const explicito = (parametros.get("consent") ?? parametros.get("consentimento") ?? "").trim().toLowerCase();
  if (["1", "true", "sim", "granted", "concedido"].includes(explicito)) return "concedido";
  if (["0", "false", "nao", "não", "denied", "negado"].includes(explicito)) return "negado";

  // `gcs` é o formato que o Google usa no Modo de Consentimento: "G1" seguido de um dígito por
  // finalidade. O terceiro caractere é o de dados publicitários.
  const gcs = (parametros.get("gcs") ?? "").trim().toUpperCase();
  if (/^G1[01][01]$/.test(gcs)) return gcs[2] === "1" ? "concedido" : "negado";

  return null;
}
