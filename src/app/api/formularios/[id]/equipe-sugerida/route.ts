import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * GET público (sem `auth()`) usado só por `/formulario-preview` pra popular a lista de
 * "responsável" nos campos que atribuem o lead a alguém da equipe. Resolve o workspace a partir do
 * formulário e devolve só `{id, nome}` dos membros ativos — nunca a equipe inteira do sistema.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]/equipe-sugerida">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  const membros = await prisma.membro.findMany({
    where: { workspaceId: formulario.workspaceId, ativo: true },
    select: { id: true, nome: true },
  });
  return NextResponse.json(membros);
}
