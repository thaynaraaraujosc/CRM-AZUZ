/**
 * DE ONDE VEIO ESTE LEAD, numa etiqueta.
 *
 * "Meu tráfego está conectado com o CRM, eu coloquei o pixel. Eu preciso saber se o lead que entrou
 * no meu chat e no meu funil veio de onde — veio do Instagram? veio do anúncio? Preciso que apareça
 * uma tag (…) pra saber se esse lead veio da campanha, se veio direto do tráfego pago, ou se veio
 * do formulário."
 *
 * O CRM JÁ GUARDAVA TUDO ISSO e não mostrava em lugar nenhum da lista. `OrigemDoLead` tem o código
 * do clique, a campanha, o conjunto, o anúncio, os UTMs e por qual caminho o lead entrou — é o que
 * alimenta a devolução de conversão pro Google e pra Meta. Na linha da conversa aparecia só
 * `Conversa.origem`, que o webhook grava como "Direto" pra todo mundo: um campo que diz a mesma
 * coisa em toda linha não informa nada.
 *
 * A ORDEM AQUI É A DA CERTEZA, da maior pra menor, e isso é o ponto do arquivo:
 *
 * 1. O CÓDIGO DO CLIQUE. É prova: a plataforma só o entrega a quem clicou num anúncio dela. O TIPO
 *    do código diz qual plataforma (`gclid` é Google, `fbclid` e `ctwa_clid` são Meta, `ttclid` é
 *    TikTok) — e eles não são intercambiáveis.
 * 2. O FORMULÁRIO INSTANTÂNEO (`leadgenId`): também prova, e de um caminho diferente do clique.
 * 3. O CAMINHO por onde o CRM ficou sabendo (formulário do site, Instagram, cadastro manual).
 * 4. OS UTMs, que são o que o anunciante escreveu no link — informação boa, mas que qualquer um
 *    pode copiar e colar. Por isso vêm depois da prova, nunca antes.
 * 5. O SITE, quando só se sabe que ela passou por uma página.
 *
 * SEM NADA DISSO, DEVOLVE `null` — e a linha não ganha etiqueta. Inventar "Direto" aqui seria
 * afirmar que a pessoa chegou sozinha, quando a verdade é que o CRM não sabe de onde ela veio: as
 * duas coisas se parecem na tela e levam a decisões opostas sobre onde investir.
 *
 * Função pura, sem banco: é regra, e regra tem teste.
 */

/** O que esta regra precisa de `OrigemDoLead`. Tudo opcional: lead sem rastreio é o caso comum. */
export type OrigemParaTag = {
  tipoDoClique?: string | null;
  cliqueId?: string | null;
  leadgenId?: string | null;
  caminho?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  campanhaNome?: string | null;
  anuncioNome?: string | null;
  palavraChave?: string | null;
  metaSource?: string | null;
  referrer?: string | null;
  paginaEntrada?: string | null;
} | null | undefined;

export type TagDeOrigem = {
  /**
   * O rótulo curto da etiqueta. Usa as MESMAS palavras de `classeOrigem` ("Meta Ads", "Google
   * Ads", "Instagram", "TikTok", "Formulário") pra herdar a cor que o CRM já dá a cada origem, em
   * vez de uma paleta nova que diria a mesma coisa com outras cores.
   */
  rotulo: string;
  /** A linha do `title`: campanha, anúncio, palavra-chave. Vazia quando não há o que detalhar. */
  detalhe: string;
  /** Veio de anúncio pago? É o que separa "investimento" de "orgânico" numa leitura de relance. */
  pago: boolean;
};

/** Os `utm_medium` que querem dizer mídia paga. Lista fechada: "medium" é texto livre. */
const MEDIUM_PAGO = new Set([
  "cpc", "ppc", "paid", "paidsocial", "paid_social", "paid-social", "cpm", "cpv", "display", "banner", "ads", "ad",
]);

