/**
 * OS IDENTIFICADORES DE ATRIBUIÇÃO DE UM LEAD, num lugar só.
 *
 * É o que a fila usa pra decidir se dá pra mandar a conversão: sem nenhum deles, a plataforma não
 * tem como reencontrar o clique e o evento vira um usuário novo em vez de uma conversão atribuída
 * (ver `motivoParaPular`).
 *
 * Existe porque a tradução de `OrigemDoLead` pra esse formato é sutil e estava escrita por extenso
 * dentro do gatilho de etapa — e uma segunda cópia dela, num segundo lugar que enfileira conversão,
 * é como se chega a dois critérios diferentes pra mesma pergunta.
 *
 * O SUTIL É O `tipoDoClique`. `OrigemDoLead` guarda UM código de clique e o tipo dele, porque é
 * assim que ele chega: quem veio de um anúncio do Google tem `gclid` (ou `gbraid`/`wbraid`, as
 * variantes de quando o cookie não pode ser lido), quem veio da Meta tem `fbclid`, e quem veio de
 * um anúncio de Click-to-WhatsApp tem `ctwa_clid`. Mandar o código no campo errado faz a plataforma
 * ACEITAR e descartar em silêncio — o pior resultado possível, porque parece que funcionou.
 *
 * Função pura, sem banco: é regra, e regra tem teste.
 */

/** O recorte de `OrigemDoLead` que esta regra precisa. */
export type OrigemParaIdentificar = {
  cliqueId?: string | null;
  tipoDoClique?: string | null;
  ttclid?: string | null;
  igSid?: string | null;
  gclientid?: string | null;
} | null;

export type IdentificadoresDoLead = {
  gclid: string | null;
  fbclid: string | null;
  ctwaClid: string | null;
  ttclid: string | null;
  igSid: string | null;
  gclientid: string | null;
  email: string | null;
  telefone: string | null;
};

export function identificadoresDoLead(
  origem: OrigemParaIdentificar,
  contato: { email?: string | null; whatsapp?: string | null },
): IdentificadoresDoLead {
  const tipo = origem?.tipoDoClique ?? null;
  const codigo = origem?.cliqueId ?? null;
  // `gclid`, `gbraid` e `gclient...` começam por "g"; `wbraid` é a variante do mesmo trio do Google
  // e entra no mesmo campo pra decisão de "dá pra mandar". Qual deles vai em qual campo da
  // requisição é escolha do adaptador do Google, não daqui.
  const doGoogle = tipo?.startsWith("g") || tipo === "wbraid";
  return {
    gclid: doGoogle ? codigo : null,
    fbclid: tipo === "fbclid" ? codigo : null,
    ctwaClid: tipo === "ctwa_clid" ? codigo : null,
    ttclid: origem?.ttclid ?? null,
    igSid: origem?.igSid ?? null,
    gclientid: origem?.gclientid ?? null,
    email: contato.email ?? null,
    telefone: contato.whatsapp ?? null,
  };
}
