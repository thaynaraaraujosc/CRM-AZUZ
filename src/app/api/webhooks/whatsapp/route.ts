import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL, normalizarNumeroBrasileiro, validarAssinaturaWebhook } from "@/lib/integracoes/meta";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { criarContatoPeloWhatsAppSeNaoExistir, encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead } from "@/lib/funis/upsert";
import type { ConvMensagem } from "@/lib/data";

/**
 * GET — handshake de verificação que a Meta faz uma vez, ao cadastrar a URL do webhook no painel
 * do App. Compara o `hub.verify_token` (valor escolhido por você, cadastrado nos dois lados) e
 * devolve o `hub.challenge` de volta, sem isso a Meta recusa salvar o webhook.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (modo === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ erro: "Verificação inválida" }, { status: 403 });
}

type MidiaWhatsApp = { id: string; mime_type?: string; caption?: string; filename?: string };

type PayloadWhatsApp = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          image?: MidiaWhatsApp;
          sticker?: MidiaWhatsApp;
          audio?: MidiaWhatsApp;
          video?: MidiaWhatsApp;
          document?: MidiaWhatsApp;
        }[];
      };
    }[];
  }[];
};

const RÓTULO_POR_TIPO: Record<string, string> = {
  sticker: "[Figurinha]",
  image: "[Imagem]",
  audio: "[Áudio]",
  video: "[Vídeo]",
  document: "[Documento]",
  location: "[Localização]",
};

/**
 * Baixa a mídia de verdade da Graph API — o webhook só manda o `id` da mídia, não o arquivo. Dois
 * passos: 1) `GET /{media-id}` devolve uma URL temporária (só vale por pouco tempo, e só é
 * acessível com o mesmo token de acesso) 2) baixa o arquivo dessa URL e converte pra data URL
 * base64 — mesmo formato que o resto do CRM já usa pra mídia (foto de perfil, anexos), evita
 * precisar de um serviço de storage externo pra essa entrega.
 */
async function baixarMidia(mediaId: string, accessToken: string): Promise<{ dataUrl: string; tamanho: number } | null> {
  try {
    const infoResposta = await fetch(`${META_GRAPH_URL}/${mediaId}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!infoResposta.ok) return null;
    const info = (await infoResposta.json()) as { url?: string; mime_type?: string };
    if (!info.url) return null;

    const arquivoResposta = await fetch(info.url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!arquivoResposta.ok) return null;
    const bytes = Buffer.from(await arquivoResposta.arrayBuffer());
    const mimeType = info.mime_type ?? arquivoResposta.headers.get("content-type") ?? "application/octet-stream";
    return { dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`, tamanho: bytes.length };
  } catch (erro) {
    console.error("Falha ao baixar mídia do WhatsApp:", erro);
    return null;
  }
}

/** Monta os campos extras (`imagens`/`audio`/`documento`/`video`) da mensagem, no mesmo formato
 * que o resto do CRM já usa pra mídia real — se o download falhar, cai pro rótulo em texto. */
async function extrasDeMidia(
  tipo: string,
  midia: MidiaWhatsApp | undefined,
  accessToken: string,
): Promise<Partial<ConvMensagem>> {
  if (!midia) return {};
  const baixado = await baixarMidia(midia.id, accessToken);
  if (!baixado) return {};

  const { dataUrl, tamanho } = baixado;
  const formato = midia.mime_type?.split("/")[1] ?? "arquivo";
  switch (tipo) {
    case "image":
    case "sticker":
      return { imagens: [{ url: dataUrl, nome: `${tipo === "sticker" ? "figurinha" : "imagem"}.${formato}`, tamanho }] };
    case "audio":
      return { audio: { url: dataUrl, duracao: 0, waveform: [] } };
    case "video":
      return { video: { url: dataUrl, nome: `video.${formato}`, tamanho, comAudio: true } };
    case "document":
      return {
        documento: { url: dataUrl, nome: midia.filename ?? `documento.${formato}`, tamanho, formato, origem: "computador" },
      };
    default:
      return {};
  }
}

/**
 * POST recebe mensagem recebida/status de entrega — sem `auth()` de propósito (quem chama é a
 * Meta, não um usuário logado). Em vez disso, valida a assinatura HMAC do corpo cru
 * (`X-Hub-Signature-256`) pra garantir que a chamada é mesmo da Meta.
 *
 * A mensagem é gravada em `MensagemExtra` (workspace-scoped) e a `Conversa` correspondente é
 * criada/atualizada via `upsertConversaAoReceberMensagem`. Número novo (sem `Contato` cadastrado
 * ainda) ganha um `Contato` de verdade automaticamente (`criarContatoPeloWhatsAppSeNaoExistir`),
 * usando o nome do perfil do WhatsApp — não fica mais "órfão" até alguém salvar manualmente.
 */
