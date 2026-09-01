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

export const INSTAGRAM_GRAPH_VERSION = "v21.0";

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
 * `message_reactions` entra junto de `messages`: sem esse campo, a curtida que a cliente dá numa
 * mensagem simplesmente não chega — a Meta manda cada tipo de evento só pra quem assinou aquele
 * campo. Quem conectou antes disto precisa reconectar pra assinatura ser refeita.
 *
 * ATENÇÃO ao nome: é `message_reactions`, no singular em "message". Escrito como
 * `messaging_reactions` (que é o padrão dos OUTROS campos: `messaging_seen`, `messaging_postbacks`)
 * a Meta REJEITA A CHAMADA INTEIRA — não só aquele campo. O resultado é a conta ficar "Conectada"
 * sem assinatura nenhuma, e NENHUMA mensagem chegar. Já aconteceu.
 */
export async function inscreverAppNoInstagram(accessToken: string): Promise<string | null> {
  try {
    const resposta = await fetch(
      // `comments` é o que faz comentário em publicação e resposta a comentário chegarem no webhook.
      // Sem ele o CRM recebia só Direct — e o gatilho "Comentário no Instagram", que já existia no
      // construtor de automações, nunca disparava: a pessoa montava o fluxo e nada acontecia.
      //
      // Os nomes têm que estar exatos: a Meta recusa a chamada INTEIRA se um campo estiver errado,
      // e a conta fica "conectada" sem assinatura nenhuma, sem receber mensagem alguma. Foi o que
      // aconteceu com `messaging_reactions` (o certo é `message_reactions`).
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/subscribed_apps?subscribed_fields=messages,message_reactions,comments`,
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
      // Pede os DOIS nomes de campo da foto. A Meta usa `profile_pic` na API de mensagens e
      // `profile_picture_url` noutros pontos, e a versão que responde varia — pedindo só um, a
      // conversa ficava eternamente sem foto sem nenhum erro, porque o campo simplesmente não
      // vinha. Pedir os dois custa a mesma chamada.
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${remetenteId}?fields=username,name,profile_pic,profile_picture_url&access_token=${accessToken}`,
    );
    const dados = (await resposta.json()) as {
      username?: string;
      name?: string;
      profile_pic?: string;
      profile_picture_url?: string;
    } & ErroGraph;
    if (!resposta.ok) {
      console.error("[instagram] Falha ao buscar o perfil de quem mandou:", dados.error?.message ?? resposta.status);
      return null;
    }
    // A foto vem em `profile_pic` — mas nem toda conta/permissão devolve esse campo, e quando ele
    // falta a conversa fica só com as iniciais sem nenhuma pista do porquê. Registrar quais campos
    // vieram (nunca os valores) é o que permite saber se é ausência de permissão ou outro nome.
    const fotoUrl = dados.profile_pic ?? dados.profile_picture_url;
    if (!fotoUrl) {
      console.log("[instagram] perfil sem foto; campos recebidos:", Object.keys(dados));
    }
    return { username: dados.username, nome: dados.name, fotoUrl };
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

/**
 * Quais campos de webhook a conta está assinando AGORA, direto da Meta.
 *
 * Sem isto, "as mensagens não chegam" é indistinguível de "a assinatura caiu": a tela mostra
 * "Conectado" nos dois casos, e o único jeito de saber era mandar mensagem e esperar. Aqui a
 * resposta vem da fonte — se `messages` não estiver na lista, nada vai chegar mesmo.
 */
export async function camposAssinadosNoInstagram(accessToken: string): Promise<string[] | null> {
  try {
    const resposta = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/subscribed_apps?access_token=${accessToken}`,
    );
    const dados = (await resposta.json()) as {
      data?: { subscribed_fields?: string[] }[];
    } & ErroGraph;
    if (!resposta.ok) {
      console.error("[instagram] Falha ao ler a assinatura:", dados.error?.message ?? resposta.status);
      return null;
    }
    return dados.data?.[0]?.subscribed_fields ?? [];
  } catch (erro) {
    console.error("[instagram] Falha ao ler a assinatura:", erro);
    return null;
  }
}

/**
 * Segunda tentativa de descobrir o @ de alguém: pela lista de conversas da conta.
 *
 * A busca direta pelo id (`buscarPerfilDeQuemMandou`) é a via principal, mas ela depende de uma
 * permissão que nem toda conta concede — e quando falha, a pessoa entra na caixa de entrada como
 * "Contato do Instagram", sem @ e sem foto, que é o pior resultado possível pra quem atende.
 *
 * A lista de conversas devolve os participantes de cada thread com `username`, por outro caminho de
 * permissão. Custa uma chamada a mais e só roda quando a primeira não trouxe nada.
 */
export async function buscarPerfilNasConversas(
  accessToken: string,
  remetenteId: string,
): Promise<{ username?: string; nome?: string; fotoUrl?: string } | null> {
  try {
    const resposta = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/conversations?fields=participants&access_token=${accessToken}`,
    );
    const dados = (await resposta.json()) as {
      data?: { participants?: { data?: { id?: string; username?: string; name?: string; profile_pic?: string }[] } }[];
    } & ErroGraph;
    if (!resposta.ok) {
      console.error("[instagram] Falha ao listar conversas pra achar o @:", dados.error?.message ?? resposta.status);
      return null;
    }
    for (const conversa of dados.data ?? []) {
      const participante = conversa.participants?.data?.find((p) => p.id === remetenteId);
      if (participante?.username || participante?.name) {
        return { username: participante.username, nome: participante.name, fotoUrl: participante.profile_pic };
      }
    }
    console.log("[instagram] o @ não veio nem pela lista de conversas.");
    return null;
  } catch (erro) {
    console.error("[instagram] Falha ao listar conversas pra achar o @:", erro);
    return null;
  }
}

/**
 * Endereço da CAPA de uma mídia do Instagram, a partir do id dela.
 *
 * Resolve a miniatura de story em vídeo sem processar vídeo nenhum: a Meta já gera a capa e a
 * entrega em `thumbnail_url`. A alternativa era baixar o vídeo inteiro no servidor e extrair o
 * primeiro quadro — pesado, e num container pequeno é o tipo de coisa que derruba o processo sem
 * deixar erro no log.
 *
 * Só faz sentido pra vídeo: em foto a Meta não devolve `thumbnail_url`, e `media_url` já é a
 * imagem. Devolve `null` em qualquer falha — a mensagem continua chegando, só sem prévia.
 */
export async function buscarCapaDaMidia(accessToken: string, midiaId: string): Promise<string | null> {
  try {
    const resposta = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${midiaId}?fields=thumbnail_url,media_url,media_type&access_token=${accessToken}`,
    );
    const dados = (await resposta.json()) as {
      thumbnail_url?: string;
      media_url?: string;
      media_type?: string;
    } & ErroGraph;
    if (!resposta.ok) {
      console.error("[instagram] Falha ao buscar a capa da mídia:", dados.error?.message ?? resposta.status);
      return null;
    }
    // `media_url` só entra quando NÃO é vídeo: em vídeo ela é o arquivo, e guardar isso como
    // "miniatura" traria de volta o problema que a capa veio resolver.
    if (dados.thumbnail_url) return dados.thumbnail_url;
    return dados.media_type === "VIDEO" ? null : (dados.media_url ?? null);
  } catch (erro) {
    console.error("[instagram] Falha ao buscar a capa da mídia:", erro);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Comentários                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Responde a um comentário na própria publicação.
 *
 * Exige o escopo `instagram_business_manage_comments`, que já é pedido no login. Vale a ressalva
 * comercial: pra contas de TERCEIROS (seus clientes), esse escopo só funciona depois da revisão do
 * app pela Meta — em desenvolvimento ele funciona só pra quem tem papel no app.
 */
export async function responderComentarioInstagram(
  accessToken: string,
  comentarioId: string,
  mensagem: string,
): Promise<string | undefined> {
  const resposta = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${comentarioId}/replies`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ message: mensagem }),
    },
  );
  const dados = (await resposta.json()) as { id?: string } & ErroGraph;
  if (!resposta.ok) {
    throw new Error(dados.error_message ?? dados.error?.message ?? `Falha ao responder comentário (HTTP ${resposta.status})`);
  }
  return dados.id;
}

