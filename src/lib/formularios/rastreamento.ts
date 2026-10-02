/**
 * O que faz o formulário servir pra tráfego pago: o pixel do Meta, a tag do Google e a origem de cada
 * resposta (de qual anúncio a pessoa veio). Nada disso existe no Flow, onde o formulário é briefing de
 * cliente e não página de anúncio.
 *
 * Tudo aqui é função pura, com teste, porque os dois ids entram DENTRO de um script na página pública.
 * Um valor que não for exatamente um id vira script de outra pessoa rodando no formulário do cliente.
 */

/** Id do pixel do Meta: só dígitos. */
export function pixelMetaValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return /^\d{8,20}$/.test(limpo) ? limpo : null;
}

/**
 * Tag do Google: `G-XXXX` (Analytics), `AW-123` (Google Ads) ou `AW-123/rotulo` (a conversão do Ads,
 * que é o que conta o lead na campanha). Letras, números, hífen, sublinhado e uma barra, mais nada.
 */
export function tagGoogleValida(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return /^(G|AW|GT)-[A-Za-z0-9]{4,20}(\/[A-Za-z0-9_-]{1,64})?$/.test(limpo) ? limpo : null;
}

/** A parte da tag que o `gtag('config', ...)` recebe: sem o rótulo da conversão. */
export function idDaTagGoogle(tag: string): string {
  return tag.split("/")[0];
}

export type Rastreamento = { pixelMeta: string | null; tagGoogle: string | null };

/** Lê os dois ids do `integracoes` do formulário, descartando o que não for um id de verdade. */
export function rastreamentoDoFormulario(integracoes: unknown): Rastreamento {
  const dados = (integracoes && typeof integracoes === "object" ? integracoes : {}) as Record<string, unknown>;
  return { pixelMeta: pixelMetaValido(dados.pixelMeta), tagGoogle: tagGoogleValida(dados.tagGoogle) };
}

/** Os parâmetros do link que dizem de onde a pessoa veio. */
export const CHAVES_DE_ORIGEM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

export type OrigemDaResposta = Partial<Record<(typeof CHAVES_DE_ORIGEM)[number] | "pagina", string>>;

/**
 * Limpa a origem que o navegador mandou. Ela vem de quem responde, sem login, então só entram as
 * chaves conhecidas, só texto, e com tamanho limitado. Devolve `null` quando não sobra nada: resposta
 * que veio direto pelo link não guarda um objeto vazio.
 */
export function limparOrigem(bruta: unknown): OrigemDaResposta | null {
  if (!bruta || typeof bruta !== "object") return null;
  const dados = bruta as Record<string, unknown>;
  const limpa: OrigemDaResposta = {};
  for (const chave of [...CHAVES_DE_ORIGEM, "pagina"] as const) {
    const valor = dados[chave];
    if (typeof valor === "string" && valor.trim()) limpa[chave] = valor.trim().slice(0, 300);
  }
  return Object.keys(limpa).length > 0 ? limpa : null;
}

/** A origem numa frase curta, pra coluna da tabela de respostas: "instagram · campanha-setembro". */
export function resumoDaOrigem(origem: OrigemDaResposta | null | undefined): string {
  if (!origem) return "";
  const partes = [origem.utm_source, origem.utm_campaign, origem.utm_content].filter(Boolean) as string[];
  if (partes.length > 0) return partes.join(" · ");
  if (origem.fbclid) return "Anúncio do Meta";
  if (origem.gclid) return "Anúncio do Google";
  return "";
}
