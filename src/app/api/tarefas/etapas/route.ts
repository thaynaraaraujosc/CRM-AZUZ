import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST cria uma etapa nova, sempre no final — mesma semântica de `criarEtapa` no Context. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { titulo } = (await request.json()) as { titulo: string };
  if (!titulo?.trim()) {
    return NextResponse.json({ erro: "Campo obrigatório: titulo" }, { status: 400 });
  }

  const ultima = await prisma.tarefaEtapa.findFirst({ where: { workspaceId }, orderBy: { ordem: "desc" } });
  const etapa = await prisma.tarefaEtapa.create({
    data: { id: `etapa-${Date.now()}`, workspaceId, titulo: titulo.trim(), ordem: (ultima?.ordem ?? -1) + 1 },
  });

  return NextResponse.json(etapa, { status: 201 });
}
