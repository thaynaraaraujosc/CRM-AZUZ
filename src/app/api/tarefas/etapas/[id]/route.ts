import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** PATCH renomeia a etapa — usada por `renomearEtapa`. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tarefas/etapas/[id]">) {
  const { id } = await ctx.params;
  const { titulo } = (await request.json()) as { titulo: string };
  const etapa = await prisma.tarefaEtapa.update({ where: { id }, data: { titulo } });
  return NextResponse.json(etapa);
}

/** DELETE exclui a etapa — os cards dela vão junto (relação `onDelete: Cascade` no schema), mesmo
 * comportamento que `excluirEtapa` já tinha no Context (descartava a coluna com tudo dentro). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/tarefas/etapas/[id]">) {
  const { id } = await ctx.params;
  await prisma.tarefaEtapa.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
