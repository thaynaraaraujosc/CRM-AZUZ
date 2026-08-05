import { NextResponse } from "next/server";

import type { TaskCard } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Atualização direta por id — usada por `editarTarefa`/`concluirTarefa`. Aceita tanto os campos
 * planos de `TaskCard` quanto `etapaId`/`ordem` (só usados quando a tarefa muda de etapa, ex.:
 * concluir joga na etapa "Concluídas"). Só mexe em card do mesmo workspace de quem está logado.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tarefas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<TaskCard> & {
    etapaId?: string;
    ordem?: number;
  };

  const { responsavel, anexo, contatoId, urgencia, ...resto } = body;
  const { count } = await prisma.tarefaCard.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: {
      ...resto,
      contatoId: contatoId ?? undefined,
      urgencia: urgencia ?? undefined,
      ...(responsavel
        ? { responsavelNome: responsavel.nome, responsavelInitials: responsavel.initials }
        : {}),
      ...(anexo !== undefined
        ? { anexoArquivo: anexo?.arquivo ?? null, anexoDetalhe: anexo?.detalhe ?? null }
        : {}),
    },
  });
  if (count === 0) return NextResponse.json({ erro: "Tarefa não encontrada" }, { status: 404 });

  const linha = await prisma.tarefaCard.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(linha);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tarefas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.tarefaCard.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Tarefa não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
