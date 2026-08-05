import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * POST reposiciona vários cards de uma vez — usado só por `moverTarefaPara`, que já resolve
 * localmente (por splice) a nova ordem de todos os cards afetados nas etapas de origem/destino.
 * Recebe a lista final `{id, etapaId, ordem, concluida?, atrasada?}` e só grava.
 */
export async function POST(request: Request) {
  const { cards } = (await request.json()) as {
    cards: { id: string; etapaId: string; ordem: number; concluida?: boolean; atrasada?: boolean }[];
  };

  await prisma.$transaction(
    cards.map((c) =>
      prisma.tarefaCard.update({
        where: { id: c.id },
        data: { etapaId: c.etapaId, ordem: c.ordem, concluida: c.concluida, atrasada: c.atrasada },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
