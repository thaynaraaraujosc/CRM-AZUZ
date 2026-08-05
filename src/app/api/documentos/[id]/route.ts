import { NextResponse } from "next/server";

import type { Documento } from "@/lib/documentos-context";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function paraDocumento(linha: {
  paginas: unknown;
  config: unknown;
  pessoasAcesso: unknown;
  comentarios: unknown;
  versoes: unknown;
  [k: string]: unknown;
}): Documento {
  return {
    ...linha,
    paginas: linha.paginas as Documento["paginas"],
    config: linha.config as Documento["config"],
    pessoasAcesso: linha.pessoasAcesso as Documento["pessoasAcesso"],
    comentarios: linha.comentarios as Documento["comentarios"],
    versoes: linha.versoes as Documento["versoes"],
  } as Documento;
}

/** Atualização por id — usada pelo helper `atualizarDocumento()` do Context, que centraliza todo
 * mutador que edita um documento existente (páginas, config, comentários, versões, acesso...). Só
 * mexe em documento do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/documentos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<Documento>;
  // id/criadoEm/atualizadoEm são geridos pelo banco (PK e @updatedAt) — nunca vêm do front.
  const dados: Partial<Documento> = { ...body };
  delete dados.id;
  delete dados.criadoEm;
  delete dados.atualizadoEm;

  const { count } = await prisma.documento.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: dados,
  });
  if (count === 0) return NextResponse.json({ erro: "Documento não encontrado" }, { status: 404 });

  const linha = await prisma.documento.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(paraDocumento(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/documentos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.documento.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Documento não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
