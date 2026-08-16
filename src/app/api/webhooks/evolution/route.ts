import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarTokenWebhook, workspaceIdDaInstancia, buscarNumeroConectado } from "@/lib/integracoes/evolution";
import { criarContatoPeloWhatsAppSeNaoExistir, encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead } from "@/lib/funis/upsert";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";

/** Formato de evento que a Evolution API manda pro webhook configurado na instância — mesmo body
 * pra todo tipo de evento, o que muda é `event` e o formato de `data`. */
type PayloadEvolution = {
  event: string;
  instance: string;
  data: Record<string, unknown>;
};

async function atualizarStatus(
  workspaceId: string,
  status: "aguardando_qr" | "conectado" | "desconectado",
  extra: { qrDataUrl?: string | null; numero?: string | null } = {},
) {
  await prisma.integracao.upsert({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    create: {
      id: `${workspaceId}-whatsapp_nao_oficial`,
      workspaceId,
      provedor: "whatsapp_nao_oficial",
      status,
      metadados: { qrDataUrl: extra.qrDataUrl ?? null, numero: extra.numero ?? null },
    },
    update: {
      status,
      metadados: { qrDataUrl: extra.qrDataUrl ?? null, numero: extra.numero ?? null },
      erroMensagem: null,
    },
  });
}

/**
 * Recebe eventos da Evolution API (servidor próprio de WhatsApp via Baileys, ver
 * src/lib/integracoes/evolution.ts) — autenticado por um token fixo na query string (não header
 * customizado, porque nem toda versão da Evolution permite configurar headers extra no webhook).
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!validarTokenWebhook(token)) {
    return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
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
    } else if (estado === "close") {
      await atualizarStatus(workspaceId, "desconectado");
    }
    return NextResponse.json({ ok: true });
  }

  if (evento === "messages.upsert") {
    const data = payload.data as {
      key?: { id?: string; remoteJid?: string; fromMe?: boolean };
      message?: { conversation?: string; extendedTextMessage?: { text?: string } };
      messageTimestamp?: number;
      pushName?: string;
    };

    const fromMe = data.key?.fromMe === true;
    const texto = data.message?.conversation ?? data.message?.extendedTextMessage?.text;
    // `remoteJid` é sempre "a outra parte" da conversa, tanto em mensagem recebida quanto enviada
    // (a Evolution segue a convenção do Baileys) — então serve pra achar o contato nos dois casos.
    const waId = data.key?.remoteJid?.split("@")[0];
    if (!texto || !waId || !data.key?.id) return NextResponse.json({ ok: true }); // mídia sem legenda, evento incompleto

    const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: data.key.id } });
    if (jaExiste) return NextResponse.json({ ok: true });

    const contatoExistente = await encontrarContatoPorTelefone(workspaceId, waId);
    const chaveContato = contatoExistente?.nome ?? data.pushName ?? waId;

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
      if (jaFoiMandadaPeloCrm) return NextResponse.json({ ok: true });
    }

    const contato =
      contatoExistente ??
      (await criarContatoPeloWhatsAppSeNaoExistir({ workspaceId, nome: chaveContato, whatsapp: waId }));

    // Só entra como lead novo no funil quando ALGUÉM DE FORA escreveu primeiro pra um contato que
    // ainda não existia — mensagem que a própria pessoa manda do celular pra alguém (ex.: um
    // contato pessoal) não deve virar negócio no funil sozinha.
    if (!fromMe && !contatoExistente) {
      await entrarNaPrimeiraEtapaComoNovoLead({ workspaceId, contatoNome: chaveContato, origem: "WhatsApp" });
    }

    const timestampMs = (data.messageTimestamp ?? Math.floor(Date.now() / 1000)) * 1000;
    await prisma.mensagemExtra.create({
      data: {
        id: data.key.id,
        workspaceId,
        contato: chaveContato,
        tipo: fromMe ? "out" : "in",
        texto,
        hora: new Date(timestampMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        criadoEm: new Date(timestampMs),
        canal: "whatsapp_nao_oficial",
      },
    });

    await upsertConversaAoReceberMensagem({
      workspaceId,
      nome: chaveContato,
      canal: "WhatsApp",
      contato: waId,
      contatoId: contato.id,
      origem: "Direto",
      contarComoNaoLida: !fromMe,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true }); // evento que não precisamos tratar (ex.: presence.update)
}