/** Oculta ou reexibe um comentário. Útil pra moderação automática de spam. */
export async function ocultarComentarioInstagram(
  accessToken: string,
  comentarioId: string,
  ocultar: boolean,
): Promise<void> {
  const resposta = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${comentarioId}?hide=${ocultar}`,
    { method: "POST", headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!resposta.ok) {
    const dados = (await resposta.json().catch(() => ({}))) as ErroGraph;
    throw new Error(dados.error_message ?? dados.error?.message ?? `HTTP ${resposta.status}`);
  }
}

export type PublicacaoInstagram = {
  id: string;
  tipo: string;
  legenda: string;
  miniatura: string | null;
  permalink: string | null;
  publicadoEm: string | null;
};

/**
 * Publicações da conta conectada — pra escolher em qual delas uma automação de comentário vale.
 *
 * `thumbnail_url` só existe em vídeo/reel; em imagem e carrossel a capa é a própria `media_url`.
 * Por isso os dois campos são pedidos e o primeiro que existir é usado.
 */
export async function listarPublicacoesInstagram(
  accessToken: string,
  limite = 25,
): Promise<PublicacaoInstagram[]> {
  const campos = "id,media_type,caption,media_url,thumbnail_url,permalink,timestamp";
  const resposta = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/media?fields=${campos}&limit=${limite}`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  const dados = (await resposta.json()) as {
    data?: {
      id: string;
      media_type?: string;
      caption?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp?: string;
    }[];
  } & ErroGraph;
  if (!resposta.ok) {
    throw new Error(dados.error_message ?? dados.error?.message ?? `HTTP ${resposta.status}`);
  }
  return (dados.data ?? []).map((item) => ({
    id: item.id,
    tipo: item.media_type ?? "IMAGE",
    legenda: item.caption ?? "",
    miniatura: item.thumbnail_url ?? item.media_url ?? null,
    permalink: item.permalink ?? null,
    publicadoEm: item.timestamp ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Erros da Meta                                                              */
/* -------------------------------------------------------------------------- */

export type MotivoFalhaMeta =
  | "limite_de_chamadas"
  | "token_expirado"
  | "permissao_removida"
  | "fora_da_janela"
  | "conteudo_indisponivel"
  | "temporario"
  | "desconhecido";

/**
 * Classifica a falha da Meta em algo sobre o que dá pra decidir.
 *
 * A mensagem crua dela é técnica e em inglês, e o código sozinho não diz se vale tentar de novo.
 * Sem essa separação, "excedeu o limite de chamadas" (espere e repita) e "token expirado"
 * (reconecte a conta) chegavam na tela como o mesmo "erro ao enviar", e ninguém sabia o que fazer.
 */
export function classificarErroMeta(mensagem: string): { motivo: MotivoFalhaMeta; explicacao: string } {
  const texto = mensagem.toLowerCase();

  if (texto.includes("rate limit") || texto.includes("too many") || texto.includes("#4") || texto.includes("#613")) {
    return {
      motivo: "limite_de_chamadas",
      explicacao: "O Instagram limitou temporariamente as chamadas. Vai voltar sozinho em alguns minutos.",
    };
  }
  if (texto.includes("expired") || texto.includes("session has been invalidated") || texto.includes("#190")) {
    return {
      motivo: "token_expirado",
      explicacao: "A conexão com o Instagram expirou. Reconecte a conta em Integrações.",
    };
  }
  if (texto.includes("permission") || texto.includes("#200") || texto.includes("#10")) {
    return {
      motivo: "permissao_removida",
      explicacao: "Falta permissão nessa conta do Instagram. Reconecte aceitando todos os acessos pedidos.",
    };
  }
  if (texto.includes("outside") && texto.includes("window")) {
    return {
      motivo: "fora_da_janela",
      explicacao: "Passaram-se mais de 24h desde a última mensagem da pessoa — o Instagram não deixa mais responder.",
    };
  }
  if (texto.includes("does not exist") || texto.includes("deleted") || texto.includes("unavailable")) {
    return {
      motivo: "conteudo_indisponivel",
      explicacao: "O conteúdo foi apagado ou não está mais acessível no Instagram.",
    };
  }
  if (texto.includes("temporarily") || texto.includes("try again") || texto.includes("#2")) {
    return { motivo: "temporario", explicacao: "Instabilidade momentânea do Instagram. Tente de novo em instantes." };
  }
  return { motivo: "desconhecido", explicacao: mensagem };
}
