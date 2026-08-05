import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** DELETE — usado por `excluirModeloPersonalizado`. Só mexe em modelo do mesmo workspace. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/documentos-modelos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.modeloPersonalizado.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Modelo não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
