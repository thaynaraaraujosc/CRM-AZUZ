import { NextResponse } from "next/server";

import type { DocumentoBiblioteca } from "@/lib/biblioteca-documentos-context";
import { prisma } from "@/lib/prisma";

function paraDocumento(linha: { tags: unknown; [k: string]: unknown }): DocumentoBiblioteca {
  return {
    ...linha,
    tags: Array.isArray(linha.tags) ? (linha.tags as string[]) : undefined,
  } as DocumentoBiblioteca;
}

/** Atualização direta por id — usada por `atualizarDocumento`. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/biblioteca-documentos/[id]">) {
  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<DocumentoBiblioteca> & Record<string, unknown>;

  const linha = await prisma.documentoBiblioteca.update({
    where: { id },
    data: {
      ...dados,
      tags: dados.tags ?? undefined,
      atualizadoEm: new Date().toISOString().slice(0, 10),
    },
  });
  return NextResponse.json(paraDocumento(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/biblioteca-documentos/[id]">) {
  const { id } = await ctx.params;
  await prisma.documentoBiblioteca.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
