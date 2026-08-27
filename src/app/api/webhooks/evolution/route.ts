import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarTokenWebhook, workspaceIdDaInstancia, buscarNumeroConectado, buscarInfoGrupo, buscarFotoPerfil } from "@/lib/integracoes/evolution";
import { criarContatoPeloWhatsAppSeNaoExistir, encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead } from "@/lib/funis/upsert";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { CANAL_NAO_OFICIAL, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import { iniciarHistoricoSeNecessario } from "@/lib/integracoes/historico-whatsapp";

/** Formato de evento que a Evolution API manda pro webhook configurado na instância — mesmo body
 * pra todo tipo de evento, o que muda é `event` e o formato de `data`. */
type PayloadEvolution = {
  event: string;
  instance: string;
  data: Record<string, unknown>;
};

/** Mantém `historico` (progresso da sincronização sob demanda, ver `historico-whatsapp.ts`) intacto
 * — sem isso, toda troca de status (QR renovado, reconexão) apagaria o progresso já feito, porque
 * `metadados` é uma coluna Json substituída inteira, não mesclada campo a campo pelo Prisma. */
async function atualizarStatus(
  workspaceId: string,
  status: "aguardando_qr" | "conectado" | "desconectado",
  extra: { qrDataUrl?: string | null; numero?: string | null } = {},
) {
  const atual = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { metadados: true },
  });
  const metadadosAtuais = (atual?.metadados as Record<string, unknown>) ?? {};
  const metadados = { ...metadadosAtuais, qrDataUrl: extra.qrDataUrl ?? null, numero: extra.numero ?? null };

  await prisma.integracao.upsert({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    create: {
      id: `${workspaceId}-whatsapp_nao_oficial`,
      workspaceId,
      provedor: "whatsapp_nao_oficial",
      status,
      metadados,
    },
    update: { status, metadados, erroMensagem: null },
  });
}

/**
 * Recebe eventos da Evolution API (servidor próprio de WhatsApp via Baileys, ver
 * src/lib/integracoes/evolution.ts) — autenticado por um token fixo na query string (não header
 * customizado, porque nem toda versão da Evolution permite configurar headers extra no webhook).
 */
/** Teto de tamanho do corpo do webhook — o CRM só lê texto, nunca mídia (ver comentário sobre
 * `base64: false` em `configurarWebhook()`), então um payload legítimo é sempre pequeno (poucos
 * KB). Um payload gigante só acontece se a Evolution mandar mídia embutida mesmo assim (bug dela
 * ou config divergente) — rejeitar antes de `request.json()` evita que o processo do Node inteiro
 * trave/estoure memória tentando parsear um JSON de vários MB (bug real que já derrubou o
 * servidor inteiro, não só essa rota). */
