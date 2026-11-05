/**
 * O RASTREIO DE ORIGEM achatado nos nomes que a condição usa.
 *
 * Mora fora do disparo porque não é do disparo: é a tradução entre as colunas de `OrigemDoLead` e
 * os campos que a automação pergunta, e quem monta o contexto do contato são DOIS lugares (o
 * disparo por evento e o gatilho de etapa do funil). Com a tradução escrita num deles só, metade
 * dos robôs enxergava a origem do lead e a outra metade não — dependendo de por onde ele entrou.
 *
 * Campo sem valor fica de fora em vez de virar string vazia: "existe"/"não existe" precisa
 * distinguir "não veio de anúncio" de "veio com o campo em branco".
 */

export type OrigemParaCondicoes = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  utmReferrer?: string | null;
  referrer?: string | null;
  paginaEntrada?: string | null;
  cliqueId?: string | null;
  tipoDoClique?: string | null;
  gclientid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ttclid?: string | null;
  ttp?: string | null;
  campanhaId?: string | null;
  campanhaNome?: string | null;
  conjuntoId?: string | null;
  anuncioId?: string | null;
  anuncioNome?: string | null;
  criativoId?: string | null;
  metaSource?: string | null;
  metaRef?: string | null;
  igSid?: string | null;
  psid?: string | null;
  leadgenId?: string | null;
  caminho?: string | null;
  criadoEm?: Date | null;
  ultimoToque?: unknown;
  ultimoToqueEm?: Date | null;
};

export function rastreioParaCondicoes(origem: OrigemParaCondicoes | null | undefined): Record<string, string> {
  if (!origem) return {};
  const fora: Record<string, string> = {};
  const por = (chave: string, valor: string | null | undefined) => {
    if (typeof valor === "string" && valor.trim()) fora[chave] = valor;
  };
  por("utm_source", origem.utmSource);
  por("utm_medium", origem.utmMedium);
  por("utm_campaign", origem.utmCampaign);
  por("utm_content", origem.utmContent);
  por("utm_term", origem.utmTerm);
  por("utm_referrer", origem.utmReferrer);
  por("referrer", origem.referrer);
  por("pagina_entrada", origem.paginaEntrada);
  por("gclientid", origem.gclientid);
  por("fbp", origem.fbp);
  por("fbc", origem.fbc);
  por("ttclid", origem.ttclid);
  por("ttp", origem.ttp);
  por("meta_ads_campanha", origem.campanhaId);
  por("meta_ads_conjunto", origem.conjuntoId);
  por("meta_ads_anuncio", origem.anuncioId);
  por("meta_ads_criativo", origem.criativoId);
  por("meta_source", origem.metaSource);
  por("meta_ref", origem.metaRef);
  por("ig_sid", origem.igSid);
  por("psid", origem.psid);
  por("leadgen_id", origem.leadgenId);
  por("origem_caminho", origem.caminho);
  // Campanha e anúncio pelo NOME: é o que a pessoa que montou o anúncio reconhece. O id fica nos
  // campos do Meta Ads, pra quem precisa casar com o gerenciador.
  por("campanha", origem.campanhaNome);
  por("anuncio", origem.anuncioNome);
  if (origem.criadoEm instanceof Date) fora.primeiro_toque_em = origem.criadoEm.toISOString().slice(0, 10);

  /*
   * O CÓDIGO DO CLIQUE vai pro campo do TIPO dele, e não pra um campo "clique" genérico.
   *
   * "gclid" e "wbraid"/"gbraid" no Google, "fbclid" e "ctwa_clid" na Meta: eles não são
   * intercambiáveis. Cada um entra num lugar diferente na hora de devolver a conversão, e mandar
   * no campo errado faz a plataforma aceitar e ignorar — o pior resultado possível.
   */
  if (origem.cliqueId?.trim()) {
    const tipo = (origem.tipoDoClique ?? "").toLowerCase();
    if (tipo === "gclid" || tipo === "wbraid" || tipo === "gbraid") fora.gclid = origem.cliqueId;
    if (tipo === "fbclid" || tipo === "ctwa_clid") fora.fbclid = origem.cliqueId;
    if (tipo === "ttclid") fora.ttclid = origem.cliqueId;
  }

  /*
   * O ÚLTIMO TOQUE entra com um punhado de campos, não com todos.
   *
   * O primeiro toque é o que decide atribuição e o que quase toda regra pergunta. Do último
   * interessa o bastante pra escrever "voltou pelo Google depois de ter chegado pela Meta" — e
   * repetir as vinte colunas com prefixo transformaria a lista de campos da condição num catálogo
   * que ninguém lê até o fim. A ficha do lead mostra o último toque inteiro.
   */
  const ultimo = origem.ultimoToque;
  if (ultimo && typeof ultimo === "object" && !Array.isArray(ultimo)) {
    const u = ultimo as Record<string, unknown>;
    const comoTexto = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
    por("ultimo_utm_source", comoTexto(u.utmSource));
    por("ultimo_utm_campaign", comoTexto(u.utmCampaign));
    por("ultimo_campanha", comoTexto(u.campanhaNome));
    por("ultimo_anuncio", comoTexto(u.anuncioNome));
    por("ultimo_caminho", comoTexto(u.caminho));
  }
  if (origem.ultimoToqueEm instanceof Date) fora.ultimo_toque_em = origem.ultimoToqueEm.toISOString().slice(0, 10);

  return fora;
}
