import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * GET público (sem `auth()` — lead externo não tem sessão) usado só por `/formulario-preview` pra
 * popular a busca de "contato já existente". Resolve o workspace a partir do formulário (nunca de
 * uma sessão) e devolve só `{id, nome}` — nem essa página nem o público que a acessa precisam do
 * contato inteiro (e-mail/whatsapp/etc.), só do nome pra buscar/selecionar.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]/contatos-sugeridos">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  const contatos = await prisma.contato.findMany({
    where: { workspaceId: formulario.workspaceId },
    select: { id: true, nome: true },
  });
  return NextResponse.json(contatos);
}
