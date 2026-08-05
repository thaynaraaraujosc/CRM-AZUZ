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

/**
 * Assina o `workspaceId` pra viajar como `state` no OAuth da Meta — sem isso, qualquer um poderia
 * forjar uma chamada ao `/callback` alegando ser de outro workspace (CSRF). Usa o próprio
 * `META_APP_SECRET` como chave (não precisa de mais uma env var só pra isso).
 */
export function assinarState(workspaceId: string): string {
  const assinatura = createHmac("sha256", appSecret()).update(workspaceId).digest("hex");
  return `${workspaceId}.${assinatura}`;
}

/** Verifica o `state` recebido no callback; devolve o `workspaceId` se a assinatura bater, ou
 * `null` caso contrário (state adulterado ou de outro app). */
export function verificarState(state: string | null): string | null {
  if (!state) return null;
  const [workspaceId, assinatura] = state.split(".");
  if (!workspaceId || !assinatura) return null;

  const esperada = createHmac("sha256", appSecret()).update(workspaceId).digest("hex");
  const bufAssinatura = Buffer.from(assinatura);
  const bufEsperada = Buffer.from(esperada);
  if (bufAssinatura.length !== bufEsperada.length) return null;
  return timingSafeEqual(bufAssinatura, bufEsperada) ? workspaceId : null;
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
