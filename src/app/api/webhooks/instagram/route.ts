import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarAssinaturaWebhook } from "@/lib/integracoes/meta";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import type { ConvMensagem } from "@/lib/data";
import { CANAL_INSTAGRAM, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import { decriptar } from "@/lib/integracoes/crypto";
import { baixarFotoPerfil, buscarPerfilDeQuemMandou } from "@/lib/integracoes/instagram-login";

/**
 * GET — handshake de verificação que a Meta faz uma vez, ao cadastrar a URL do webhook no painel
 * do App. Mesmo `META_WEBHOOK_VERIFY_TOKEN` do webhook do WhatsApp — a Meta permite um token só,
 * compartilhado entre os campos de assinatura de um mesmo App.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // `.trim()` nos dois lados: valor colado num painel de hospedagem costuma carregar espaço ou
  // quebra de linha no fim, invisível na tela, e isso fazia a comparação falhar com dois valores
  // que pareciam idênticos — sintoma que custou várias rodadas pra identificar.
  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (modo === "subscribe" && token?.trim() === esperado && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  // Diagnóstico do que exatamente falhou. Sem isso, "Verificação inválida" cobre três causas bem
  // diferentes — variável ausente no servidor, valor diferente, ou chamada malformada — e não há
  // como distinguir de fora. Nada aqui revela o valor esperado: só se ele existe e se o recebido
  // bate, que é o que a pessoa cadastrando o webhook precisa saber.
  return NextResponse.json(
    {
      erro: "Verificação inválida",
      tokenConfiguradoNoServidor: Boolean(esperado),
      tokenRecebido: Boolean(token),
      tokensIguais: Boolean(esperado) && token?.trim() === esperado,
      modoRecebido: modo,
    },
    { status: 403 },
  );
}

type AnexoInstagram = {
  type?: string;
  payload?: {
    url?: string;
    title?: string;
    /** Post/reel compartilhado: link pro conteúdo no Instagram. A Meta nem sempre manda — quando
     * não vem, sobra a prévia sem o clique. */
    permalink_url?: string;
  };
};

type PayloadInstagram = {
  entry?: {
    messaging?: {
      sender?: { id: string };
      recipient?: { id: string };
      timestamp?: number;
      message?: {
        mid: string;
        text?: string;
        /** Foto, vídeo, áudio, arquivo, story compartilhado. Sem tratar isto, a mensagem entrava
         * com texto vazio e a bolha aparecia em branco na tela. */
        attachments?: AnexoInstagram[];
        /** Resposta a um story: vem FORA de `attachments`, num campo próprio. Sem tratar isto, a
         * mensagem chegava só com o texto — sem a miniatura do story que a pessoa respondeu, que é
         * justamente o que dá contexto ("ela respondeu ao story de qual post?"). */
        reply_to?: { story?: { url?: string; id?: string } };
        /** `true` quando a mensagem foi enviada PELA conta conectada — inclusive de fora do CRM,
         * respondendo pelo app do Instagram. É o que permite o histórico ficar completo. */
        is_echo?: boolean;
      };
    }[];
  }[];
};

/** Rótulo em texto de cada tipo de anexo — é o que aparece na lista de conversas e o que sobra
 * quando o download do arquivo falha. */
const ROTULO_POR_ANEXO: Record<string, string> = {
  image: "[Imagem]",
  video: "[Vídeo]",
  audio: "[Áudio]",
  file: "[Arquivo]",
  share: "[Publicação compartilhada]",
  story_mention: "[Menção em story]",
};

/**
 * Teto do anexo guardado embutido (data URL). Acima disso fica só o rótulo — melhor uma bolha que
 * diz "[Vídeo]" do que derrubar o servidor.
 *
 * O arquivo é baixado INTEIRO para a memória e convertido para base64, o que infla ~33%: com 12 MB
 * (o valor anterior) uma única mensagem podia passar de 16 MB só nessa conversão, e num container
 * pequeno isso mata o processo sem deixar erro no log. 4 MB cobre foto, prévia de reel e vídeo
 * curto — que é o que chega por Direct — com folga confortável.
 */
const TAMANHO_MAX_ANEXO = 4 * 1024 * 1024;

