import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST reordena todas as etapas de uma vez — usado só por `reordenarEtapa`. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { etapas } = (await request.json()) as { etapas: { id: string; ordem: number }[] };

  await prisma.$transaction(
    etapas.map((e) =>
      prisma.tarefaEtapa.updateMany({ where: { id: e.id, workspaceId }, data: { ordem: e.ordem } }),
    ),
  );

  return NextResponse.json({ ok: true });
}
