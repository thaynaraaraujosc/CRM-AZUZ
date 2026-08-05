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

/** GET lista os documentos do workspace de quem está logado (inclusive os na lixeira — o front
 * filtra por `excluido`). */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.documento.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json(linhas.map(paraDocumento));
}

/** POST cria um documento novo (ou uma cópia) — mesma semântica de `criarDocumento`/`duplicarDocumento`. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = (await request.json()) as Documento;

  const linha = await prisma.documento.create({
    data: {
      id: dados.id,
      workspaceId: sessao.user.workspaceId,
      titulo: dados.titulo,
      favorito: dados.favorito,
      autor: dados.autor,
      paginas: dados.paginas,
      config: dados.config,
      pessoasAcesso: dados.pessoasAcesso,
      linkAtivo: dados.linkAtivo,
      linkPermissao: dados.linkPermissao,
      comentarios: dados.comentarios,
      versoes: dados.versoes,
      excluido: dados.excluido,
    },
  });

  return NextResponse.json(paraDocumento(linha), { status: 201 });
}
