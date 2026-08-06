import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { iniciarSessaoBaileys } from "@/lib/integracoes/baileys";

/** POST manda o worker começar (ou retomar) a sessão do workspace — a UI passa a fazer polling em
 * `GET .../status` logo em seguida, esperando o QR aparecer. */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;

  try {
    await iniciarSessaoBaileys(workspaceId);
    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_baileys" } },
      create: { id: `${workspaceId}-whatsapp_baileys`, workspaceId, provedor: "whatsapp_baileys", status: "aguardando_qr" },
      update: { status: "aguardando_qr", erroMensagem: null },
    });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha ao iniciar sessão.";
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