export async function POST(request: Request) {
  const payloadCru = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256");
  if (!validarAssinaturaWebhook(payloadCru, assinatura)) {
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 401 });
  }

  const payload = JSON.parse(payloadCru) as PayloadWhatsApp;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const valor = change.value;
      const phoneNumberId = valor?.metadata?.phone_number_id;
      if (!phoneNumberId || !valor?.messages?.length) continue;

      // `metadados` é Json — não dá pra filtrar phoneNumberId direto no `where` de forma portável,
      // então filtra em memória (poucas integrações ativas, custo desprezível).
      const todasConectadas = await prisma.integracao.findMany({
        where: { provedor: "meta_whatsapp", status: "conectado" },
      });
      const integracaoDoNumero = todasConectadas.find(
        (i) => (i.metadados as { phoneNumberId?: string } | null)?.phoneNumberId === phoneNumberId,
      );
      if (!integracaoDoNumero) continue;

      for (const mensagem of valor.messages) {
        // Normaliza aqui (não só na hora de enviar) — assim o número gravado na Conversa já sai
        // certo desde a primeira mensagem, no formato que o resto do sistema (e a Meta) reconhece.
        const waId = normalizarNumeroBrasileiro(mensagem.from);
        const nomePerfil = valor.contacts?.find((c) => c.wa_id === mensagem.from)?.profile?.name;

        const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: mensagem.id } });
        if (jaExiste) continue;

        // Casa com um Contato já existente pelo telefone (comparação normalizada, não `contains`
        // cru) — número totalmente novo ganha um Contato automaticamente, com o nome do perfil do
        // WhatsApp quando disponível.
        const contatoExistente = await encontrarContatoPorTelefone(integracaoDoNumero.workspaceId, waId);
        const chaveContato = contatoExistente?.nome ?? nomePerfil ?? waId;
        const contato =
          contatoExistente ??
          (await criarContatoPeloWhatsAppSeNaoExistir({
            workspaceId: integracaoDoNumero.workspaceId,
            nome: chaveContato,
            whatsapp: waId,
          }));

        // Regra de negócio: todo lead novo entra no funil pela primeira etapa. Contato que já
        // existia (recebeu mensagem de novo) nunca é mexido de etapa aqui — só o vendedor decide
        // mover manualmente, mandar mensagem de novo não pode "resetar" onde ele estava.
        if (!contatoExistente) {
          await entrarNaPrimeiraEtapaComoNovoLead({
            workspaceId: integracaoDoNumero.workspaceId,
            contatoNome: chaveContato,
            origem: "WhatsApp",
          });
        }

        const midia = mensagem.image ?? mensagem.sticker ?? mensagem.audio ?? mensagem.video ?? mensagem.document;
        const extras =
          midia && integracaoDoNumero.accessTokenCriptografado
            ? await extrasDeMidia(mensagem.type, midia, decriptar(integracaoDoNumero.accessTokenCriptografado))
            : {};
        const temMidiaBaixada = Object.keys(extras).length > 0;
        // Rótulo em texto sempre existe (aparece na lista de conversas e como legenda/fallback),
        // mesmo quando a mídia baixou certinho.
        const texto = mensagem.text?.body ?? midia?.caption ?? RÓTULO_POR_TIPO[mensagem.type] ?? "[Mensagem não suportada]";
        if (midia && !temMidiaBaixada) {
          console.error(`Falha ao baixar mídia (${mensagem.type}) da mensagem ${mensagem.id} — caiu no rótulo em texto.`);
        }

        await prisma.mensagemExtra.create({
          data: {
            id: mensagem.id,
            workspaceId: integracaoDoNumero.workspaceId,
            contato: chaveContato,
            tipo: "in",
            texto,
            // `timeZone` explícito — sem isso, roda no fuso do servidor (UTC na Vercel), 3h
            // adiantado do horário de Brasília.
            hora: new Date(Number(mensagem.timestamp) * 1000).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            }),
            criadoEm: new Date(Number(mensagem.timestamp) * 1000),
            extras: temMidiaBaixada ? extras : undefined,
          },
        });

        await upsertConversaAoReceberMensagem({
          workspaceId: integracaoDoNumero.workspaceId,
          nome: chaveContato,
          canal: "WhatsApp",
          contato: waId,
          contatoId: contato.id,
          origem: "Direto",
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
