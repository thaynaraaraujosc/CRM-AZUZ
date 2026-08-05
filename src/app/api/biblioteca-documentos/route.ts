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

/** GET lista os documentos da biblioteca do workspace de quem está logado. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.documentoBiblioteca.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { atualizadoEm: "desc" },
  });
  return NextResponse.json(linhas.map(paraDocumento));
}

/** POST cria um documento novo — mesma semântica de `adicionarDocumento` no Context. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = (await request.json()) as Omit<DocumentoBiblioteca, "id" | "atualizadoEm">;

  const linha = await prisma.documentoBiblioteca.create({
    data: {
      id: `doc-${Date.now()}`,
      workspaceId: sessao.user.workspaceId,
      ...dados,
      tags: dados.tags ?? undefined,
      atualizadoEm: new Date().toISOString().slice(0, 10),
    },
  });

  return NextResponse.json(paraDocumento(linha), { status: 201 });
}
