import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { simularContinuacao, simularInicio, type EstadoSimulacao } from "@/lib/automacoes/simular";
import type { FlowEdge, FlowNode } from "@/lib/automation-flow/types";

/**
 * O botão "Testar" — roda o motor de verdade em modo seco, no servidor.
 *
 * Roda o RASCUNHO (o que está aberto no editor), não a versão publicada: testar serve pra ver o
 * que você acabou de montar. E é modo seco de ponta a ponta — nada é enviado, nada é gravado no
 * contato, no funil ou na tabela de execuções.
 *
 * O estado da simulação vai e volta no corpo da requisição, então cada continuação é independente
 * e nada precisa ficar guardado no meio.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/automacoes-fluxos/[id]/simular">) {
  const sessao = await auth();
  const workspaceId = sessao?.user?.workspaceId;
  if (!workspaceId) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const fluxo = await prisma.fluxoAutomacao.findFirst({ where: { id, workspaceId } });
  if (!fluxo) return NextResponse.json({ erro: "Fluxo não encontrado" }, { status: 404 });

  const nodes = (fluxo.nodes ?? []) as FlowNode[];
  const edges = (fluxo.edges ?? []) as FlowEdge[];

  const body = (await request.json()) as {
    contato?: Record<string, unknown>;
    estado?: EstadoSimulacao;
    resposta?: string;
    saida?: string;
  };

  try {
    const estado = body.estado
      ? await simularContinuacao({ estado: body.estado, nodes, edges, resposta: body.resposta, saida: body.saida })
      : await simularInicio({ workspaceId, fluxoId: id, nodes, edges, contato: body.contato ?? {} });
    return NextResponse.json(estado);
  } catch (erro) {
    return NextResponse.json({ erro: erro instanceof Error ? erro.message : "Falha na simulação" }, { status: 400 });
  }
}
