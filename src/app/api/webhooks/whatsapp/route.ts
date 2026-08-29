import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL, normalizarNumeroBrasileiro, validarAssinaturaWebhook } from "@/lib/integracoes/meta";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { CANAL_OFICIAL, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import { criarContatoPeloWhatsAppSeNaoExistir, encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead } from "@/lib/funis/upsert";
import { dispararAutomacoesDeMensagemRecebida } from "@/lib/automation-flow/disparar-no-servidor";
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

  // `.trim()` pelo mesmo motivo do webhook do Instagram: valor colado no painel de hospedagem
  // pode carregar espaço/quebra de linha invisível no fim.
  if (modo === "subscribe" && token?.trim() === process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ erro: "Verificação inválida" }, { status: 403 });
}

type MidiaWhatsApp = { id: string; mime_type?: string; caption?: string; filename?: string };

type PayloadWhatsApp = {
  entry?: {
    /** WABA ID — usado só pra log; o roteamento de verdade é pelo `phone_number_id` (um WABA pode
     * ter mais de um número, e é o número que identifica a integração). */
    id?: string;
    changes?: {
      field?: string;
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
        /** `statuses` — confirmação de entrega/leitura de mensagem que NÓS mandamos. */
        statuses?: {
          id: string;
          status?: string; // sent | delivered | read | failed
          timestamp?: string;
          errors?: { code?: number; title?: string; message?: string }[];
        }[];
        /** `message_template_status_update` — aprovação/rejeição de modelo de mensagem. */
        message_template_id?: string | number;
        message_template_name?: string;
        message_template_language?: string;
        event?: string; // APPROVED | REJECTED | PAUSED | ...
        reason?: string;
        /** `phone_number_quality_update` / `account_update` — saúde da conta. */
        display_phone_number?: string;
        current_limit?: string;
        event_type?: string;
        ban_info?: { waba_ban_state?: string; waba_ban_date?: string };
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

/** Acha a integração DAQUELE número (não do workspace da sessão — aqui não tem sessão nenhuma, quem
 * chama é a Meta). `metadados` é Json, então não dá pra filtrar `phoneNumberId` no `where` de forma
 * portável: filtra em memória, o custo é desprezível pro número de integrações ativas. */
async function integracaoDoNumero(phoneNumberId: string) {
  const conectadas = await prisma.integracao.findMany({
    where: { provedor: "meta_whatsapp", status: "conectado" },
  });
  return (
    conectadas.find((i) => (i.metadados as { phoneNumberId?: string } | null)?.phoneNumberId === phoneNumberId) ?? null
  );
}

/** Mescla campos em `Integracao.metadados` sem apagar o resto — `metadados` é uma coluna Json
 * substituída inteira pelo Prisma, então tem que ler antes de gravar. */
async function atualizarMetadados(integracaoId: string, novos: Record<string, unknown>, status?: string) {
  const atual = await prisma.integracao.findUnique({ where: { id: integracaoId }, select: { metadados: true } });
  const metadados = { ...((atual?.metadados as Record<string, unknown> | null) ?? {}), ...novos };
  await prisma.integracao.update({
    where: { id: integracaoId },
    data: { metadados: metadados as never, ...(status ? { status } : {}) },
  });
}

/**
 * POST recebe mensagem recebida/status de entrega — sem `auth()` de propósito (quem chama é a
 * Meta, não um usuário logado). Em vez disso, valida a assinatura HMAC do corpo cru
 * (`X-Hub-Signature-256`) pra garantir que a chamada é mesmo da Meta.
 *
 * É UM webhook só pra todos os workspaces (é assim que a Cloud API funciona: um app, um endpoint,
 * N clientes conectados). O roteamento é sempre por `value.metadata.phone_number_id` → a
 * `Integracao` daquele número → o `workspaceId` dela. O workspace NUNCA vem do payload.
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
    // Falha de assinatura é indistinguível, do lado de fora, de "a Meta nunca chamou": os dois
    // acabam em nenhuma mensagem no CRM. A causa quase sempre é `META_APP_SECRET` desencontrado do
    // secret do app (secret redefinido na Meta e não atualizado aqui, ou de outro app). Sem este
    // log, o sintoma é silencioso e não há como saber qual dos dois casos está acontecendo.
    console.error(
      "[webhook whatsapp] assinatura invalida — chamada recebida e descartada.",
      assinatura
        ? "Cabecalho X-Hub-Signature-256 presente: confira se META_APP_SECRET e o secret do app que envia o webhook."
        : "Sem cabecalho X-Hub-Signature-256 — chamada nao veio da Meta.",
    );
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 401 });
  }
  console.log("[webhook whatsapp] chamada valida recebida da Meta.");

  const payload = JSON.parse(payloadCru) as PayloadWhatsApp;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const valor = change.value;
      const phoneNumberId = valor?.metadata?.phone_number_id;

      // ---- statuses: confirmação de entrega/leitura de mensagem que NÓS mandamos ----
      if (valor?.statuses?.length && phoneNumberId) {
        const integracao = await integracaoDoNumero(phoneNumberId);
        if (!integracao) continue;
        for (const s of valor.statuses) {
          // Só atualiza mensagem que já existe (a nossa, gravada no envio) — status de mensagem
          // desconhecida é ruído, não vira registro novo.
          await prisma.mensagemExtra
            .updateMany({
              where: { id: s.id, workspaceId: integracao.workspaceId },
              data: { status: s.status ?? undefined },
            })
            .catch((erro) => console.error("[webhook whatsapp] falha ao atualizar status:", erro));
          if (s.status === "failed" && s.errors?.length) {
            console.error(`[webhook whatsapp] mensagem ${s.id} falhou:`, s.errors[0]?.code, s.errors[0]?.title);
          }
        }
        continue;
      }

      // ---- message_template_status_update: aprovação/rejeição de modelo de mensagem ----
      if (change.field === "message_template_status_update" && valor?.message_template_id) {
        const wabaId = entry.id;
        const integracao = wabaId
          ? (
              await prisma.integracao.findMany({ where: { provedor: "meta_whatsapp", status: "conectado" } })
            ).find((i) => (i.metadados as { wabaId?: string } | null)?.wabaId === wabaId)
          : null;
        if (!integracao) continue;
        await prisma.whatsappTemplate
          .updateMany({
            where: { workspaceId: integracao.workspaceId, metaId: String(valor.message_template_id) },
            data: { status: valor.event ?? "PENDING", motivoRejeicao: valor.reason ?? null },
          })
          .catch((erro) => console.error("[webhook whatsapp] falha ao atualizar template:", erro));
        continue;
      }

      // ---- account_update / phone_number_quality_update: saúde da conta ----
      if (change.field === "account_update" || change.field === "phone_number_quality_update") {
        const integracao = phoneNumberId ? await integracaoDoNumero(phoneNumberId) : null;
        if (!integracao) continue;
        const banido = valor?.ban_info?.waba_ban_state;
        await atualizarMetadados(
          integracao.id,
          {
            ...(valor?.current_limit ? { limiteEnvio: valor.current_limit } : {}),
            ...(valor?.event_type ? { ultimoEventoConta: valor.event_type } : {}),
            ...(banido ? { banimento: banido } : {}),
            ultimaVerificacaoSaude: new Date().toISOString(),
          },
          banido ? "erro" : undefined,
        ).catch((erro) => console.error("[webhook whatsapp] falha ao atualizar saúde da conta:", erro));
        continue;
      }

      if (!phoneNumberId || !valor?.messages?.length) continue;

      const integracao = await integracaoDoNumero(phoneNumberId);
      if (!integracao) {
        // WABA/número órfão (conectado a este app mas sem integração no CRM) — loga e segue, não
        // pode derrubar o processamento do resto do lote.
        console.log(`[webhook whatsapp] mensagem de número não cadastrado (${phoneNumberId}), descartada.`);
        continue;
      }

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
        const contatoExistente = await encontrarContatoPorTelefone(integracao.workspaceId, waId);
        const chaveContato = contatoExistente?.nome ?? nomePerfil ?? waId;
        const contato =
          contatoExistente ??
          (await criarContatoPeloWhatsAppSeNaoExistir({
            workspaceId: integracao.workspaceId,
            nome: chaveContato,
            whatsapp: waId,
          }));

        // Regra de negócio: todo lead novo entra no funil pela primeira etapa. Contato que já
        // existia (recebeu mensagem de novo) nunca é mexido de etapa aqui — só o vendedor decide
        // mover manualmente, mandar mensagem de novo não pode "resetar" onde ele estava.
        if (!contatoExistente) {
          await entrarNaPrimeiraEtapaComoNovoLead({
            workspaceId: integracao.workspaceId,
            contatoNome: chaveContato,
            origem: "WhatsApp",
            contaCanal: contaCanalDaConexao(CANAL_OFICIAL, phoneNumberId),
          });
        }

        const midia = mensagem.image ?? mensagem.sticker ?? mensagem.audio ?? mensagem.video ?? mensagem.document;
        const extras =
          midia && integracao.accessTokenCriptografado
            ? await extrasDeMidia(mensagem.type, midia, decriptar(integracao.accessTokenCriptografado))
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
            workspaceId: integracao.workspaceId,
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
            // Sem `canal`, mensagem da API oficial ficava indistinguível do histórico antigo do QR
            // Code (as duas com NULL) — e `contaCanal` amarra ao número exato, pra caixa de entrada
            // zerar ao desconectar e voltar ao reconectar.
            canal: CANAL_OFICIAL,
            contaCanal: contaCanalDaConexao(CANAL_OFICIAL, phoneNumberId),
          },
        });

        await upsertConversaAoReceberMensagem({
          workspaceId: integracao.workspaceId,
          nome: chaveContato,
          canal: "WhatsApp",
          contato: waId,
          contatoId: contato?.id,
          origem: "Direto",
          contaCanal: contaCanalDaConexao(CANAL_OFICIAL, phoneNumberId),
        });

        await dispararAutomacoesDeMensagemRecebida({
          workspaceId: integracao.workspaceId,
          contatoNome: chaveContato,
          canal: "WhatsApp",
          textoRecebido: texto,
        }).catch((erro) => console.error("[webhook whatsapp] falha ao disparar automações:", erro));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
