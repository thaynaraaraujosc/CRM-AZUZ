import { NextResponse } from "next/server";

import type { FluxoAutomacao } from "@/lib/automation-flow/types";
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

/**
 * GET público (sem `auth()`) usado só por `/formulario-preview` pra disparar o evento
 * "formulario_preenchido" nas automações publicadas do workspace do formulário. Já filtra por
 * `status: "publicado"` + `ativa: true` no servidor (o motor no cliente ia filtrar de novo, mas
 * assim rascunhos/fluxos pausados dessa empresa nem saem do banco pro público).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]/fluxos-automacao">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  const linhas = await prisma.fluxoAutomacao.findMany({
    where: { workspaceId: formulario.workspaceId, status: "publicado", ativa: true },
  });
  return NextResponse.json(linhas.map(paraFluxo));
}
