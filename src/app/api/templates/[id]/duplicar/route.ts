import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITES } from "@/lib/templates/regras";

/** Cópia local, sem vínculo com a Meta. É o jeito de "editar" um template que já está lá. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;
  const { id } = await params;

  const original = await prisma.template.findFirst({ where: { id, workspaceId } });
  if (!original) return NextResponse.json({ erro: "Template não encontrado." }, { status: 404 });

  const copia = await prisma.template.create({
    data: {
      id: `tpl-${workspaceId}-${Date.now()}`,
      workspaceId,
      nome: `${original.nome} (cópia)`,
      canal: original.canal,
      categoria: original.categoria,
      idioma: original.idioma,
      assunto: original.assunto,
      corpo: original.corpo,
      variaveis: original.variaveis as never,
      botoes: original.botoes as never,
      status: LIMITES[original.canal as keyof typeof LIMITES]?.temAnalise ? "rascunho" : "aprovado",
    },
  });
  return NextResponse.json(copia, { status: 201 });
}
