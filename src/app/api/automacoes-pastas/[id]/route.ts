import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Renomear e apagar uma pasta. Apagar NÃO apaga os robôs: eles voltam pra raiz. */
export async function PUT(request: Request, ctx: RouteContext<"/api/automacoes-pastas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const corpo = (await request.json()) as { nome?: string };
  const nome = (corpo.nome ?? "").trim();
  if (!nome) return NextResponse.json({ erro: "Dê um nome à pasta." }, { status: 400 });

  // `updateMany` com o workspace no filtro: uma pasta de outra conta simplesmente não é
  // encontrada, em vez de ser encontrada e recusada depois.
  const { count } = await prisma.pastaAutomacao.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: { nome },
  });
  if (!count) return NextResponse.json({ erro: "Pasta não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/automacoes-pastas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.pastaAutomacao.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (!count) return NextResponse.json({ erro: "Pasta não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
