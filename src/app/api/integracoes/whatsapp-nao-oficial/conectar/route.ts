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
    const { qrDataUrl, estado, avisoWebhook } = await conectarWhatsAppNaoOficial(workspaceId);
    /*
     * O status vem do ESTADO da sessão, não da ausência de QR Code.
     *
     * Era `qrDataUrl ? "aguardando_qr" : "conectado"`: sem código, logo conectado. Só que a
     * Evolution deixa de mandar o código por vários motivos que não são conexão, e aí o CRM
     * marcava "conectado" sem ninguém ter lido nada. A tela passava a mentir justamente no campo
     * que a pessoa usa pra confiar em todo o resto.
     */
    const status = estado === "open" ? "conectado" : "aguardando_qr";

    // Mescla os metadados em vez de substituir. `metadados` é uma coluna Json que o Prisma troca
    // inteira, e escrever só `{ qrDataUrl, numero }` apagava o progresso da importação de
    // histórico e o sinal de vida do webhook a cada clique em "Conectar": a importação recomeçava
    // do zero sem ninguém entender por quê.
    const atual = await prisma.integracao.findUnique({
      where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
      select: { metadados: true },
    });
    const metadados = {
      ...((atual?.metadados as Record<string, unknown> | null) ?? {}),
      qrDataUrl,
      numero: null,
    };

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
      create: {
        id: `${workspaceId}-whatsapp_nao_oficial`,
        workspaceId,
        provedor: "whatsapp_nao_oficial",
        status,
        metadados,
        erroMensagem: avisoWebhook ?? null,
      },
      update: {
        status,
        metadados,
        // O aviso de que a conexão subiu SEM o registro do webhook. Sem isto, a tela dizia
        // "conectado" enquanto nenhuma mensagem jamais chegaria, e nada contradizia isso.
        erroMensagem: avisoWebhook ?? null,
      },
    });

    return NextResponse.json({ ok: true, status, qrDataUrl, avisoWebhook: avisoWebhook ?? null });
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
