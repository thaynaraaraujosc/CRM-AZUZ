import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { enviarMensagemWhatsAppNaoOficial } from "@/lib/integracoes/whatsapp-nao-oficial";

/** POST manda uma mensagem de texto pelo WhatsApp não oficial (whatsapp-service) — chamada pela
 * tela de Conversas quando o atendente responde numa conversa desse canal. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto } = (await request.json()) as { destinatario?: string; texto?: string };
  if (!destinatario || !texto?.trim()) {
    return NextResponse.json({ erro: "destinatario e texto são obrigatórios" }, { status: 400 });
  }

  try {
    await enviarMensagemWhatsAppNaoOficial(destinatario.replace(/\D/g, ""), texto);
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao enviar mensagem" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
