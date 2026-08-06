import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { desconectarSessaoBaileys } from "@/lib/integracoes/baileys";

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;

  await desconectarSessaoBaileys(workspaceId).catch(() => {});
  await prisma.integracao.updateMany({
    where: { workspaceId, provedor: "whatsapp_baileys" },
    data: { status: "desconectado", metadados: undefined, erroMensagem: null },
  });

  return NextResponse.json({ ok: true });
}
