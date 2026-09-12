import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { formularioUsaCampo } from "@/lib/formularios/campos-do-formulario";

/** Teto de nomes devolvidos. Um seletor com mais que isso já é inutilizável na tela, e sem teto a
 * rota vira um jeito barato de baixar a base inteira de uma empresa numa chamada só. */
const MAXIMO = 500;

/**
 * GET público (sem `auth()`: lead externo não tem sessão) usado por `/f/[id]` pra popular o
 * seletor de "contato já existente".
 *
 * SÓ responde quando o formulário realmente tem um campo do tipo `contato`. Antes devolvia a lista
 * de nomes de todos os contatos do workspace pra qualquer pessoa com o id do formulário, e esse id
 * está no link que o cliente divulga: era a carteira de clientes inteira exposta, inclusive em
 * formulário que não usa esse campo pra nada. Formulário sem o campo agora recebe lista vazia, que
 * é o que ele sempre precisou.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]/contatos-sugeridos">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({
    where: { id },
    select: { workspaceId: true, paginas: true },
  });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  if (!formularioUsaCampo(formulario.paginas, "contato")) return NextResponse.json([]);

  const contatos = await prisma.contato.findMany({
    where: { workspaceId: formulario.workspaceId },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: MAXIMO,
  });
  return NextResponse.json(contatos);
}
