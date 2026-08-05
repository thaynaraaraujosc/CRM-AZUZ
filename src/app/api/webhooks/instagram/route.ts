import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarAssinaturaWebhook } from "@/lib/integracoes/meta";

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

  if (modo === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ erro: "Verificação inválida" }, { status: 403 });
}

type PayloadInstagram = {
  entry?: {
    messaging?: {
      sender?: { id: string };
      recipient?: { id: string };
      timestamp?: number;
      message?: { mid: string; text?: string };
    }[];
  }[];
};

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
  if (!validarAssinaturaWebhook(payloadCru, assinatura)) {
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 401 });
  }

  const payload = JSON.parse(payloadCru) as PayloadInstagram;

  for (const entry of payload.entry ?? []) {
    for (const evento of entry.messaging ?? []) {
      const instagramContaId = evento.recipient?.id;
      const mensagem = evento.message;
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

      const chaveContato = evento.sender?.id;
      if (!chaveContato) continue;

      const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: mensagem.mid } });
      if (jaExiste) continue;

      const criadoEm = evento.timestamp ? new Date(evento.timestamp) : new Date();
      await prisma.mensagemExtra.create({
        data: {
          id: mensagem.mid,
          workspaceId: integracaoDaConta.workspaceId,
          contato: chaveContato,
          tipo: "in",
          texto: mensagem.text ?? "",
          hora: criadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          criadoEm,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
