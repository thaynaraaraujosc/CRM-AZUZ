import { NextResponse } from "next/server";

import type { Contato } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function paraContato(linha: { etiquetas: unknown; [k: string]: unknown }): Contato {
  return {
    ...linha,
    etiquetas: Array.isArray(linha.etiquetas) ? (linha.etiquetas as string[]) : undefined,
  } as Contato;
}

/** Atualização direta por id — usada por `adicionarEtiqueta`/`removerEtiqueta`/`alternarFavorito`,
 * que hoje calculam o próximo valor no cliente e mandam o campo já pronto pra gravar. Só mexe em
 * contato do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/contatos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<Contato> & Record<string, unknown>;

  const { count } = await prisma.contato.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: { ...dados, etiquetas: dados.etiquetas ?? undefined },
  });
  if (count === 0) return NextResponse.json({ erro: "Contato não encontrado" }, { status: 404 });

  const linha = await prisma.contato.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(paraContato(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/contatos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.contato.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Contato não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
