import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarAssinaturaWebhook } from "@/lib/integracoes/meta";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { renomearConversa } from "@/lib/conversas/renomear";
import { nomeAindaEhIdCru } from "@/lib/conversas/exibicao";
import { criarContatoPeloInstagramSeNaoExistir, encontrarContatoPorInstagram } from "@/lib/contatos/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead } from "@/lib/funis/upsert";
import { dispararAutomacoesDeMensagemRecebida } from "@/lib/automation-flow/disparar-no-servidor";
import type { ConvMensagem } from "@/lib/data";
import { CANAL_INSTAGRAM, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import { decriptar } from "@/lib/integracoes/crypto";
import {
  baixarFotoPerfil,
  buscarCapaDaMidia,
  buscarPerfilDeQuemMandou,
  buscarPerfilNasConversas,
} from "@/lib/integracoes/instagram-login";

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
    /** Autor e legenda da publicação compartilhada.
     *
     * A Meta não documenta um conjunto fixo aqui e o que vem varia com o tipo do anexo, então o
     * CRM lê TODOS os nomes plausíveis e usa o primeiro que aparecer. Enumerar é feio, mas a
     * alternativa era escolher um nome no escuro e o cartão ficar sem autor pra sempre — sem erro
     * nenhum, porque o campo simplesmente não existiria na resposta. */
    title?: string;
    caption?: string;
    description?: string;
    text?: string;
    username?: string;
    author?: string;
    owner?: { username?: string; name?: string };
    from?: { username?: string; name?: string };
    /** Post/reel compartilhado: link pro conteúdo no Instagram. A Meta nem sempre manda — quando
     * não vem, sobra a prévia sem o clique. */
    permalink_url?: string;
    /** Id da mídia — é por ele que se pede a capa de um story em vídeo (ver `buscarCapaDaMidia`). */
    id?: string;
  };
};

