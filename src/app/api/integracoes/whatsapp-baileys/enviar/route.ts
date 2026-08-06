import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { enviarMensagemBaileys } from "@/lib/integracoes/baileys";

/** POST manda uma mensagem de verdade pelo número conectado via QR Code — chamada pela tela de
 * Conversas quando o atendente responde numa conversa do canal `whatsapp_baileys` (a gravação no
 * histórico local continua sendo feita como sempre, via `PUT /api/mensagens-extra`; esta rota só
 * cuida do envio real). */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto } = (await request.json()) as { destinatario?: string; texto?: string };
  if (!destinatario || !texto?.trim()) {
    return NextResponse.json({ erro: "destinatario e texto são obrigatórios" }, { status: 400 });
  }

  try {
    await enviarMensagemBaileys(sessao.user.workspaceId, destinatario, texto);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha ao enviar mensagem.";
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
