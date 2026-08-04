import { NextResponse } from "next/server";

import type { Contato } from "@/lib/data";
import { prisma } from "@/lib/prisma";

function paraContato(linha: { etiquetas: unknown; [k: string]: unknown }): Contato {
  return {
    ...linha,
    etiquetas: Array.isArray(linha.etiquetas) ? (linha.etiquetas as string[]) : undefined,
  } as Contato;
}

/** Atualização direta por id — usada por `adicionarEtiqueta`/`removerEtiqueta`/`alternarFavorito`,
 * que hoje calculam o próximo valor no cliente e mandam o campo já pronto pra gravar. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/contatos/[id]">) {
  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<Contato> & Record<string, unknown>;

  const linha = await prisma.contato.update({
    where: { id },
    data: { ...dados, etiquetas: dados.etiquetas ?? undefined },
  });
  return NextResponse.json(paraContato(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/contatos/[id]">) {
  const { id } = await ctx.params;
  await prisma.contato.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
