import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function paraFluxo(linha: {
  nodes: unknown;
  edges: unknown;
  configuracoes: unknown;
  historicoVersoes: unknown;
  [k: string]: unknown;
}): FluxoAutomacao {
  return {
    ...linha,
    nodes: linha.nodes as FluxoAutomacao["nodes"],
    edges: linha.edges as FluxoAutomacao["edges"],
    configuracoes: linha.configuracoes as FluxoAutomacao["configuracoes"],
    historicoVersoes: linha.historicoVersoes as FluxoAutomacao["historicoVersoes"],
  } as FluxoAutomacao;
}

/** Atualização por id — usada pelo helper `tocarFluxo()` do Context, que centraliza todo mutador
 * que edita um fluxo existente (rascunho, publicação, restaurar versão, arquivar, ativar...). Só
 * mexe em fluxo do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/automacoes-fluxos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<FluxoAutomacao>;
  // id/criadoEm/atualizadoEm são geridos pelo banco (PK e @updatedAt) — nunca vêm do front.
  const dados: Partial<FluxoAutomacao> = { ...body };
  delete dados.id;
  delete dados.criadoEm;
  delete dados.atualizadoEm;

  const { count } = await prisma.fluxoAutomacao.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: {
      ...dados,
      nodes: dados.nodes as Prisma.InputJsonValue | undefined,
      edges: dados.edges as Prisma.InputJsonValue | undefined,
      configuracoes: dados.configuracoes as Prisma.InputJsonValue | undefined,
      historicoVersoes: dados.historicoVersoes as Prisma.InputJsonValue | undefined,
      publicadoEm: dados.publicadoEm ? new Date(dados.publicadoEm) : undefined,
    },
  });
  if (count === 0) return NextResponse.json({ erro: "Fluxo não encontrado" }, { status: 404 });

  const linha = await prisma.fluxoAutomacao.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(paraFluxo(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/automacoes-fluxos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.fluxoAutomacao.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Fluxo não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