/** `utm_source` conhecido → o rótulo que o CRM já usa pra ele. */
const FONTE_CONHECIDA: Record<string, string> = {
  instagram: "Instagram",
  ig: "Instagram",
  facebook: "Facebook",
  fb: "Facebook",
  "facebook.com": "Facebook",
  meta: "Meta Ads",
  google: "Google",
  "google.com": "Google",
  adwords: "Google Ads",
  googleads: "Google Ads",
  tiktok: "TikTok",
  youtube: "YouTube",
  bing: "Bing",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

function limpo(valor: string | null | undefined): string {
  return (valor ?? "").trim();
}

/** A linha de detalhe: o que a pessoa reconhece do gerenciador de anúncios, na ordem do específico. */
function detalheDe(origem: NonNullable<OrigemParaTag>): string {
  const partes = [
    limpo(origem.campanhaNome) || limpo(origem.utmCampaign),
    limpo(origem.anuncioNome),
    limpo(origem.palavraChave) ? `"${limpo(origem.palavraChave)}"` : "",
  ].filter(Boolean);
  return partes.join(" · ");
}

export function tagDeOrigemDoLead(origem: OrigemParaTag): TagDeOrigem | null {
  if (!origem) return null;
  const detalhe = detalheDe(origem);
  const tag = (rotulo: string, pago: boolean): TagDeOrigem => ({ rotulo, detalhe, pago });

  // 1. O código do clique é prova de anúncio. O tipo dele diz de qual plataforma.
  const tipo = limpo(origem.tipoDoClique).toLowerCase();
  if (limpo(origem.cliqueId)) {
    if (tipo === "gclid" || tipo === "gbraid" || tipo === "wbraid") return tag("Google Ads", true);
    if (tipo === "fbclid" || tipo === "ctwa_clid") return tag("Meta Ads", true);
    if (tipo === "ttclid") return tag("TikTok", true);
  }

  // 2. Formulário instantâneo do Meta: o lead nem passou por site, veio do próprio anúncio.
  if (limpo(origem.leadgenId)) return tag("Formulário do Meta", true);

  // 3. Por onde o CRM ficou sabendo.
  const caminho = limpo(origem.caminho).toLowerCase();
  if (caminho === "formulario") return tag("Formulário", false);
  if (caminho === "manual") return tag("Salvo manualmente", false);

  /*
   * 4. OS UTMs. `medium` pago vira "Tráfego pago" com a fonte junto quando ela é conhecida: o que
   * importa de relance é que aquele lead custou dinheiro.
   */
  const fonte = limpo(origem.utmSource).toLowerCase();
  const medium = limpo(origem.utmMedium).toLowerCase().replace(/\s+/g, "");
  if (medium && MEDIUM_PAGO.has(medium)) {
    const conhecida = FONTE_CONHECIDA[fonte];
    return tag(conhecida && conhecida !== "WhatsApp" ? conhecida : "Tráfego pago", true);
  }
  if (fonte) return tag(FONTE_CONHECIDA[fonte] ?? limpo(origem.utmSource), false);

  // 5. O que a Meta manda no anúncio de Click-to-WhatsApp quando não veio clique nenhum.
  const meta = limpo(origem.metaSource).toLowerCase();
  if (meta === "ig") return tag("Instagram", false);
  if (meta === "fb") return tag("Facebook", false);
  if (caminho === "instagram") return tag("Instagram", false);

  // 6. Só se sabe que ela passou por uma página.
  if (limpo(origem.referrer) || limpo(origem.paginaEntrada)) return tag("Site", false);

  return null;
}

/**
 * A PRÉVIA DO CRIATIVO: o que a pessoa viu antes de mandar mensagem.
 *
 * "Tem como aparecer na barra superior o criativo em miniatura, o nome do criativo pelo qual essa
 * pessoa veio? Ela viu o criativo e mandou mensagem direta, aí aparece aqui o criativo que ela
 * veio. Se ela veio pelo formulário, aparece 'veio através do formulário tal'. Se ela veio pelo
 * Instagram, clicou lá no link da bio."
 *
 * TEM COMO, E O DADO JÁ ESTAVA NO BANCO. Quando alguém clica num anúncio de Click-to-WhatsApp, a
 * Meta manda junto da primeira mensagem um bloco `referral` com o título do anúncio, o corpo, a
 * imagem, a miniatura e o link de origem. O CRM guarda esse bloco inteiro em `OrigemDoLead.bruto`
 * desde que o rastreio existe — e nunca o leu de volta. Não é preciso chamar a API da Meta nem
 * configurar nada: é leitura do que já está gravado.
 *
 * Por isso esta função lê `bruto` e não colunas: os campos do criativo nunca ganharam coluna
 * própria, e criá-las agora não traria de volta o que já passou — enquanto o JSON tem tudo, dos
 * leads de antes inclusive.
 */
export type PreviaDaOrigem = {
  /** A etiqueta curta, a mesma da lista de conversas. */
  rotulo: string;
  pago: boolean;
  /** O título do anúncio, o nome do formulário — o que identifica a peça. */
  titulo?: string;
  /** A linha de baixo: campanha, conjunto, o texto do anúncio. */
  detalhe?: string;
  /** A miniatura do criativo, quando a Meta mandou uma. */
  miniatura?: string;
  /** Pra onde a peça levava. Abre em aba nova. */
  link?: string;
};

/** O `referral` da Meta, como ele chega. Ver a referência da Cloud API. */
type ReferralDaMeta = {
  headline?: unknown;
  body?: unknown;
  source_url?: unknown;
  source_type?: unknown;
  image_url?: unknown;
  video_url?: unknown;
  thumbnail_url?: unknown;
};

function comoTexto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

/** Um endereço http(s) e nada mais: `javascript:` e `data:` vindos de JSON não viram link nem src. */
function comoEndereco(valor: unknown): string | undefined {
  const texto = comoTexto(valor);
  if (!texto) return undefined;
  return /^https?:\/\//i.test(texto) ? texto : undefined;
}

export function previaDaOrigem(
  origem: (OrigemParaTag & { bruto?: unknown }) | null | undefined,
  /** O nome do formulário do CRM, quando a origem aponta pra um. Vem de `Formulario`. */
  nomeDoFormulario?: string | null,
): PreviaDaOrigem | null {
  const tag = tagDeOrigemDoLead(origem);
  if (!tag || !origem) return null;

  const ref = (origem.bruto && typeof origem.bruto === "object" ? origem.bruto : {}) as ReferralDaMeta;

  /*
   * O TÍTULO É O DO ANÚNCIO, e o `headline` é o campo que a Meta usa pra ele. `anuncioNome` é onde
   * o CRM já guarda esse mesmo texto — os dois são lidos porque o `bruto` só existe pra quem veio
   * por Click-to-WhatsApp, e a coluna existe também pra quem veio por link rastreado.
   */
  const titulo =
    comoTexto(ref.headline) ?? comoTexto(origem.anuncioNome) ?? comoTexto(nomeDoFormulario);

  /*
   * A MINIATURA, na ordem do que mostra melhor. `thumbnail_url` é a versão pequena que a Meta
   * gera; `image_url` é o criativo em tamanho cheio e serve quando não há miniatura. Vídeo não tem
   * imagem própria aqui — a Meta manda a miniatura dele no mesmo campo.
   */
  const miniatura = comoEndereco(ref.thumbnail_url) ?? comoEndereco(ref.image_url);

  const detalhe = [limpo(origem.campanhaNome) || limpo(origem.utmCampaign), comoTexto(ref.body)]
    .filter(Boolean)
    .join(" · ");

  return {
    rotulo: tag.rotulo,
    pago: tag.pago,
    ...(titulo ? { titulo } : {}),
    ...(detalhe ? { detalhe } : {}),
    ...(miniatura ? { miniatura } : {}),
    ...(comoEndereco(ref.source_url) ? { link: comoEndereco(ref.source_url)! } : {}),
  };
}