const TAMANHO_MAXIMO_PAYLOAD_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!validarTokenWebhook(token)) {
    return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
  }

  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > TAMANHO_MAXIMO_PAYLOAD_BYTES) {
    console.log(`[webhook evolution] payload de ${tamanho} bytes rejeitado (provavelmente mídia embutida, não deveria vir mais)`);
    return NextResponse.json({ ok: true });
  }

  const payload = (await request.json()) as PayloadEvolution;
  const workspaceId = workspaceIdDaInstancia(payload.instance ?? "");
  if (!workspaceId) return NextResponse.json({ ok: true }); // instância de outro uso do mesmo servidor Evolution

  const evento = payload.event?.toLowerCase().replace(/_/g, ".");

  if (evento === "qrcode.updated") {
    const qrDataUrl =
      (payload.data?.qrcode as { base64?: string } | undefined)?.base64 ??
      (payload.data?.base64 as string | undefined) ??
      null;
    await atualizarStatus(workspaceId, "aguardando_qr", { qrDataUrl });
    return NextResponse.json({ ok: true });
  }

  if (evento === "connection.update") {
    const estado = payload.data?.state as string | undefined;
    if (estado === "open") {
      const numero = await buscarNumeroConectado(workspaceId).catch(() => null);
      await atualizarStatus(workspaceId, "conectado", { numero });
      // Só a PRIMEIRA vez que esse workspace conecta — reconexão (celular caiu e voltou) não deve
      // reprocessar o histórico inteiro de novo, só as mensagens novas (via `messages.upsert` normal).
      await iniciarHistoricoSeNecessario(workspaceId).catch((erro) =>
        console.error("[webhook evolution] Falha ao iniciar sincronização de histórico:", erro),
      );
    } else if (estado === "close") {
      await atualizarStatus(workspaceId, "desconectado");
    }
    return NextResponse.json({ ok: true });
  }

  if (evento === "messages.upsert") {
    // A Evolution normalmente manda uma mensagem só, já achatada, direto em `data` — mas
    // dependendo da versão/config ela pode repassar o formato bruto do Baileys
    // (`{ messages: [...], type: "notify" | "append" | ... }`). Trata os dois pra não descartar
    // tudo silenciosamente se vier no formato que a gente não esperava. `type` diferente de
    // "notify" (quando presente) é sincronização de histórico ao conectar, não mensagem ao vivo —
    // nem entra na função de processar (ver guarda de idade da mensagem lá dentro pro caso desse
    // campo não vir, que foi o que floodou o banco na primeira conexão: a Evolution manda TODO o
    // histórico do celular pelo mesmo evento, sem marcar `type` de jeito nenhum).
    const bruto = payload.data as { messages?: unknown[]; type?: string };
    if (bruto?.type && bruto.type !== "notify") return NextResponse.json({ ok: true });
    const mensagens = Array.isArray(bruto?.messages) ? bruto.messages : [payload.data];
    // Trava de segurança: mensagem ao vivo chega uma de cada vez (ou em rajadas bem pequenas) —
    // um lote grande num evento só só acontece em sincronização de histórico (o `syncFullHistory`
    // desligado na instância já devia impedir isso, mas essa é a última linha de defesa caso o
    // servidor Evolution não honre essa configuração). Loga e descarta o lote inteiro, sem tentar
    // processar nada dele.
    if (mensagens.length > 20) {
      console.log(`[webhook evolution] lote de ${mensagens.length} mensagens descartado (parece sincronização de histórico, não mensagem ao vivo)`);
      return NextResponse.json({ ok: true });
    }
    for (const item of mensagens) {
      await processarMensagemRecebida(workspaceId, item);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true }); // evento que não precisamos tratar (ex.: presence.update)
}

/** Mensagem mandada/recebida há mais que isso é sincronização de histórico (conexão inicial ou
 * reconexão trazendo o backlog inteiro do celular), não mensagem ao vivo — não deve virar
 * conversa/lead novo no CRM. Único jeito confiável de filtrar isso, já que a Evolution nem sempre
 * marca `type` no evento (ver acima): comparar o timestamp da própria mensagem com agora. Ignorado
 * quando `permitirHistorico` é `true` (chamado pela sincronização de histórico sob demanda, ver
 * `POST .../sincronizar-historico` — lá o objetivo É trazer mensagem antiga). */
const IDADE_MAXIMA_MENSAGEM_AO_VIVO_MS = 2 * 60 * 1000;

