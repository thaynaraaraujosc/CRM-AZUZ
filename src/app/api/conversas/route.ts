import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET lista as conversas do workspace de quem está logado, mais recentes primeiro. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.conversa.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { atualizadoEm: "desc" },
  });
  return NextResponse.json(linhas);
}
