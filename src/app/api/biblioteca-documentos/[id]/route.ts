import { NextResponse } from "next/server";

import type { DocumentoBiblioteca } from "@/lib/biblioteca-documentos-context";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function paraDocumento(linha: { tags: unknown; [k: string]: unknown }): DocumentoBiblioteca {
  return {
    ...linha,
    tags: Array.isArray(linha.tags) ? (linha.tags as string[]) : undefined,
  } as DocumentoBiblioteca;
}

/** Atualização direta por id — usada por `atualizarDocumento`. Só mexe em documento do mesmo
 * workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/biblioteca-documentos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<DocumentoBiblioteca> & Record<string, unknown>;

  const { count } = await prisma.documentoBiblioteca.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: {
      ...dados,
      tags: dados.tags ?? undefined,
      atualizadoEm: new Date().toISOString().slice(0, 10),
    },
  });
  if (count === 0) return NextResponse.json({ erro: "Documento não encontrado" }, { status: 404 });

  const linha = await prisma.documentoBiblioteca.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(paraDocumento(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/biblioteca-documentos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.documentoBiblioteca.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Documento não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