type PayloadInstagram = {
  entry?: {
    /** Id da conta do Instagram dona do evento — é por ele que se sabe se quem reagiu foi a
     * própria conta conectada ou a pessoa do outro lado. */
    id?: string;
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
      /** Curtida (ou descurtida) numa mensagem que já existe — evento próprio, não vem dentro de
       * `message`. `mid` aponta pra mensagem reagida; `action` diz se foi curtir ou desfazer. */
      reaction?: {
        mid?: string;
        action?: "react" | "unreact";
        /** Nome da reação na Meta ("love"). */
        reaction?: string;
        /** O emoji em si ("❤️") — nem sempre vem, por isso o coração é o padrão. */
        emoji?: string;
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
  // Frase inteira, não rótulo entre colchetes: quem atende precisa entender o que aconteceu
  // sem traduzir jargão. "[Menção em story]" não diz que a pessoa apareceu no story de alguém.
  story_mention: "Você foi marcado em um story",
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
  /** `true` para conteúdo que já vive no Instagram (story, reel, post compartilhado): guarda a
   * imagem de prévia — que precisa durar, pra conversa antiga continuar legível — mas nunca o
   * vídeo ou o áudio, que devem ser vistos no Instagram. */
  somenteImagem = false,
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

    // Vídeo de origem do Instagram nem chega a ser trazido — seria baixar megabytes pra descartar
    // logo em seguida, que foi o que ameaçou a memória do servidor.
    if (somenteImagem && !mimeType.startsWith("image/")) return {};

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
      if (somenteImagem) return {};
      return { video: { url: dataUrl, nome: `video.${formato}`, tamanho: bytes.length, comAudio: true } };
    }
    if (mimeType.startsWith("audio/")) {
      if (somenteImagem) return {};
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
      const reacao = evento.reaction;
      // Em mensagem recebida, a conta conectada é o destinatário; num eco (mensagem que ela mesma
      // mandou), é o remetente. Os dois lados invertem. Numa reação vale o mesmo raciocínio: se
      // QUEM reagiu foi a própria conta (curtiu pelo app do Instagram), ela é o `sender`.
      const ehEcoDeReacao = Boolean(reacao) && evento.sender?.id === entry.id;
      const instagramContaId =
        mensagem?.is_echo || ehEcoDeReacao ? evento.sender?.id : evento.recipient?.id;
      if (!instagramContaId || (!mensagem && !reacao)) continue;

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
      // Carimbo do último evento que a Meta entregou — é o que responde, dentro do CRM, a pergunta
      // que hoje só se responde caçando log: "a Meta está mesmo chamando o CRM?". Sem ele, "não
      // chega mensagem" é indistinguível de "chega e o CRM descarta", e as duas causas levam a
      // caminhos opostos.
      await prisma.integracao
        .update({
          where: { workspaceId_provedor: { workspaceId: integracaoDaConta.workspaceId, provedor: "meta_instagram" } },
          data: {
            metadados: {
              ...((integracaoDaConta.metadados as Record<string, unknown> | null) ?? {}),
              ultimoEventoEm: new Date().toISOString(),
            } as object,
          },
        })
        .catch(() => {});

      const receberMensagens = (integracaoDaConta.metadados as { receberMensagens?: boolean } | null)?.receberMensagens ?? true;
      if (!receberMensagens) continue;

      // Curtida numa mensagem que já está na tela. Não vira bolha nova: atualiza a mensagem
      // reagida, do mesmo jeito que o Instagram mostra o coração grudado no balão. Guardamos em
      // lados separados porque cada pessoa da conversa pode reagir à mesma mensagem — o coração da
      // cliente e o meu não se sobrescrevem.
      if (reacao) {
        if (!reacao.mid) continue;
        const alvo = await prisma.mensagemExtra.findUnique({ where: { id: reacao.mid } });
        if (!alvo || alvo.workspaceId !== integracaoDaConta.workspaceId) continue;

        const extrasAtuais = (alvo.extras as Record<string, unknown> | null) ?? {};
        const campo = ehEcoDeReacao ? "reacaoMinha" : "reacaoContato";
        const valor = reacao.action === "unreact" ? undefined : (reacao.emoji ?? "❤️");
        await prisma.mensagemExtra.update({
          where: { id: reacao.mid },
          data: { extras: { ...extrasAtuais, [campo]: valor } as object },
        });
        continue;
      }
      if (!mensagem) continue;

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

      // Conversa que nasceu com o id no lugar do nome (a busca do @ falhou na primeira mensagem)
      // ganha uma nova chance a cada mensagem nova. Sem isso o número ficava pra sempre na lista,
      // e não havia como saber com quem se estava falando.
      const nomeEhNumero = nomeAindaEhIdCru(conversaExistente?.nome);
      let chaveContato = nomeEhNumero ? undefined : conversaExistente?.nome;
      // Foto de perfil junto do @, na mesma busca — sem ela a conversa fica só com as iniciais, e
      // numa caixa de entrada de Direct a foto é o que faz reconhecer quem é.
      let fotoUrl: string | null = null;
      // Busca também quando a conversa já existe mas está SEM foto — antes só a primeira mensagem
      // de cada pessoa buscava, então quem já tinha conversa (criada antes disto existir) nunca
      // ganhava foto e a lista ficava só com iniciais.
      if (!chaveContato || !conversaExistente?.fotoUrl) {
        // Duas vias: a busca direta pelo id e, se ela não trouxer o @, a lista de conversas — que
        // passa por outra permissão. Sem a segunda, a pessoa entrava como "Contato do Instagram",
        // sem @ e sem foto, que é o pior resultado possível pra quem atende.
        let perfil = tokenDaConta ? await buscarPerfilDeQuemMandou(tokenDaConta, remetenteId) : null;
        if (tokenDaConta && !perfil?.username) {
          const pelaConversa = await buscarPerfilNasConversas(tokenDaConta, remetenteId);
          if (pelaConversa?.username) perfil = { ...perfil, ...pelaConversa };
        }
        const resolvido = perfil?.username ? `@${perfil.username}` : perfil?.nome;
        // Resolveu agora o que não tinha resolvido antes: renomeia a conversa que estava com o
        // número e leva o histórico junto, em vez de abrir uma segunda thread da mesma pessoa.
        if (nomeEhNumero && resolvido && conversaExistente?.nome) {
          await renomearConversa(integracaoDaConta.workspaceId, conversaExistente.nome, resolvido).catch((erro) =>
            console.error("[instagram] Falha ao renomear a conversa que estava com o id:", erro),
          );
        }
        chaveContato = chaveContato ?? resolvido ?? conversaExistente?.nome ?? remetenteId;
        fotoUrl = perfil?.fotoUrl ? await baixarFotoPerfil(perfil.fotoUrl) : null;
      }

      const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: mensagem.mid } });
      if (jaExiste) continue;

      // "Levar as conversas do Instagram para o funil" (Configurações > Integrações > Instagram
      // Direct > Gerenciar). Desligado, o Direct fica valendo só como caixa de entrada: a conversa
      // aparece em Conversas normalmente, mas ninguém vira contato nem card — que é o caso de quem
      // recebe muita mensagem que não é lead. Padrão ligado (`?? true`), igual ao WhatsApp: mensagem
      // nova de gente nova é um lead até prova em contrário.
      const entrarNoFunil =
        (integracaoDaConta.metadados as { entrarNoFunil?: boolean } | null)?.entrarNoFunil ?? true;

      let contatoId: string | undefined;
      if (entrarNoFunil) {
        const arroba = chaveContato.replace(/^@/, "");
        const contatoExistente = await encontrarContatoPorInstagram(integracaoDaConta.workspaceId, arroba);
        const contato =
          contatoExistente ??
          (await criarContatoPeloInstagramSeNaoExistir({
            workspaceId: integracaoDaConta.workspaceId,
            nome: chaveContato,
            instagram: arroba,
          }));
        contatoId = contato?.id;

        // Mesma regra do WhatsApp: só quem ACABOU de ser criado entra no funil. Contato que já
        // existia mandar mensagem de novo não pode mexer na etapa em que o vendedor o deixou.
        if (!contatoExistente) {
          await entrarNaPrimeiraEtapaComoNovoLead({
            workspaceId: integracaoDaConta.workspaceId,
            contatoNome: chaveContato,
            origem: "Instagram",
            contaCanal: contaCanalDaConexao(CANAL_INSTAGRAM, instagramContaId),
          });
        }
      }

      const criadoEm = evento.timestamp ? new Date(evento.timestamp) : new Date();

      // Anexo vira mídia de verdade; se o download falhar, sobra o rótulo em texto — melhor uma
      // bolha escrita "[Vídeo]" do que uma bolha em branco, que foi o que acontecia antes.
      const anexo = mensagem.attachments?.[0];
      const story = mensagem.reply_to?.story;

      // Story respondido chega fora de `attachments`, num campo próprio — mesma busca de mídia.
      const anexoEfetivo: AnexoInstagram | null =
        anexo ?? (story?.url ? { type: "image", payload: { url: story.url } } : null);
      // Story respondido, reel e post compartilhado são conteúdo que já vive no Instagram; mídia
      // enviada direto na conversa é da pessoa e fica guardada normalmente.
      const ehConteudoDoInstagram =
        (!anexo && !!story) || anexo?.type === "share" || anexo?.type === "story_mention" || anexo?.type === "ig_reel";

      // A miniatura de conteúdo do Instagram é GUARDADA, não apenas apontada. O link do CDN expira
      // em horas: servir por ele deixava a conversa antiga sem prévia justamente quando ela é mais
      // necessária — reler um atendimento e saber a qual story a cliente respondeu. Guardar uma
      // imagem pequena é o único jeito de a miniatura existir daqui a um mês.
      //
      // O que NÃO é guardado continua não sendo: vídeo e áudio de origem do Instagram. Assistir é
      // lá, que é onde o conteúdo mora.
      let extras = anexoEfetivo
        ? await extrasDeAnexoInstagram(anexoEfetivo, tokenDaConta, ehConteudoDoInstagram)
        : {};

      // Story em VÍDEO não tem miniatura no endereço que o webhook entrega: aquele link é o vídeo
      // em si, e a política aqui é não guardar vídeo do Instagram — então a bolha chegava só com o
      // texto ("Respondeu ao seu story", "Você foi marcado em um story") e sem prévia nenhuma, que
      // é justamente quando a prévia mais importa: saber A QUAL story a pessoa reagiu.
      //
      // A capa é pedida à Meta pelo id da mídia (`thumbnail_url`), que ela já gera. Assim a
      // miniatura existe sem o servidor abrir vídeo nenhum.
      const idDaMidiaDoStory = story?.id ?? (anexo?.type === "story_mention" ? anexo.payload?.id : undefined);
      if (!Object.keys(extras).length && idDaMidiaDoStory && tokenDaConta) {
        const capa = await buscarCapaDaMidia(tokenDaConta, idDaMidiaDoStory);
        if (capa) {
          extras = await extrasDeAnexoInstagram({ type: "image", payload: { url: capa } }, tokenDaConta, true);
        }
      }

      // Só link de post DE VERDADE (permalink) entra no texto. A URL do CDN não vira link: ela é o
      // arquivo, expira, e despejada na bolha só polui a conversa com um endereço gigante.
      const linkDoConteudo = anexo?.payload?.permalink_url;
      // Sem o permalink não existe pra onde mandar quem clica na prévia — e a Meta nem sempre o
      // envia. Registrar quando ele falta é o que separa "o CRM não usou o link" de "o link nunca
      // veio"; sem isso, "clicar não abre a publicação" fica sem causa.
      if (anexo && !linkDoConteudo) {
        // Além de dizer que o link faltou, registra QUAIS campos vieram no anexo. É assim que se
        // descobre se a Meta manda autor e legenda da publicação (pra montar o cartão completo) ou
        // se manda só a imagem — sem isso, seria adivinhar o que existe do outro lado.
        console.log("[instagram] anexo sem permalink_url:", {
          tipoAnexo: anexo.type ?? null,
          camposDoPayload: Object.keys(anexo.payload ?? {}),
        });
      }
      // Link do post compartilhado vai no texto: a tela já transforma URL em link clicável, então
      // clicar leva pro conteúdo no Instagram sem precisar de um tipo de bolha novo. Nem toda
      // mensagem de `share` traz o link — quando não vem, fica só a prévia.

      const temMidiaBaixada = Object.keys(extras).length > 0;

      // Mensagem que TINHA o que virar prévia e não virou. Sem este registro, "chegou só o texto,
      // sem a miniatura" é indistinguível de três coisas bem diferentes: a Meta não mandou o story
      // no evento, mandou e o download foi recusado, ou mandou um tipo que a gente ignora. Só
      // metadado — nunca o conteúdo da mensagem nem o endereço do arquivo (LGPD).
      if (!temMidiaBaixada && (story || anexo)) {
        console.log("[instagram] sem miniatura:", {
          ehEco,
          temStory: Boolean(story),
          storyComUrl: Boolean(story?.url),
          tipoAnexo: anexo?.type ?? null,
          anexoComUrl: Boolean(anexo?.payload?.url),
          ehConteudoDoInstagram,
          temToken: Boolean(tokenDaConta),
        });
      }
      const rotuloPadrao = story && !anexo
        ? "Respondeu ao seu story"
        : anexo
          ? (ROTULO_POR_ANEXO[anexo.type ?? ""] ?? "")
          : "";

      // A legenda vale pra mídia guardada, e a frase do que aconteceu (resposta a story, menção)
      // precisa aparecer JUNTO da miniatura — não só como texto solto numa bolha separada, que era
      // o que acontecia: chegava "Você foi marcado em um story" numa bolha e a imagem noutra, sem
      // ligação visível entre as duas.
      const texto = [mensagem.text ?? rotuloPadrao, linkDoConteudo].filter(Boolean).join("\n") || "";

      // Bolha que não diz nada: anexo de um tipo que o CRM não conhece, sem arquivo baixado e sem
      // texto nenhum. É o que acontece quando alguém manda um número pelo Instagram — o app envia o
      // número como texto E um anexo interativo junto, que aqui virava um "[Anexo]" solto embaixo
      // do número, sem conteúdo pra abrir. Guardar isso só polui a conversa.
      if (!texto && !temMidiaBaixada) {
        console.log("[instagram] anexo sem conteúdo util, descartado:", { tipoAnexo: anexo?.type ?? null });
        continue;
      }

      // Com mídia, a bolha desenha a LEGENDA, não o texto — então uma resposta a story chegava só
      // como a miniatura, sem o que a pessoa escreveu. O texto vai para os dois lugares: `texto`
      // alimenta a prévia na lista de conversas, `legenda` é o que aparece sob a imagem.
      const legenda = temMidiaBaixada
        ? [story ? "Respondeu ao seu story" : rotuloPadrao || null, mensagem.text].filter(Boolean).join(" · ")
        : undefined;
      // O link vai TAMBÉM nos extras, não só no texto: é ele que faz a miniatura virar um clique
      // que abre a publicação no Instagram. Só no texto, a pessoa via a prévia e tinha que caçar o
      // endereço embaixo pra chegar no conteúdo.
      // Pra onde o clique na prévia deve levar.
      //
      // O ideal é a própria publicação (`permalink_url`) — mas a Meta nem sempre manda esse campo,
      // e sem ele o CRM recebeu a imagem sem saber QUAL publicação é: não há como deduzir o
      // endereço a partir da foto.
      //
      // Nesse caso o clique leva pra CONVERSA no Instagram, pelo @ de quem mandou. Não é a
      // publicação exata, mas é um clique e a pessoa está diante do conteúdo — melhor do que abrir
      // um visualizador de zoom, que era o que acontecia e não leva a lugar nenhum.
      // Autor e legenda da publicação, quando a Meta os manda. Sem eles o cartão mostra quem
      // encaminhou, que é o que o CRM sempre sabe.
      const autorPublicacao =
        anexo?.payload?.owner?.username ??
        anexo?.payload?.from?.username ??
        anexo?.payload?.username ??
        anexo?.payload?.author ??
        anexo?.payload?.owner?.name ??
        anexo?.payload?.from?.name;
      const legendaPublicacao =
        anexo?.payload?.caption ?? anexo?.payload?.title ?? anexo?.payload?.description ?? anexo?.payload?.text;

      const arrobaDeQuemMandou = chaveContato.startsWith("@") ? chaveContato.slice(1) : null;

      // O link vale pra QUALQUER mídia recebida pelo Direct, não só pro que a Meta marca como
      // conteúdo compartilhado.
      //
      // Descoberta ao ver uma publicação encaminhada chegar: a Meta entregou como anexo do tipo
      // `image`, igual a uma foto qualquer — sem permalink, sem autor, sem legenda. Ou seja, do
      // lado de cá é impossível distinguir "publicação que a pessoa encaminhou" de "foto que ela
      // tirou", e apostar em `share` deixava justamente o caso real sem botão nenhum.
      //
      // Então: com permalink, o clique abre a publicação exata. Sem ele, abre a conversa no
      // Instagram, onde o conteúdo está logo ali. O rótulo do botão muda junto, pra não prometer
      // uma publicação que o CRM não sabe qual é.
      const linkExternoDaMensagem =
        linkDoConteudo ??
        (temMidiaBaixada && !ehEco && arrobaDeQuemMandou ? `https://ig.me/m/${arrobaDeQuemMandou}` : undefined);

      const extrasComLegenda = {
        ...extras,
        ...(legenda ? { legenda } : {}),
        ...(linkExternoDaMensagem ? { linkExterno: linkExternoDaMensagem } : {}),
        ...(linkExternoDaMensagem && !linkDoConteudo ? { linkEhConversa: true } : {}),
        ...(ehConteudoDoInstagram || autorPublicacao
          ? {
              compartilhadoPor: autorPublicacao ? `@${autorPublicacao.replace(/^@/, "")}` : chaveContato,
              ...(legendaPublicacao ? { legendaPublicacao } : {}),
            }
          : {}),
      };

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
          extras: Object.keys(extrasComLegenda).length ? (extrasComLegenda as object) : undefined,
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
        contatoId,
        fotoUrl,
        // Mensagem que você mesma mandou não é "não lida".
        contarComoNaoLida: !ehEco,
        contaCanal: contaCanalDaConexao(CANAL_INSTAGRAM, instagramContaId),
      });

      // Automação só dispara em mensagem RECEBIDA. Num eco (mensagem que a própria conta mandou,
      // inclusive a resposta automática que acabou de sair daqui) o fluxo dispararia de novo, e a
      // conversa entraria num vai-e-vem sem fim com a pessoa do outro lado.
      if (!ehEco) {
        await dispararAutomacoesDeMensagemRecebida({
          workspaceId: integracaoDaConta.workspaceId,
          contatoNome: chaveContato,
          canal: "Instagram",
          textoRecebido: texto,
        }).catch((erro) => console.error("[instagram] falha ao disparar automações:", erro));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
