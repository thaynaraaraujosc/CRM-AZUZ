import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** DELETE — usado por `excluirModeloPersonalizado`. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/documentos-modelos/[id]">) {
  const { id } = await ctx.params;
  await prisma.modeloPersonalizado.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
