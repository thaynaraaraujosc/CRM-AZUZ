import { NextResponse } from "next/server";

import type { TaskCard } from "@/lib/data";
import { prisma } from "@/lib/prisma";

/**
 * Atualização direta por id — usada por `editarTarefa`/`concluirTarefa`. Aceita tanto os campos
 * planos de `TaskCard` quanto `etapaId`/`ordem` (só usados quando a tarefa muda de etapa, ex.:
 * concluir joga na etapa "Concluídas").
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tarefas/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<TaskCard> & {
    etapaId?: string;
    ordem?: number;
  };

  const { responsavel, anexo, contatoId, urgencia, ...resto } = body;
  const linha = await prisma.tarefaCard.update({
    where: { id },
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
  return NextResponse.json(linha);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tarefas/[id]">) {
  const { id } = await ctx.params;
  await prisma.tarefaCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
