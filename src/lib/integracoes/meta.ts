import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * O `wa_id` que a Meta manda no webhook às vezes vem sem o 9º dígito do celular brasileiro
 * (formato antigo: `5562XXXXXXXX`, 12 dígitos), mas o número cadastrado como destinatário
 * autorizado (modo desenvolvimento) usa o formato atual com o 9 (`556293XXXXXXX`, 13 dígitos) —
 * sem normalizar, a Graph API rejeita o envio com "Recipient phone number not in allowed list"
 * mesmo sendo o mesmo número. Só mexe em número BR de celular (55 + DDD de 2 dígitos + 8 dígitos
 * sem o 9); qualquer outro formato passa direto.
 */
export function normalizarNumeroBrasileiro(numeroLimpo: string): string {
  if (numeroLimpo.startsWith("55") && numeroLimpo.length === 12) {
    return `${numeroLimpo.slice(0, 4)}9${numeroLimpo.slice(4)}`;
  }
  return numeroLimpo;
}

/** Versão da Graph API usada em toda chamada à Meta — um lugar só pra atualizar quando a Meta
 * depreciar a versão atual. `NEXT_PUBLIC_` porque o Embedded Signup roda no navegador (SDK JS do
 * Facebook) e precisa da mesma versão que o servidor usa. */
export const META_GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v23.0";
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type ErroGraph = { error?: { message?: string; code?: number } };

/**
 * Chamada autenticada à Graph API com o token DAQUELE tenant (nunca um token global) — `Bearer` no
 * header, não `?access_token=` na query, pra token não vazar em log de servidor/proxy. Erro da
 * Graph vira `Error` com a mensagem original da Meta, pra quem chama decidir o que mostrar.
 */
export async function chamarGraph<T>(
  caminho: string,
  accessToken: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> } = {},
): Promise<T> {
  const resposta = await fetch(`${META_GRAPH_URL}${caminho}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const corpo = (await resposta.json()) as T & ErroGraph;
  if (!resposta.ok) {
    const erro = new Error(corpo.error?.message ?? `Falha na Graph API (${resposta.status})`);
    // Preserva o código numérico da Meta — é ele que distingue "janela de 24h fechada" de "token
    // revogado" etc. (ver `MENSAGEM_POR_CODIGO_META`), a mensagem em texto não é confiável pra isso.
    (erro as Error & { codigoMeta?: number }).codigoMeta = corpo.error?.code;
    throw erro;
  }
  return corpo;
}

/**
 * Códigos de erro da Cloud API que precisam de tratamento explícito na tela — a mensagem crua da
 * Meta vem em inglês e técnica demais pra mostrar pro atendente. Código fora dessa lista cai na
 * mensagem original da Meta (melhor que um "erro desconhecido" genérico).
 */
export const MENSAGEM_POR_CODIGO_META: Record<number, string> = {
  131047:
    "Passaram mais de 24h desde a última mensagem dessa pessoa — pra falar agora só usando um modelo de mensagem aprovado.",
  131026: "Esse número não tem WhatsApp.",
  132000: "O modelo de mensagem espera uma quantidade diferente de informações.",
  190: "A conexão com o WhatsApp expirou ou foi revogada — precisa conectar de novo.",
  133010: "O número ainda não foi registrado na Cloud API — refaça a conexão.",
};

/** Erro da Meta que significa "essa conexão morreu, precisa reconectar" (token revogado/expirado) —
 * quem chama marca a integração como desconectada em vez de só mostrar o erro. */
export function ehTokenInvalido(codigoMeta: number | undefined): boolean {
  return codigoMeta === 190;
}

function appSecret(): string {
  const segredo = process.env.META_APP_SECRET;
  if (!segredo) throw new Error("META_APP_SECRET não configurado.");
  return segredo;
}

/** Escopos do diálogo OAuth por provedor — um App só da Meta atende os dois, cada um pedindo o
 * subconjunto de permissões que precisa. Instagram NÃO está aqui: usa um fluxo de OAuth separado
 * (Login do Instagram, não Login do Facebook), ver src/lib/integracoes/instagram-login.ts. */
export const ESCOPOS_POR_PROVEDOR: Record<string, string[]> = {
  meta_whatsapp: ["whatsapp_business_management", "whatsapp_business_messaging", "business_management"],
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