/**
 * Baixa o anexo e devolve nos mesmos campos que o resto do CRM já usa pra mídia. A URL que o
 * Instagram manda é temporária (expira em horas), então guardar só o link deixaria a conversa
 * quebrada no dia seguinte — por isso o arquivo é embutido, igual o webhook do WhatsApp faz.
 */
async function extrasDeAnexoInstagram(
  anexo: AnexoInstagram,
  accessToken: string | null,
): Promise<Partial<ConvMensagem>> {
  const url = anexo.payload?.url;
  if (!url) return {};
  try {
    // O CDN de mídia do Instagram (`lookaside.fbsbx.com/ig_messaging_cdn/...`) EXIGE o token: sem
    // ele a resposta é uma página HTML de erro com status 200 — foi o que virou aqueles cards
    // "html · 669 KB" e o que fez a miniatura nunca aparecer.
    const resposta = await fetch(url, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    });
    if (!resposta.ok) {
      console.log("[webhook instagram] anexo recusado pelo CDN:", resposta.status);
      return {};
    }
    const tamanho = Number(resposta.headers.get("content-length") ?? 0);
    if (tamanho > TAMANHO_MAX_ANEXO) return {};

    // A URL do Instagram nem sempre entrega o arquivo: quando ela exige sessão, volta uma PÁGINA
    // HTML (de login ou de erro) com status 200. Sem esta checagem isso virava um "documento" de
    // centenas de KB grudado na mensagem — um card de download inútil no lugar da prévia.
    const mimeType = resposta.headers.get("content-type") ?? "application/octet-stream";
    if (!/^(image|video|audio)\//.test(mimeType)) {
      console.log("[webhook instagram] anexo nao veio como midia; content-type:", mimeType);
      return {};
    }

    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length > TAMANHO_MAX_ANEXO) return {};
    const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
    const formato = mimeType.split("/")[1] ?? "arquivo";

    // Decide pelo CONTEÚDO, não pelo nome do tipo que a Meta declara. Os nomes variam mais do que
    // a documentação sugere (`share`, `ig_reel`, `story_mention`, `template`...), e um tipo
    // desconhecido caía no ramo genérico e virava card de download — foi assim que um reel com
    // prévia em JPEG apareceu como "jpeg · 617 KB" em vez de miniatura. O mimeType do arquivo
    // baixado não tem essa ambiguidade.
    if (mimeType.startsWith("image/")) {
      return { imagens: [{ url: dataUrl, nome: `imagem.${formato}`, tamanho: bytes.length }] };
    }
    if (mimeType.startsWith("video/")) {
      return { video: { url: dataUrl, nome: `video.${formato}`, tamanho: bytes.length, comAudio: true } };
    }
    if (mimeType.startsWith("audio/")) {
      return { audio: { url: dataUrl, duracao: 0, waveform: [] } };
    }
    return {};
  } catch (erro) {
    console.error("[webhook instagram] Falha ao baixar anexo:", erro);
    return {};
  }
}

/**
 * POST recebe mensagem direta recebida — sem `auth()` de propósito (quem chama é a Meta). Valida a
 * assinatura HMAC do corpo cru (`X-Hub-Signature-256`) igual o webhook do WhatsApp.
 *
 * Payload no formato Messenger Platform (diferente do WhatsApp): `entry[].messaging[]` em vez de
 * `entry[].changes[].value`. `recipient.id` é o id da própria conta do Instagram recebendo a
 * mensagem — é contra ele que resolvemos o workspace dono da integração.
 *
 * Limitações conhecidas desta fase: só mensagem direta (comentário tem outro formato de payload,
 * fica pra quando a automação de "receber comentário" do InstagramSecao for ligada de verdade).
 * Também não existe ainda um campo `Contato.instagram` pra casar com um contato já existente (o
 * WhatsApp tem `Contato.whatsapp`) — a mensagem sempre usa o `sender.id` como chave da conversa.
 */
