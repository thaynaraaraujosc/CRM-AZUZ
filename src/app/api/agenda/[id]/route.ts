import { NextResponse } from "next/server";

import type { Compromisso } from "@/lib/agenda-context";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Atualização direta por id — usada por `editarAgendamento`/`reagendar`/`cancelar`/`concluir`. Só
 * mexe em compromisso do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/agenda/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<Compromisso>;

  const { count } = await prisma.compromisso.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: dados,
  });
  if (count === 0) return NextResponse.json({ erro: "Compromisso não encontrado" }, { status: 404 });

  const linha = await prisma.compromisso.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(linha as Compromisso);
}
