import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "API do Instagram com Login do Instagram" — fluxo de OAuth separado do Login do Facebook usado
 * pelo resto da integração da Meta (`src/lib/integracoes/meta.ts`). A Meta migrou o acesso a
 * mensagens/comentários do Instagram pra esse produto novo (login direto pela conta do Instagram,
 * sem precisar de Página do Facebook nem da verificação de empresa que isso exige) — as permissões
 * antigas baseadas em Login do Facebook (`instagram_basic` etc.) já não são aceitas.
 *
 * Tem App ID/Secret PRÓPRIOS, diferentes do App principal (`META_APP_ID`/`META_APP_SECRET`) — são
 * dois produtos separados dentro do mesmo App da Meta, cada um com seu painel de credenciais.
 */

const INSTAGRAM_GRAPH_VERSION = "v21.0";

function appId(): string {
  const valor = process.env.META_INSTAGRAM_APP_ID;
  if (!valor) throw new Error("META_INSTAGRAM_APP_ID não configurado.");
  return valor;
}

function appSecret(): string {
  const valor = process.env.META_INSTAGRAM_APP_SECRET;
  if (!valor) throw new Error("META_INSTAGRAM_APP_SECRET não configurado.");
  return valor;
}

/** Permissões atuais do produto "API do Instagram com Login do Instagram" — nomes diferentes das
 * antigas baseadas em Página do Facebook (`instagram_basic`, `instagram_manage_messages`...). */
export const ESCOPOS_INSTAGRAM_LOGIN = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
];

export function urlAutorizacao(redirectUri: string, state: string): string {
  const dialogo = new URL("https://www.instagram.com/oauth/authorize");
  dialogo.searchParams.set("client_id", appId());
  dialogo.searchParams.set("redirect_uri", redirectUri);
  dialogo.searchParams.set("scope", ESCOPOS_INSTAGRAM_LOGIN.join(","));
  dialogo.searchParams.set("response_type", "code");
  dialogo.searchParams.set("state", state);
  return dialogo.toString();
}

type ErroGraph = { error_message?: string; error?: { message?: string } };

/**
 * Troca o `code` do redirect pelo token de longa duração (~60 dias) — dois passos, formato
 * diferente do fluxo de Login do Facebook: primeiro token curto via POST form-encoded em
 * `api.instagram.com`, depois troca por um de longa duração via GET em `graph.instagram.com`.
 */
export async function trocarCodePorTokenInstagram(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; instagramContaId: string; expiraEm: Date | null }> {
  const corpo = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const respostaCurta = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  const tokenCurto = (await respostaCurta.json()) as { access_token?: string; user_id?: string } & ErroGraph;
  if (!respostaCurta.ok || !tokenCurto.access_token) {
    throw new Error(tokenCurto.error_message ?? tokenCurto.error?.message ?? "Falha ao trocar o código de autorização do Instagram.");
  }

  const respostaLonga = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret()}&access_token=${tokenCurto.access_token}`,
  );
  const tokenLongo = (await respostaLonga.json()) as { access_token?: string; expires_in?: number } & ErroGraph;
  if (!respostaLonga.ok || !tokenLongo.access_token) {
    throw new Error(tokenLongo.error_message ?? tokenLongo.error?.message ?? "Falha ao gerar o token de longa duração do Instagram.");
  }

  return {
    accessToken: tokenLongo.access_token,
    instagramContaId: tokenCurto.user_id ?? "",
    expiraEm: tokenLongo.expires_in ? new Date(Date.now() + tokenLongo.expires_in * 1000) : null,
  };
}

/** Busca @usuário e id da conta a partir do token — o `user_id` que já vem da troca de token acima
 * deveria bastar, mas confirma/complementa com o `username` de exibição. */
export async function buscarPerfilInstagram(accessToken: string): Promise<{ instagramContaId: string; username: string }> {
  const resposta = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me?fields=user_id,username&access_token=${accessToken}`,
  );
  const dados = (await resposta.json()) as { user_id?: string; username?: string } & ErroGraph;
  if (!resposta.ok || !dados.username) {
    throw new Error(dados.error_message ?? dados.error?.message ?? "Falha ao buscar o perfil do Instagram conectado.");
  }
  return { instagramContaId: dados.user_id ?? "", username: dados.username };
}

/**
 * Manda uma mensagem pelo Direct.
 *
 * `destinatarioId` é o id interno de quem vai receber (o mesmo que chega no webhook e fica em
 * `Conversa.contato`), não o @ — é o que a API aceita, e ele não muda se a pessoa trocar de nome
 * de usuário.
 *
 * Vale a mesma janela de 24h do WhatsApp: fora dela a Meta recusa mensagem livre. Aqui o erro dela
 * sobe como está, porque a mensagem já é específica o bastante pra quem está atendendo entender.
 */
