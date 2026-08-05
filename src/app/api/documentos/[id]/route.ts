import { NextResponse } from "next/server";

import type { Documento } from "@/lib/documentos-context";
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
 * mutador que edita um documento existente (páginas, config, comentários, versões, acesso...). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/documentos/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<Documento>;
  // id/criadoEm/atualizadoEm são geridos pelo banco (PK e @updatedAt) — nunca vêm do front.
  const dados: Partial<Documento> = { ...body };
  delete dados.id;
  delete dados.criadoEm;
  delete dados.atualizadoEm;

  const linha = await prisma.documento.update({ where: { id }, data: dados });
  return NextResponse.json(paraDocumento(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/documentos/[id]">) {
  const { id } = await ctx.params;
  await prisma.documento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
