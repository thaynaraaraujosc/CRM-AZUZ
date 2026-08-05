import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** POST cria uma etapa nova, sempre no final — mesma semântica de `criarEtapa` no Context. */
export async function POST(request: Request) {
  const { titulo } = (await request.json()) as { titulo: string };
  if (!titulo?.trim()) {
    return NextResponse.json({ erro: "Campo obrigatório: titulo" }, { status: 400 });
  }

  const ultima = await prisma.tarefaEtapa.findFirst({ orderBy: { ordem: "desc" } });
  const etapa = await prisma.tarefaEtapa.create({
    data: { id: `etapa-${Date.now()}`, titulo: titulo.trim(), ordem: (ultima?.ordem ?? -1) + 1 },
  });

  return NextResponse.json(etapa, { status: 201 });
}
