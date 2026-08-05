import { NextResponse } from "next/server";

import type { ModeloPersonalizado } from "@/lib/documentos-context";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET lista os modelos personalizados do workspace de quem está logado (o front junta com
 * MODELOS_DOCUMENTO, o catálogo embutido). */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.modeloPersonalizado.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "desc" },
  });
  return NextResponse.json(linhas as unknown as ModeloPersonalizado[]);
}

/** POST cria um modelo novo (ou uma cópia) — mesma semântica de `salvarComoModelo`/`duplicarModelo`. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = (await request.json()) as ModeloPersonalizado;

  const linha = await prisma.modeloPersonalizado.create({
    data: {
      id: dados.id,
      workspaceId: sessao.user.workspaceId,
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
