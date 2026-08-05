import { NextResponse } from "next/server";

import type { ModeloPersonalizado } from "@/lib/documentos-context";
import { prisma } from "@/lib/prisma";

/** GET lista os modelos personalizados (o front junta com MODELOS_DOCUMENTO, o catálogo embutido). */
export async function GET() {
  const linhas = await prisma.modeloPersonalizado.findMany({ orderBy: { criadoEm: "desc" } });
  return NextResponse.json(linhas as unknown as ModeloPersonalizado[]);
}

/** POST cria um modelo novo (ou uma cópia) — mesma semântica de `salvarComoModelo`/`duplicarModelo`. */
export async function POST(request: Request) {
  const dados = (await request.json()) as ModeloPersonalizado;

  const linha = await prisma.modeloPersonalizado.create({
    data: {
      id: dados.id,
      nome: dados.nome,
      descricao: dados.descricao,
      categoria: dados.categoria,
      conteudoHtml: dados.conteudoHtml,
      compartilhado: dados.compartilhado,
      autor: dados.autor,
    },
  });

  return NextResponse.json(linha as unknown as ModeloPersonalizado, { status: 201 });
}
