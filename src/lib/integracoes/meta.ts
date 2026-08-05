import { createHmac, timingSafeEqual } from "node:crypto";

/** Versão da Graph API usada em toda chamada à Meta — um lugar só pra atualizar quando a Meta
 * depreciar a versão atual. */
export const META_GRAPH_VERSION = "v21.0";
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

function appSecret(): string {
  const segredo = process.env.META_APP_SECRET;
  if (!segredo) throw new Error("META_APP_SECRET não configurado.");
  return segredo;
}

/** Escopos do diálogo OAuth por provedor — um App só da Meta atende os três, cada um pedindo o
 * subconjunto de permissões que precisa. */
export const ESCOPOS_POR_PROVEDOR: Record<string, string[]> = {
  meta_whatsapp: ["whatsapp_business_management", "whatsapp_business_messaging", "business_management"],
  meta_instagram: [
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_comments",
    "pages_show_list",
    "pages_read_engagement",
  ],
  meta_ads: ["ads_management", "ads_read"],
};

/**
 * Assina `workspaceId` + `provedor` pra viajar como `state` no OAuth da Meta — sem isso, qualquer
 * um poderia forjar uma chamada ao `/callback` alegando ser de outro workspace ou trocar o
 * provedor em trânsito (CSRF / adulteração). Usa o próprio `META_APP_SECRET` como chave (não
 * precisa de mais uma env var só pra isso). O provedor viaja assinado (não como query param
 * solto no redirect_uri) porque só o `state` volta validado pela Meta.
 */
export function assinarState(workspaceId: string, provedor: string): string {
  const assinatura = createHmac("sha256", appSecret()).update(`${workspaceId}.${provedor}`).digest("hex");
  return `${workspaceId}.${provedor}.${assinatura}`;
}

/** Verifica o `state` recebido no callback; devolve `{workspaceId, provedor}` se a assinatura
 * bater, ou `null` caso contrário (state adulterado, de outro app, ou mal formado). */
export function verificarState(state: string | null): { workspaceId: string; provedor: string } | null {
  if (!state) return null;
  const partes = state.split(".");
  if (partes.length !== 3) return null;
  const [workspaceId, provedor, assinatura] = partes;
  if (!workspaceId || !provedor || !assinatura) return null;

  const esperada = createHmac("sha256", appSecret()).update(`${workspaceId}.${provedor}`).digest("hex");
  const bufAssinatura = Buffer.from(assinatura);
  const bufEsperada = Buffer.from(esperada);
  if (bufAssinatura.length !== bufEsperada.length) return null;
  return timingSafeEqual(bufAssinatura, bufEsperada) ? { workspaceId, provedor } : null;
}

/** Valida a assinatura `X-Hub-Signature-256` que a Meta manda em todo POST de webhook — garante
 * que a chamada é mesmo da Meta (o payload é assinado com o App Secret). */
export function validarAssinaturaWebhook(payloadCru: string, assinaturaHeader: string | null): boolean {
  if (!assinaturaHeader?.startsWith("sha256=")) return false;
  const assinaturaRecebida = assinaturaHeader.slice("sha256=".length);
  const assinaturaEsperada = createHmac("sha256", appSecret()).update(payloadCru).digest("hex");

  const bufRecebida = Buffer.from(assinaturaRecebida);
  const bufEsperada = Buffer.from(assinaturaEsperada);
  if (bufRecebida.length !== bufEsperada.length) return false;
  return timingSafeEqual(bufRecebida, bufEsperada);
}
