import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** PATCH renomeia a etapa — usada por `renomearEtapa`. Só mexe em etapa do mesmo workspace. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tarefas/etapas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { titulo } = (await request.json()) as { titulo: string };

  const { count } = await prisma.tarefaEtapa.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: { titulo },
  });
  if (count === 0) return NextResponse.json({ erro: "Etapa não encontrada" }, { status: 404 });

  const etapa = await prisma.tarefaEtapa.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(etapa);
}

/** DELETE exclui a etapa — os cards dela vão junto (relação `onDelete: Cascade` no schema), mesmo
 * comportamento que `excluirEtapa` já tinha no Context (descartava a coluna com tudo dentro). Só
 * mexe em etapa do mesmo workspace. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/tarefas/etapas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.tarefaEtapa.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Etapa não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
