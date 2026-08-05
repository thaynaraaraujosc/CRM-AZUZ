import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST reposiciona vários cards de uma vez — usado só por `moverTarefaPara`, que já resolve
 * localmente (por splice) a nova ordem de todos os cards afetados nas etapas de origem/destino.
 * Recebe a lista final `{id, etapaId, ordem, concluida?, atrasada?}` e só grava. Cada update é
 * filtrado também por `workspaceId` — um id de card de outro workspace simplesmente não casa com
 * nenhuma linha (`updateMany` conta 0), em vez de vazar ou dar erro.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { cards } = (await request.json()) as {
    cards: { id: string; etapaId: string; ordem: number; concluida?: boolean; atrasada?: boolean }[];
  };

  await prisma.$transaction(
    cards.map((c) =>
      prisma.tarefaCard.updateMany({
        where: { id: c.id, workspaceId },
        data: { etapaId: c.etapaId, ordem: c.ordem, concluida: c.concluida, atrasada: c.atrasada },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
