import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL } from "@/lib/integracoes/meta";

type ErroGraph = { error?: { message?: string } };

/**
 * POST manda uma mensagem de verdade pelo WhatsApp Business oficial (Meta) conectado — chamada
 * pela tela de Conversas quando o atendente responde numa conversa que NÃO é do canal
 * `whatsapp_baileys` (ver `contatoUsaWhatsappBaileys()` em conversas/page.tsx). Antes desta rota
 * existir, o envio pelo canal oficial só atualizava o estado local — nunca chamava a Graph API,
 * então a mensagem nunca saía de verdade.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto } = (await request.json()) as { destinatario?: string; texto?: string };
  if (!destinatario || !texto?.trim()) {
    return NextResponse.json({ erro: "destinatario e texto são obrigatórios" }, { status: 400 });
  }

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "meta_whatsapp" } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "WhatsApp Business (Meta) não conectado" }, { status: 404 });
  }

  const { phoneNumberId } = integracao.metadados as { phoneNumberId?: string };
  if (!phoneNumberId) {
    return NextResponse.json({ erro: "Número de telefone da integração não configurado" }, { status: 404 });
  }

  // A Meta exige o número em dígitos puros, com código do país — remove tudo que não for número
  // (o destinatário pode chegar como waId cru da Conversa, ou formatado do cadastro do contato).
  const numeroLimpo = destinatario.replace(/\D/g, "");

  try {
    const accessToken = decriptar(integracao.accessTokenCriptografado);
    const resposta = await fetch(`${META_GRAPH_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numeroLimpo,
        type: "text",
        text: { body: texto },
      }),
    });
    const corpo = (await resposta.json()) as ErroGraph;
    if (!resposta.ok) {
      throw new Error(corpo.error?.message ?? `Falha na Graph API (${resposta.status})`);
    }
    return NextResponse.json({ ok: true });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha ao enviar mensagem.";
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
