import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** DELETE remove um relatório do histórico — só mexe em registro do mesmo workspace de quem está logado. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/relatorios/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.relatorioGerado.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Relatório não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
