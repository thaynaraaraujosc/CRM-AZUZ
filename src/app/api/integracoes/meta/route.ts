import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET devolve o status da integração de WhatsApp (Meta) do workspace de quem está logado — nunca
 * o token, só o que a UI precisa mostrar (status, número conectado, erro). */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "meta_whatsapp" } },
    select: { status: true, metadados: true, erroMensagem: true, atualizadoEm: true },
  });

  return NextResponse.json(
    linha ?? { status: "desconectado", metadados: null, erroMensagem: null, atualizadoEm: null },
  );
}
