import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarAssinaturaWebhook } from "@/lib/integracoes/meta";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";

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

type PayloadWhatsApp = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: { from: string; id: string; timestamp: string; type: string; text?: { body?: string } }[];
      };
    }[];
  }[];
};

/**
 * POST recebe mensagem recebida/status de entrega — sem `auth()` de propósito (quem chama é a
 * Meta, não um usuário logado). Em vez disso, valida a assinatura HMAC do corpo cru
 * (`X-Hub-Signature-256`) pra garantir que a chamada é mesmo da Meta.
 *
 * Limitação conhecida desta fase: a mensagem é gravada em `MensagemExtra` (workspace-scoped,
 * reaproveitando a Fase 2), mas a tela de Conversas hoje só junta essas mensagens extras às
 * conversas já existentes (por nome do contato) — um número totalmente novo, que ainda não é
 * contato nem conversa seedada, fica salvo no banco mas não aparece como conversa nova na tela
 * ainda (isso é uma frente de front-end separada, pra depois).
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
        const waId = mensagem.from;
        const nomePerfil = valor.contacts?.find((c) => c.wa_id === waId)?.profile?.name;

        // Tenta casar com um contato já existente pelo telefone, pra mensagem aparecer numa
        // conversa que já existe — número totalmente novo cai no fallback (fica salvo, mas sem
        // conversa correspondente na tela ainda, ver limitação acima).
        const contatoExistente = await prisma.contato.findFirst({
          where: { workspaceId: integracaoDoNumero.workspaceId, whatsapp: { contains: waId } },
        });
        const chaveContato = contatoExistente?.nome ?? nomePerfil ?? waId;

        const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: mensagem.id } });
        if (jaExiste) continue;

        await prisma.mensagemExtra.create({
          data: {
            id: mensagem.id,
            workspaceId: integracaoDoNumero.workspaceId,
            contato: chaveContato,
            tipo: "in",
            texto: mensagem.text?.body ?? "",
            hora: new Date(Number(mensagem.timestamp) * 1000).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            criadoEm: new Date(Number(mensagem.timestamp) * 1000),
          },
        });

        await upsertConversaAoReceberMensagem({
          workspaceId: integracaoDoNumero.workspaceId,
          nome: chaveContato,
          canal: "WhatsApp",
          contato: waId,
          origem: "Direto",
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
