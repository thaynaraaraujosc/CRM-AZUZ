import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { GatilhoEtapaVisao } from "@/lib/funil/gatilhos-etapa-tipos";

/**
 * Os gatilhos que moram nas etapas do funil.
 *
 * O `workspaceId` nunca vem do cliente: vem da sessão. Um id de etapa de outro workspace não
 * encontra nada, e a resposta é a mesma de uma etapa que não existe.
 */

function paraVisao(linha: {
  id: string;
  funilId: string;
  etapaId: string;
  quando: string;
  fluxoId: string;
  condicao: unknown;
  diasAtivos: unknown;
  horaInicio: string | null;
  horaFim: string | null;
  horarioDiario: string | null;
  ativo: boolean;
  ordem: number;
}): GatilhoEtapaVisao {
  return {
    ...linha,
    quando: linha.quando as GatilhoEtapaVisao["quando"],
    condicao: (linha.condicao as GatilhoEtapaVisao["condicao"]) ?? null,
    diasAtivos: Array.isArray(linha.diasAtivos) ? (linha.diasAtivos as number[]) : null,
  };
}

/** GET lista os gatilhos do workspace. `?funilId=` limita a um funil. */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const funilId = new URL(request.url).searchParams.get("funilId") ?? undefined;
  const linhas = await prisma.gatilhoEtapa.findMany({
    where: { workspaceId: sessao.user.workspaceId, ...(funilId ? { funilId } : {}) },
    orderBy: [{ etapaId: "asc" }, { ordem: "asc" }],
  });

  // O nome do robô junto: a faixa do funil mostra "Executar robô: NOME PACIENTE", e sem isso a
  // tela teria que buscar cada fluxo separado só pra escrever um nome.
  const fluxos = await prisma.fluxoAutomacao.findMany({
    where: { workspaceId: sessao.user.workspaceId, id: { in: linhas.map((l) => l.fluxoId) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(fluxos.map((f) => [f.id, f.nome]));

  return NextResponse.json(
    linhas.map((l) => ({ ...paraVisao(l), fluxoNome: nomePorId.get(l.fluxoId) })),
    { headers: { "cache-control": "no-store" } },
  );
}

/** POST cria um gatilho numa etapa. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const dados = (await request.json()) as Partial<GatilhoEtapaVisao>;
  if (!dados.etapaId || !dados.fluxoId || !dados.quando) {
    return NextResponse.json({ erro: "Faltam etapa, robô ou quando." }, { status: 400 });
  }

  // A etapa e o robô têm que ser DESTE workspace. Sem esta checagem, um id chutado ligaria um
  // gatilho no funil de outro cliente.
  const etapa = await prisma.funilEtapa.findFirst({
    where: { id: dados.etapaId, workspaceId },
    select: { id: true, funilId: true },
  });
  if (!etapa) return NextResponse.json({ erro: "Etapa não encontrada" }, { status: 404 });

  const fluxo = await prisma.fluxoAutomacao.findFirst({
    where: { id: dados.fluxoId, workspaceId },
    select: { id: true },
  });
  if (!fluxo) return NextResponse.json({ erro: "Robô não encontrado" }, { status: 404 });

  const ultimo = await prisma.gatilhoEtapa.findFirst({
    where: { workspaceId, etapaId: etapa.id },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const linha = await prisma.gatilhoEtapa.create({
    data: {
      id: `gat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId,
      funilId: etapa.funilId,
      etapaId: etapa.id,
      quando: dados.quando,
      fluxoId: fluxo.id,
      condicao: dados.condicao ?? undefined,
      diasAtivos: dados.diasAtivos ?? undefined,
      horaInicio: dados.horaInicio ?? null,
      horaFim: dados.horaFim ?? null,
      horarioDiario: dados.horarioDiario ?? null,
      ativo: dados.ativo ?? true,
      ordem: (ultimo?.ordem ?? -1) + 1,
    },
  });

  return NextResponse.json(paraVisao(linha), { status: 201 });
}
