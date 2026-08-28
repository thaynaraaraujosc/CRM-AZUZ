import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarDirectInstagram } from "@/lib/integracoes/instagram-login";

/**
 * Envia uma mensagem pelo Direct do Instagram.
 *
 * Receber Direct já funcionava, responder não: a tela de Conversas só tinha caminho de envio pros
 * dois canais de WhatsApp, e uma conversa do Instagram caía no "essa conversa não tem um número de
 * WhatsApp associado" — o CRM recebia a mensagem e não deixava responder.
 *
 * `destinatario` é o id interno de quem mandou (guardado em `Conversa.contato`), não o @: é ele que
 * a API do Instagram aceita, e ele não muda se a pessoa trocar de nome de usuário.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto, respondendoMid } = (await request.json()) as {
    destinatario?: string;
    texto?: string;
    respondendoMid?: string;
  };
  if (!destinatario?.trim() || !texto?.trim()) {
    return NextResponse.json({ erro: "destinatario e texto são obrigatórios" }, { status: 400 });
  }

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  try {
    const messageId = await enviarDirectInstagram(
      decriptar(integracao.accessTokenCriptografado),
      destinatario.trim(),
      texto,
      respondendoMid,
    );
    return NextResponse.json({ ok: true, messageId });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao enviar pelo Instagram.";
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }
}
