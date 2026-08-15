import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL, normalizarNumeroBrasileiro } from "@/lib/integracoes/meta";

type ErroGraph = { error?: { message?: string } };
type ContatoPayload = {
  nome: string;
  whatsapp?: string;
  telefoneFixo?: string;
  email?: string;
  empresa?: string;
  cargo?: string;
};

/**
 * POST manda uma mensagem de verdade pelo WhatsApp Business oficial (Meta) conectado — chamada
 * pela tela de Conversas quando o atendente responde numa conversa que NÃO é do canal
 * `whatsapp_baileys` (ver `contatoUsaWhatsappBaileys()` em conversas/page.tsx). Antes desta rota
 * existir, o envio pelo canal oficial só atualizava o estado local — nunca chamava a Graph API,
 * então a mensagem nunca saía de verdade. Aceita `texto` (mensagem normal) OU `contato`
 * (cartão/vCard, `type: "contacts"` da Graph API) — nunca os dois juntos.
 */
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
  // `normalizarNumeroBrasileiro` corrige o caso do wa_id vir sem o 9º dígito do celular.
  const numeroLimpo = normalizarNumeroBrasileiro(destinatario.replace(/\D/g, ""));

  const corpoMensagem = contato
    ? {
        messaging_product: "whatsapp",
        to: numeroLimpo,
        type: "contacts",
        contacts: [
          {
            name: { formatted_name: contato.nome, first_name: contato.nome.split(" ")[0] },
            phones: [
              ...(contato.whatsapp ? [{ phone: contato.whatsapp, type: "CELL" }] : []),
              ...(contato.telefoneFixo ? [{ phone: contato.telefoneFixo, type: "WORK" }] : []),
            ],
            ...(contato.email ? { emails: [{ email: contato.email, type: "WORK" }] } : {}),
            ...(contato.empresa || contato.cargo
              ? { org: { company: contato.empresa, title: contato.cargo } }
              : {}),
          },
        ],
      }
    : { messaging_product: "whatsapp", to: numeroLimpo, type: "text", text: { body: texto } };

  try {
    const accessToken = decriptar(integracao.accessTokenCriptografado);
    const resposta = await fetch(`${META_GRAPH_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(corpoMensagem),
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
