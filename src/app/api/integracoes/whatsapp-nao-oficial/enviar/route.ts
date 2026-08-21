import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { enviarMensagemWhatsAppNaoOficial, enviarAudioWhatsAppNaoOficial } from "@/lib/integracoes/evolution";

/** POST manda uma mensagem de texto (ou áudio) pelo WhatsApp não oficial (Evolution API) —
 * chamada pela tela de Conversas quando o atendente responde numa conversa desse canal. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto, audioBase64 } = (await request.json()) as {
    destinatario?: string;
    texto?: string;
    audioBase64?: string;
  };
  if (!destinatario || (!texto?.trim() && !audioBase64)) {
    return NextResponse.json({ erro: "destinatario e (texto ou audioBase64) são obrigatórios" }, { status: 400 });
  }

  // JID de grupo (`<id>@g.us`) precisa ir inteiro pra Evolution — só numeral vira número de
  // telefone pra ela, não acha o grupo. Telefone de pessoa continua só-dígitos como sempre.
  const numeroOuJid = destinatario.endsWith("@g.us") ? destinatario : destinatario.replace(/\D/g, "");

  try {
    if (audioBase64) {
      await enviarAudioWhatsAppNaoOficial(sessao.user.workspaceId, numeroOuJid, audioBase64);
    } else {
      await enviarMensagemWhatsAppNaoOficial(sessao.user.workspaceId, numeroOuJid, texto!);
    }
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao enviar mensagem" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