export async function enviarDirectInstagram(
  accessToken: string,
  destinatarioId: string,
  texto: string,
  /** `mid` da mensagem sendo respondida. Faz a citação aparecer TAMBÉM no Instagram da pessoa —
   * sem isso, o CRM mostrava a citação só de um lado e a cliente recebia uma mensagem solta, sem
   * saber a que ela respondia. */
  respondendoMid?: string,
): Promise<string | undefined> {
  const resposta = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      recipient: { id: destinatarioId },
      message: { text: texto, ...(respondendoMid ? { reply_to: { mid: respondendoMid } } : {}) },
    }),
  });
  const dados = (await resposta.json()) as { message_id?: string } & ErroGraph;
  if (!resposta.ok) {
    throw new Error(dados.error_message ?? dados.error?.message ?? `Falha ao enviar (HTTP ${resposta.status})`);
  }
  return dados.message_id;
}

/**
 * Baixa a foto de perfil e devolve embutida (data URL).
 *
 * O link que o Instagram entrega é de CDN e expira em poucas horas — guardar só a URL deixaria a
 * conversa sem foto no dia seguinte. Foto de perfil é pequena, então embutir sai barato e resolve
 * de vez. Falha vira `null`, e a tela cai nas iniciais como já fazia.
 */
export async function baixarFotoPerfil(url: string): Promise<string | null> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const bytes = Buffer.from(await resposta.arrayBuffer());
    // Acima disso não é foto de perfil — não vale embutir no banco.
    if (bytes.length > 2 * 1024 * 1024) return null;
    const mimeType = resposta.headers.get("content-type") ?? "image/jpeg";
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch (erro) {
    console.error("[instagram] Falha ao baixar a foto de perfil:", erro);
    return null;
  }
}

/**
 * Inscreve o app nos webhooks da conta do Instagram recém-conectada.
 *
 * SEM ISSO O WEBHOOK NUNCA DISPARA: a conta autoriza, o CRM mostra "Conectado" e nenhuma mensagem
 * do Direct chega — exatamente o mesmo passo que o WhatsApp exige por WABA (`subscribed_apps`) e
 * que aqui simplesmente não existia. Autorizar no OAuth dá permissão de acesso, não assinatura de
 * eventos; são duas coisas.
 *
 * Devolve o erro em texto em vez de lançar: a conexão em si já deu certo neste ponto, e derrubá-la
 * por causa da assinatura deixaria a pessoa sem nada. Quem chama guarda isso pra mostrar na tela.
 *
 * `messaging_reactions` entra junto de `messages`: sem esse campo, a curtida que a cliente dá numa
 * mensagem simplesmente não chega — a Meta manda cada tipo de evento só pra quem assinou aquele
 * campo. Quem conectou antes disto precisa reconectar pra assinatura ser refeita.
 */
export async function inscreverAppNoInstagram(accessToken: string): Promise<string | null> {
  try {
    const resposta = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/subscribed_apps?subscribed_fields=messages,messaging_reactions`,
      { method: "POST", headers: { authorization: `Bearer ${accessToken}` } },
    );
    const dados = (await resposta.json()) as { success?: boolean } & ErroGraph;
    if (!resposta.ok || dados.success === false) {
      const mensagem = dados.error_message ?? dados.error?.message ?? `HTTP ${resposta.status}`;
      console.error("[instagram] Falha ao inscrever o app nos webhooks da conta:", mensagem);
      return mensagem;
    }
    return null;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida";
    console.error("[instagram] Falha ao inscrever o app nos webhooks da conta:", mensagem);
    return mensagem;
  }
}

/**
 * Busca o @ de QUEM MANDOU uma mensagem, a partir do id que o webhook entrega.
 *
 * O Direct identifica o remetente por um id interno e longo (`17841400...`), específico daquela
 * conta — sem essa busca, a conversa aparece no CRM com esse número no lugar do nome, e não há
 * como saber com quem se está falando.
 *
 * Devolve `null` em qualquer falha (perfil sem permissão, id de um app diferente, API fora do ar):
 * quem chama cai no id como antes. Uma mensagem nunca deixa de chegar por causa disto.
 */
export async function buscarPerfilDeQuemMandou(
  accessToken: string,
  remetenteId: string,
): Promise<{ username?: string; nome?: string; fotoUrl?: string } | null> {
  try {
    const resposta = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${remetenteId}?fields=username,name,profile_pic&access_token=${accessToken}`,
    );
    const dados = (await resposta.json()) as { username?: string; name?: string; profile_pic?: string } & ErroGraph;
    if (!resposta.ok) {
      console.error("[instagram] Falha ao buscar o perfil de quem mandou:", dados.error?.message ?? resposta.status);
      return null;
    }
    // A foto vem em `profile_pic` — mas nem toda conta/permissão devolve esse campo, e quando ele
    // falta a conversa fica só com as iniciais sem nenhuma pista do porquê. Registrar quais campos
    // vieram (nunca os valores) é o que permite saber se é ausência de permissão ou outro nome.
    if (!dados.profile_pic) {
      console.log("[instagram] perfil sem profile_pic; campos recebidos:", Object.keys(dados));
    }
    return { username: dados.username, nome: dados.name, fotoUrl: dados.profile_pic };
  } catch (erro) {
    console.error("[instagram] Falha ao buscar o perfil de quem mandou:", erro);
    return null;
  }
}

