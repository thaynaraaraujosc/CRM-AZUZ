import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Pastas de automação. Um nível só, por área.
 *
 * O `workspaceId` vem SEMPRE da sessão, nunca do corpo: é o que impede uma conta de criar ou
 * renomear pasta na conta de outra pessoa mandando um id qualquer.
 */
export type PastaSalva = { id: string; nome: string; area: string; total: number };

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const area = new URL(request.url).searchParams.get("area") ?? "social";
  const pastas = await prisma.pastaAutomacao.findMany({
    where: { workspaceId: sessao.user.workspaceId, area },
    orderBy: { nome: "asc" },
    include: { _count: { select: { fluxos: true } } },
  });

  return NextResponse.json(
    pastas.map((p): PastaSalva => ({ id: p.id, nome: p.nome, area: p.area, total: p._count.fluxos })),
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = (await request.json()) as { nome?: string; area?: string };
  const nome = (corpo.nome ?? "").trim();
  if (!nome) return NextResponse.json({ erro: "Dê um nome à pasta." }, { status: 400 });

  const pasta = await prisma.pastaAutomacao.create({
    data: {
      id: `pasta-${sessao.user.workspaceId}-${Date.now()}`,
      workspaceId: sessao.user.workspaceId,
      nome,
      area: corpo.area === "comercial" ? "comercial" : "social",
    },
  });
  return NextResponse.json({ id: pasta.id, nome: pasta.nome, area: pasta.area, total: 0 }, { status: 201 });
}
