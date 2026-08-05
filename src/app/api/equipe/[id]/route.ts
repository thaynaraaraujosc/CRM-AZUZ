import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function paraMembro(linha: { permissoes: unknown; [k: string]: unknown }): Membro {
  return {
    ...linha,
    permissoes: Array.isArray(linha.permissoes) ? (linha.permissoes as string[]) : [],
  } as Membro;
}

/** Atualização direta por id — usada por `editarMembro`/`alternarAtivo`. Só mexe em membro do
 * mesmo workspace de quem está logado (senão qualquer id daria pra editar gente de outra empresa). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<Membro> & Record<string, unknown>;

  const { count } = await prisma.membro.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: { ...dados, permissoes: dados.permissoes ?? undefined },
  });
  if (count === 0) {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }

  const linha = await prisma.membro.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(paraMembro(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.membro.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
