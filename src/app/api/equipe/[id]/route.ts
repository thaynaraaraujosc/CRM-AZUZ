import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { prisma } from "@/lib/prisma";

function paraMembro(linha: { permissoes: unknown; [k: string]: unknown }): Membro {
  return {
    ...linha,
    permissoes: Array.isArray(linha.permissoes) ? (linha.permissoes as string[]) : [],
  } as Membro;
}

/** Atualização direta por id — usada por `editarMembro`/`alternarAtivo`. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<Membro> & Record<string, unknown>;

  const linha = await prisma.membro.update({
    where: { id },
    data: { ...dados, permissoes: dados.permissoes ?? undefined },
  });
  return NextResponse.json(paraMembro(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const { id } = await ctx.params;
  await prisma.membro.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
