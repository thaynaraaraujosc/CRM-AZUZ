import { NextResponse } from "next/server";

import type { DocumentoBiblioteca } from "@/lib/biblioteca-documentos-context";
import { prisma } from "@/lib/prisma";

function paraDocumento(linha: { tags: unknown; [k: string]: unknown }): DocumentoBiblioteca {
  return {
    ...linha,
    tags: Array.isArray(linha.tags) ? (linha.tags as string[]) : undefined,
  } as DocumentoBiblioteca;
}

/** GET lista todos os documentos da biblioteca. */
export async function GET() {
  const linhas = await prisma.documentoBiblioteca.findMany({ orderBy: { atualizadoEm: "desc" } });
  return NextResponse.json(linhas.map(paraDocumento));
}

/** POST cria um documento novo — mesma semântica de `adicionarDocumento` no Context. */
export async function POST(request: Request) {
  const dados = (await request.json()) as Omit<DocumentoBiblioteca, "id" | "atualizadoEm">;

  const linha = await prisma.documentoBiblioteca.create({
    data: {
      id: `doc-${Date.now()}`,
      ...dados,
      tags: dados.tags ?? undefined,
      atualizadoEm: new Date().toISOString().slice(0, 10),
    },
  });

  return NextResponse.json(paraDocumento(linha), { status: 201 });
}
