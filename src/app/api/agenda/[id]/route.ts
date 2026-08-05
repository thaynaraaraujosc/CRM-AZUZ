import { NextResponse } from "next/server";

import type { Compromisso } from "@/lib/agenda-context";
import { prisma } from "@/lib/prisma";

/** Atualização direta por id — usada por `editarAgendamento`/`reagendar`/`cancelar`/`concluir`. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/agenda/[id]">) {
  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<Compromisso>;

  const linha = await prisma.compromisso.update({ where: { id }, data: dados });
  return NextResponse.json(linha as Compromisso);
}
