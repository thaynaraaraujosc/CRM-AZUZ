import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/seguranca/auditoria";
import { conectarWhatsAppNaoOficial } from "@/lib/integracoes/evolution";

/** POST cria (se ainda não existir) a instância da Evolution API pro workspace de quem está
 * logado e devolve o QR Code atual. Grava direto no banco pra tela já mostrar o QR sem esperar
 * o primeiro evento de webhook chegar. */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  // Conectar e desconectar um canal é ação de dono da conta: desconectar o WhatsApp derruba o
  // atendimento da empresa inteira, e conectar outro número redireciona por onde as mensagens
  // saem. Antes bastava estar logado, e qualquer membro comum fazia as duas coisas.
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só administradores podem mexer nas conexões." }, { status: 403 });
  }

  // Conectar e desconectar um canal muda por onde a empresa inteira fala com os clientes. Sem
  // registro, "quem desconectou o WhatsApp?" não tinha resposta.
  await auditar({ acao: "integracao.conectada", workspaceId: sessao.user.workspaceId, membroId: sessao.user.id, email: sessao.user.email, recurso: "whatsapp_nao_oficial" });

  const workspaceId = sessao.user.workspaceId;

  try {
    const { qrDataUrl } = await conectarWhatsAppNaoOficial(workspaceId);
    const status = qrDataUrl ? "aguardando_qr" : "conectado";

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
      create: {
        id: `${workspaceId}-whatsapp_nao_oficial`,
        workspaceId,
        provedor: "whatsapp_nao_oficial",
        status,
        metadados: { qrDataUrl, numero: null },
      },
      update: {
        status,
        metadados: { qrDataUrl, numero: null },
        erroMensagem: null,
      },
    });

    return NextResponse.json({ ok: true, status, qrDataUrl });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao conectar";
    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
      create: {
        id: `${workspaceId}-whatsapp_nao_oficial`,
        workspaceId,
        provedor: "whatsapp_nao_oficial",
        status: "erro",
        erroMensagem: mensagem,
      },
      update: { status: "erro", erroMensagem: mensagem },
    });
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }
}
