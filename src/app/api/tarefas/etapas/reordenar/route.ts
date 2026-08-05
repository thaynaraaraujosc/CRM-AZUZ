import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** POST reordena todas as etapas de uma vez — usado só por `reordenarEtapa`. */
export async function POST(request: Request) {
  const { etapas } = (await request.json()) as { etapas: { id: string; ordem: number }[] };

  await prisma.$transaction(
    etapas.map((e) => prisma.tarefaEtapa.update({ where: { id: e.id }, data: { ordem: e.ordem } })),
  );

  return NextResponse.json({ ok: true });
}
