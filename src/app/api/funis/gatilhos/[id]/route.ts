import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { GatilhoEtapaVisao } from "@/lib/funil/gatilhos-etapa-tipos";

/** PATCH altera um gatilho de etapa. DELETE remove. Os dois só enxergam o próprio workspace. */

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const existe = await prisma.gatilhoEtapa.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { id: true },
  });
  // Mesma resposta pra "não existe" e "não é seu": a diferença entre as duas contaria a quem
  // tentou que o id existe em algum lugar.
  if (!existe) return NextResponse.json({ erro: "Gatilho não encontrado" }, { status: 404 });

  const patch = (await request.json()) as Partial<GatilhoEtapaVisao>;
  const linha = await prisma.gatilhoEtapa.update({
    where: { id },
    data: {
      ...(patch.quando ? { quando: patch.quando } : {}),
      ...(patch.fluxoId ? { fluxoId: patch.fluxoId } : {}),
      ...("condicao" in patch ? { condicao: patch.condicao ?? undefined } : {}),
      ...("diasAtivos" in patch ? { diasAtivos: patch.diasAtivos ?? undefined } : {}),
      ...("horaInicio" in patch ? { horaInicio: patch.horaInicio ?? null } : {}),
      ...("horaFim" in patch ? { horaFim: patch.horaFim ?? null } : {}),
      ...("horarioDiario" in patch ? { horarioDiario: patch.horarioDiario ?? null } : {}),
      ...(typeof patch.ativo === "boolean" ? { ativo: patch.ativo } : {}),
      ...(typeof patch.ordem === "number" ? { ordem: patch.ordem } : {}),
    },
  });

  return NextResponse.json({
    ...linha,
    quando: linha.quando as GatilhoEtapaVisao["quando"],
    condicao: (linha.condicao as GatilhoEtapaVisao["condicao"]) ?? null,
    diasAtivos: Array.isArray(linha.diasAtivos) ? (linha.diasAtivos as number[]) : null,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const apagados = await prisma.gatilhoEtapa.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (!apagados.count) return NextResponse.json({ erro: "Gatilho não encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
