import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AcaoDados, GatilhoEtapaVisao, TipoAcaoGatilho } from "@/lib/funil/gatilhos-etapa-tipos";

/** PATCH altera um gatilho de etapa. DELETE remove. Os dois só enxergam o próprio workspace. */

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const existe = await prisma.gatilhoEtapa.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { id: true, grupoId: true },
  });
  // Mesma resposta pra "não existe" e "não é seu": a diferença entre as duas contaria a quem
  // tentou que o id existe em algum lugar.
  if (!existe) return NextResponse.json({ erro: "Gatilho não encontrado" }, { status: 404 });

  const patch = (await request.json()) as Partial<GatilhoEtapaVisao>;
  /*
   * NUMA FAIXA, A EDIÇÃO VALE PRA TODAS AS IRMÃS.
   *
   * A faixa é UMA coisa na tela — um retângulo com um texto —, e desligar só o pedaço de uma
   * etapa daria uma faixa meio ligada meio desligada, que não tem como ser desenhada nem
   * explicada. Quem quiser etapas com comportamentos diferentes cria gatilhos separados.
   */
  const alvo = existe.grupoId
    ? { workspaceId: sessao.user.workspaceId, grupoId: existe.grupoId }
    : { id };
  const dadosDoPatch = {
      ...(patch.quando ? { quando: patch.quando } : {}),
      ...(patch.tipoAcao ? { tipoAcao: patch.tipoAcao } : {}),
      // `fluxoId` entra como null quando a ação deixa de ser de robô: sem isso o gatilho ficaria
      // apontando pro robô antigo, que não roda mais mas continua na tela.
      ...("fluxoId" in patch ? { fluxoId: patch.fluxoId ?? null } : {}),
      ...("acaoDados" in patch ? { acaoDados: patch.acaoDados ?? undefined } : {}),
      ...("condicao" in patch ? { condicao: patch.condicao ?? undefined } : {}),
      ...("diasAtivos" in patch ? { diasAtivos: patch.diasAtivos ?? undefined } : {}),
      ...("horaInicio" in patch ? { horaInicio: patch.horaInicio ?? null } : {}),
      ...("horaFim" in patch ? { horaFim: patch.horaFim ?? null } : {}),
      ...("horarioDiario" in patch ? { horarioDiario: patch.horarioDiario ?? null } : {}),
      ...(typeof patch.ativo === "boolean" ? { ativo: patch.ativo } : {}),
      ...(typeof patch.ordem === "number" ? { ordem: patch.ordem } : {}),
  };

  await prisma.gatilhoEtapa.updateMany({ where: alvo, data: dadosDoPatch });
  const linha = (await prisma.gatilhoEtapa.findUnique({ where: { id } }))!;

  return NextResponse.json({
    ...linha,
    quando: linha.quando as GatilhoEtapaVisao["quando"],
    tipoAcao: (linha.tipoAcao ?? "robo") as TipoAcaoGatilho,
    acaoDados: (linha.acaoDados as AcaoDados) ?? null,
    condicao: (linha.condicao as GatilhoEtapaVisao["condicao"]) ?? null,
    diasAtivos: Array.isArray(linha.diasAtivos) ? (linha.diasAtivos as number[]) : null,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  // Apagar uma faixa apaga a faixa inteira: ela é um retângulo só na tela, e deixar as irmãs
  // para trás daria pedaços órfãos espalhados pelas outras etapas.
  const alvo = await prisma.gatilhoEtapa.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { grupoId: true },
  });
  if (!alvo) return NextResponse.json({ erro: "Gatilho não encontrado" }, { status: 404 });

  const apagados = await prisma.gatilhoEtapa.deleteMany({
    where: alvo.grupoId
      ? { workspaceId: sessao.user.workspaceId, grupoId: alvo.grupoId }
      : { id, workspaceId: sessao.user.workspaceId },
  });
  if (!apagados.count) return NextResponse.json({ erro: "Gatilho não encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