/** Assina/verifica o `state` do OAuth — mesma lógica de `assinarState`/`verificarState` de
 * `meta.ts`, chave própria (não precisa ser a mesma do App principal, só interna a este fluxo). */
export function assinarStateInstagram(workspaceId: string): string {
  const assinatura = createHmac("sha256", appSecret()).update(workspaceId).digest("hex");
  return `${workspaceId}.${assinatura}`;
}

export function verificarStateInstagram(state: string | null): string | null {
  if (!state) return null;
  const partes = state.split(".");
  if (partes.length !== 2) return null;
  const [workspaceId, assinatura] = partes;
  if (!workspaceId || !assinatura) return null;

  const esperada = createHmac("sha256", appSecret()).update(workspaceId).digest("hex");
  const bufAssinatura = Buffer.from(assinatura);
  const bufEsperada = Buffer.from(esperada);
  if (bufAssinatura.length !== bufEsperada.length) return null;
  return timingSafeEqual(bufAssinatura, bufEsperada) ? workspaceId : null;
}

/**
 * Curte (ou descurte) uma mensagem do Direct — o mesmo coração que o app do Instagram manda ao dar
 * dois cliques numa mensagem.
 *
 * Não é uma mensagem nova: é uma `sender_action` sobre uma mensagem que já existe, identificada
 * pelo `mid` que veio no webhook. Por isso não gera bolha nova na conversa, nem do lado de lá.
 *
 * `emoji: null` desfaz a reação. A Meta aceita só um punhado de emojis aqui; o coração é o único
 * que o CRM manda, que é também o que o duplo clique faz no app.
 */
export async function reagirNoDirectInstagram(
  accessToken: string,
  destinatarioId: string,
  mensagemId: string,
  emoji: string | null,
): Promise<void> {
  const resposta = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      recipient: { id: destinatarioId },
      sender_action: emoji ? "react" : "unreact",
      payload: emoji ? { message_id: mensagemId, reaction: "love" } : { message_id: mensagemId },
    }),
  });
  if (!resposta.ok) {
    const dados = (await resposta.json().catch(() => ({}))) as ErroGraph;
    throw new Error(
      dados.error_message ?? dados.error?.message ?? `Falha ao reagir (HTTP ${resposta.status})`,
    );
  }
}

/** Tipo de anexo aceito pelo Direct. Documento (PDF e afins) entra como `file`. */
export type TipoAnexoInstagram = "image" | "video" | "audio" | "file";

/**
 * Manda um anexo pelo Direct.
 *
 * A API NÃO recebe o arquivo: recebe um endereço e vai buscar o conteúdo ela mesma. Por isso o
 * `url` precisa ser público e alcançável de fora (ver `publicarAnexoTemporario`) — um endereço que
 * exija sessão faz a Meta desistir em silêncio, e a mensagem nunca chega.
 */
export async function enviarAnexoDirectInstagram(
  accessToken: string,
  destinatarioId: string,
  tipo: TipoAnexoInstagram,
  url: string,
): Promise<string | undefined> {
  const resposta = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      recipient: { id: destinatarioId },
      message: { attachment: { type: tipo, payload: { url, is_reusable: false } } },
    }),
  });
  const dados = (await resposta.json()) as { message_id?: string } & ErroGraph;
  if (!resposta.ok) {
    throw new Error(
      dados.error_message ?? dados.error?.message ?? `Falha ao enviar anexo (HTTP ${resposta.status})`,
    );
  }
  return dados.message_id;
}
