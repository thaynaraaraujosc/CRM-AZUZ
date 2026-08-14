import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { enviarContatoBaileys, enviarMensagemBaileys } from "@/lib/integracoes/baileys";

type ContatoPayload = { nome: string; whatsapp?: string; telefoneFixo?: string };

/** POST manda uma mensagem de verdade pelo número conectado via QR Code — chamada pela tela de
 * Conversas quando o atendente responde numa conversa do canal `whatsapp_baileys` (a gravação no
 * histórico local continua sendo feita como sempre, via `PUT /api/mensagens-extra`; esta rota só
 * cuida do envio real). Aceita `texto` (mensagem normal) OU `contato` (cartão/vCard) — nunca os
 * dois juntos. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto, contato } = (await request.json()) as {
    destinatario?: string;
    texto?: string;
    contato?: ContatoPayload;
  };
  if (!destinatario || (!texto?.trim() && !contato)) {
    return NextResponse.json({ erro: "destinatario e texto (ou contato) são obrigatórios" }, { status: 400 });
  }

  try {
    if (contato) {
      await enviarContatoBaileys(sessao.user.workspaceId, destinatario, contato);
    } else {
      await enviarMensagemBaileys(sessao.user.workspaceId, destinatario, texto!);
    }
    return NextResponse.json({ ok: true });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha ao enviar mensagem.";
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