export async function processarMensagemRecebida(
  workspaceId: string,
  item: unknown,
  opcoes: { permitirHistorico?: boolean } = {},
) {
  const data = item as {
    key?: { id?: string; remoteJid?: string; fromMe?: boolean; participant?: string };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: unknown;
      imageMessage?: { caption?: string };
      videoMessage?: { caption?: string };
      documentMessage?: { caption?: string; fileName?: string };
      stickerMessage?: unknown;
    };
    messageTimestamp?: number;
    pushName?: string;
  };

  const fromMe = data.key?.fromMe === true;
  // Mídia sem legenda não tem "texto" nenhum no sentido normal — mas precisa aparecer na conversa
  // mesmo assim (era isso que fazia áudio/imagem recebido sumir sem deixar rastro: caía direto no
  // "sem texto reconhecível" e era descartado). O conteúdo real do arquivo não vem no payload
  // (mídia embutida em base64 foi desligada de propósito — ver `configurarWebhook`), então por
  // enquanto só o AVISO de que chegou mídia aparece na tela, sem o áudio/imagem em si tocável
  // dentro do CRM; ainda dá pra abrir e ouvir/ver no próprio celular.
  const texto =
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    (data.message?.audioMessage ? "🎤 Mensagem de voz" : undefined) ??
    (data.message?.imageMessage ? (data.message.imageMessage.caption || "📷 Foto (veja no celular conectado)") : undefined) ??
    (data.message?.videoMessage ? (data.message.videoMessage.caption || "🎬 Vídeo (veja no celular conectado)") : undefined) ??
    (data.message?.documentMessage
      ? (data.message.documentMessage.caption ?? `📄 Documento: ${data.message.documentMessage.fileName ?? "arquivo"}`)
      : undefined) ??
    (data.message?.stickerMessage ? "🩶 Figurinha (veja no celular conectado)" : undefined);
  const remoteJid = data.key?.remoteJid;
  // Grupo de WhatsApp — a Evolution/Baileys segue a convenção do próprio WhatsApp: `remoteJid`
  // termina em "@g.us" pra grupo (e é o JID do GRUPO, o mesmo pra qualquer participante que
  // escreva nele) contra "@s.whatsapp.net" pra conversa individual (aí sim é a outra pessoa).
  const ehGrupo = remoteJid?.endsWith("@g.us") ?? false;
  // Em grupo, `remoteJid` (acima) já identifica a thread — `waId` aqui não é telefone de ninguém,
  // é só o id numérico do grupo, usado como último recurso se a Evolution não devolver o nome dele.
  const waId = remoteJid?.split("@")[0];
  if (!texto || !waId || !data.key?.id) {
    // Log temporário pra depurar formato de payload em produção (ex.: mídia sem legenda, ou um
    // formato de evento diferente do esperado) — sem isso não dá pra ver pelos logs da Vercel por
    // que uma mensagem específica não apareceu no CRM.
    console.log("[webhook evolution] messages.upsert sem texto/waId/id reconhecível:", JSON.stringify(data).slice(0, 500));
    return;
  }

  const timestampMs = (data.messageTimestamp ?? Math.floor(Date.now() / 1000)) * 1000;
  if (!opcoes.permitirHistorico && Date.now() - timestampMs > IDADE_MAXIMA_MENSAGEM_AO_VIVO_MS) return;

  const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: data.key.id } });
  if (jaExiste) return;

  let chaveContato: string;
  let contatoExistente: { id: string; nome: string } | null = null;
  let participantesGrupo: { nome: string; telefone: string }[] | undefined;
  let descricaoGrupo: string | null | undefined;
  let criacaoGrupo: Date | null | undefined;
  let fotoUrlExistente: string | null = null;

  if (ehGrupo) {
    // Acha a conversa do grupo pelo JID (estável) — nunca pelo nome (`nome` guarda o "assunto" do
    // grupo, que a pessoa pode trocar a qualquer momento no WhatsApp; usar ele como chave faria o
    // grupo virar uma conversa nova toda vez que o nome mudasse).
    const conversaExistente = await prisma.conversa.findFirst({
      where: { workspaceId, contato: remoteJid, ehGrupo: true },
      select: { nome: true, fotoUrl: true },
    });
    if (conversaExistente) {
      chaveContato = conversaExistente.nome;
      fotoUrlExistente = conversaExistente.fotoUrl;
    } else {
      const info = await buscarInfoGrupo(workspaceId, remoteJid!);
      chaveContato = info?.nome ?? waId;
      participantesGrupo = info?.participantes;
      descricaoGrupo = info?.descricao;
      criacaoGrupo = info?.criacao;
    }
  } else {
    contatoExistente = await encontrarContatoPorTelefone(workspaceId, waId);
    chaveContato = contatoExistente?.nome ?? data.pushName ?? waId;
    const conversaExistente = await prisma.conversa.findUnique({
      where: { workspaceId_nome: { workspaceId, nome: chaveContato } },
      select: { fotoUrl: true },
    });
    fotoUrlExistente = conversaExistente?.fotoUrl ?? null;
  }

  // Busca a foto de perfil só na primeira vez (conversa ainda sem uma) — pedir de novo a cada
  // mensagem seria uma chamada extra à Evolution toda hora à toa, sem necessidade real.
  const fotoUrl = fotoUrlExistente ?? (await buscarFotoPerfil(workspaceId, ehGrupo ? remoteJid! : waId).catch(() => null));

  // Conexão dona desta mensagem — é o número conectado por QR Code neste workspace. Sem isso, a
  // mensagem fica sem dono e não some da tela quando esse número é desconectado.
  const integracaoNaoOficial = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { metadados: true },
  });
  const contaCanal = contaCanalDaConexao(
    CANAL_NAO_OFICIAL,
    (integracaoNaoOficial?.metadados as { numero?: string } | null)?.numero,
  );

  if (fromMe) {
    // Mensagem mandada do próprio celular conectado (espelhamento, igual WhatsApp Web) — se foi
    // o CRM que mandou pela tela de Conversas, ela já foi persistida na hora do envio (com um id
    // diferente, gerado no navegador); esse eco chegando pelo webhook não deve virar uma segunda
    // bolha. Sem um id em comum entre os dois lados pra comparar, o jeito é checar se já existe
    // uma mensagem "out" idêntica (mesmo contato/texto) nos últimos segundos.
    const jaFoiMandadaPeloCrm = await prisma.mensagemExtra.findFirst({
      where: {
        workspaceId,
        contato: chaveContato,
        tipo: "out",
        texto,
        criadoEm: { gte: new Date(Date.now() - 30_000) },
      },
    });
    if (jaFoiMandadaPeloCrm) return;
  }

  // Grupo não é uma pessoa — não cria/casa `Contato` nem vira lead novo no funil sozinho, só a
  // thread de conversa mesmo (ver `ehGrupo` no upsert abaixo).
  const contato = ehGrupo
    ? null
    : (contatoExistente ??
      (await criarContatoPeloWhatsAppSeNaoExistir({ workspaceId, nome: chaveContato, whatsapp: waId })));

  // Só entra como lead novo no funil quando ALGUÉM DE FORA escreveu primeiro pra um contato que
  // ainda não existia — mensagem que a própria pessoa manda do celular pra alguém (ex.: um
  // contato pessoal) não deve virar negócio no funil sozinha.
  if (!ehGrupo && !fromMe && !contatoExistente) {
    await entrarNaPrimeiraEtapaComoNovoLead({ workspaceId, contatoNome: chaveContato, ehGrupo, origem: "WhatsApp" });
  }

  await prisma.mensagemExtra.create({
    data: {
      id: data.key.id,
      workspaceId,
      contato: chaveContato,
      tipo: fromMe ? "out" : "in",
      texto,
      hora: new Date(timestampMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      criadoEm: new Date(timestampMs),
      canal: CANAL_NAO_OFICIAL,
      contaCanal,
      extras: {
        // Nome de quem escreveu DENTRO do grupo — sem isso não dá pra distinguir os balões de cada
        // participante na tela, igual o WhatsApp de verdade mostra. Não se aplica fora de grupo (lá
        // "quem mandou" já é o próprio nome da conversa).
        ...(ehGrupo && !fromMe ? { remetenteNome: data.pushName ?? waId } : {}),
        // Áudio/imagem recebidos — conteúdo real não veio no payload (base64 desligado de
        // propósito), só esse aviso de que existe. Guarda o suficiente pra buscar sob demanda (ver
        // GET /api/integracoes/whatsapp-nao-oficial/midia) — hoje isso acontece automaticamente
        // assim que a conversa é aberta, não precisa mais de clique.
        ...(data.message?.audioMessage
          ? { midiaPendente: { remoteJid: remoteJid!, id: data.key.id, fromMe, tipo: "audio" as const } }
          : data.message?.imageMessage
            ? { midiaPendente: { remoteJid: remoteJid!, id: data.key.id, fromMe, tipo: "imagem" as const } }
            : {}),
      },
    },
  });

  await upsertConversaAoReceberMensagem({
    workspaceId,
    contaCanal,
    nome: chaveContato,
    canal: "WhatsApp",
    contato: ehGrupo ? remoteJid : waId,
    contatoId: contato?.id,
    origem: "Direto",
    contarComoNaoLida: !fromMe,
    ehGrupo,
    participantesGrupo,
    fotoUrl,
    descricaoGrupo,
    criacaoGrupo,
  });
}