export async function POST(request: Request) {
  const payloadCru = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256");
  // Segredo do app do Instagram, não o do app principal — ver `validarAssinaturaWebhook`. Cai no
  // principal se não estiver configurado (quem usa um app só pros dois).
  const segredo = process.env.META_INSTAGRAM_APP_SECRET;
  if (!validarAssinaturaWebhook(payloadCru, assinatura, segredo)) {
    // Sem este log a falha é indistinguível de "a Meta nunca chamou": as duas dão em nenhuma
    // mensagem na tela.
    console.error(
      "[webhook instagram] assinatura invalida — chamada recebida e descartada.",
      segredo
        ? "Confira se META_INSTAGRAM_APP_SECRET e o secret do app do Instagram."
        : "META_INSTAGRAM_APP_SECRET nao esta definida; tentou validar com META_APP_SECRET.",
    );
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 401 });
  }
  console.log("[webhook instagram] chamada valida recebida da Meta.");

  const payload = JSON.parse(payloadCru) as PayloadInstagram;

  for (const entry of payload.entry ?? []) {
    for (const evento of entry.messaging ?? []) {
      const mensagem = evento.message;
      // Em mensagem recebida, a conta conectada é o destinatário; num eco (mensagem que ela mesma
      // mandou), é o remetente. Os dois lados invertem.
      const instagramContaId = mensagem?.is_echo ? evento.sender?.id : evento.recipient?.id;
      if (!instagramContaId || !mensagem) continue;

      // `metadados` é Json — não dá pra filtrar direto no `where` de forma portável, filtra em
      // memória (poucas integrações ativas, custo desprezível), mesmo padrão do webhook do WhatsApp.
      const todasConectadas = await prisma.integracao.findMany({
        where: { provedor: "meta_instagram", status: "conectado" },
      });
      const integracaoDaConta = todasConectadas.find(
        (i) => (i.metadados as { instagramContaId?: string } | null)?.instagramContaId === instagramContaId,
      );
      if (!integracaoDaConta) continue;

      // "Receber mensagens do Instagram no CRM" (Configurações > Integrações > Instagram e
      // Facebook) — desligado não desconecta a conta, só para de trazer mensagem nova pra
      // Conversas. Padrão ligado (`?? true`) pra não mudar o comportamento de quem já tinha a
      // conta conectada antes desse toggle existir.
      const receberMensagens = (integracaoDaConta.metadados as { receberMensagens?: boolean } | null)?.receberMensagens ?? true;
      if (!receberMensagens) continue;

      // Eco: mensagem que a PRÓPRIA conta conectada enviou, inclusive respondendo pelo app do
      // Instagram em vez do CRM. Aí quem interessa é o destinatário, não o remetente — senão a
      // conversa seria arquivada sob o id da própria conta. Sem tratar isto, o histórico ficava
      // pela metade: só o que a outra pessoa escreveu.
      const ehEco = mensagem.is_echo === true;
      const remetenteId = ehEco ? evento.recipient?.id : evento.sender?.id;
      if (!remetenteId) continue;

      // O Direct entrega só um id interno de quem mandou. A conversa é achada por ele (estável),
      // mas EXIBIDA pelo @ — senão a lista de Conversas vira uma coluna de números e não dá pra
      // saber com quem se está falando.
      //
      // A busca do @ só acontece na PRIMEIRA mensagem de cada pessoa: existindo conversa pra esse
      // id, reaproveita o nome já resolvido. Sem isso seria uma chamada à API da Meta por mensagem
      // recebida, à toa.
      const conversaExistente = await prisma.conversa.findFirst({
        where: { workspaceId: integracaoDaConta.workspaceId, contato: remetenteId, canal: "Instagram" },
        select: { nome: true, fotoUrl: true },
      });

      const tokenDaConta = integracaoDaConta.accessTokenCriptografado
        ? decriptar(integracaoDaConta.accessTokenCriptografado)
        : null;

      let chaveContato = conversaExistente?.nome;
      // Foto de perfil junto do @, na mesma busca — sem ela a conversa fica só com as iniciais, e
      // numa caixa de entrada de Direct a foto é o que faz reconhecer quem é.
      let fotoUrl: string | null = null;
      // Busca também quando a conversa já existe mas está SEM foto — antes só a primeira mensagem
      // de cada pessoa buscava, então quem já tinha conversa (criada antes disto existir) nunca
      // ganhava foto e a lista ficava só com iniciais.
      if (!chaveContato || !conversaExistente?.fotoUrl) {
        const perfil = tokenDaConta ? await buscarPerfilDeQuemMandou(tokenDaConta, remetenteId) : null;
        chaveContato = chaveContato ?? (perfil?.username ? `@${perfil.username}` : (perfil?.nome ?? remetenteId));
        fotoUrl = perfil?.fotoUrl ? await baixarFotoPerfil(perfil.fotoUrl) : null;
      }

      const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: mensagem.mid } });
      if (jaExiste) continue;

      const criadoEm = evento.timestamp ? new Date(evento.timestamp) : new Date();

      // Anexo vira mídia de verdade; se o download falhar, sobra o rótulo em texto — melhor uma
      // bolha escrita "[Vídeo]" do que uma bolha em branco, que foi o que acontecia antes.
      const anexo = mensagem.attachments?.[0];
      const story = mensagem.reply_to?.story;

      // Story respondido chega fora de `attachments`, num campo próprio — mesma busca de mídia.
      const anexoEfetivo: AnexoInstagram | null =
        anexo ?? (story?.url ? { type: "image", payload: { url: story.url } } : null);
      const extras = anexoEfetivo ? await extrasDeAnexoInstagram(anexoEfetivo, tokenDaConta) : {};

      // Só link de post DE VERDADE (permalink) entra no texto. A URL do CDN não vira link: ela é o
      // arquivo, expira, e despejada na bolha só polui a conversa com um endereço gigante.
      const linkDoConteudo = anexo?.payload?.permalink_url;
      // Link do post compartilhado vai no texto: a tela já transforma URL em link clicável, então
      // clicar leva pro conteúdo no Instagram sem precisar de um tipo de bolha novo. Nem toda
      // mensagem de `share` traz o link — quando não vem, fica só a prévia.

      const temMidiaBaixada = Object.keys(extras).length > 0;
      const rotuloPadrao = story && !anexo
        ? "Respondeu ao seu story"
        : anexo
          ? (ROTULO_POR_ANEXO[anexo.type ?? ""] ?? "[Anexo]")
          : "";
      const texto = [mensagem.text ?? rotuloPadrao, linkDoConteudo].filter(Boolean).join("\n") || "";

      // Com mídia, a bolha desenha a LEGENDA, não o texto — então uma resposta a story chegava só
      // como a miniatura, sem o que a pessoa escreveu. O texto vai para os dois lugares: `texto`
      // alimenta a prévia na lista de conversas, `legenda` é o que aparece sob a imagem.
      const legenda = temMidiaBaixada
        ? [story ? "Respondeu ao seu story" : null, mensagem.text].filter(Boolean).join(" · ")
        : undefined;
      const extrasComLegenda = legenda ? { ...extras, legenda } : extras;

      await prisma.mensagemExtra.create({
        data: {
          id: mensagem.mid,
          workspaceId: integracaoDaConta.workspaceId,
          contato: chaveContato,
          tipo: ehEco ? "out" : "in",
          texto,
          // `timeZone` explícito — sem isso, roda no fuso do servidor (UTC na Vercel), 3h
          // adiantado do horário de Brasília.
          hora: criadoEm.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          }),
          criadoEm,
          canal: CANAL_INSTAGRAM,
          contaCanal: contaCanalDaConexao(CANAL_INSTAGRAM, instagramContaId),
          extras: temMidiaBaixada ? (extrasComLegenda as object) : undefined,
        },
      });

      await upsertConversaAoReceberMensagem({
        workspaceId: integracaoDaConta.workspaceId,
        nome: chaveContato,
        canal: "Instagram",
        // `contato` guarda o id interno do remetente — é a chave estável da thread, do mesmo jeito
        // que o JID identifica um grupo de WhatsApp. `nome` (acima) é só o rótulo de exibição, e
        // pode mudar se a pessoa trocar de @.
        contato: remetenteId,
        origem: "Instagram",
        fotoUrl,
        // Mensagem que você mesma mandou não é "não lida".
        contarComoNaoLida: !ehEco,
        contaCanal: contaCanalDaConexao(CANAL_INSTAGRAM, instagramContaId),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
