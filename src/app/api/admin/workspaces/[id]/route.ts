import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { PLANOS, ehPlanoValido } from "@/lib/assinatura/planos";

/** GET traz o workspace inteiro: membros (com papel/permissões), integrações conectadas e a
 * assinatura — a "visão 360°" de uma empresa cliente pro super-admin. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/workspaces/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id } = await ctx.params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      membros: { orderBy: { criadoEm: "asc" } },
      integracoes: true,
      assinatura: true,
    },
  });
  if (!workspace) return NextResponse.json({ erro: "Workspace não encontrado" }, { status: 404 });

  return NextResponse.json(workspace);
}

type CorpoAtualizarWorkspace = {
  assinatura?: { plano?: string; status?: string };
};

/**
 * PATCH altera plano/status da assinatura de um workspace **direto no banco**, sem chamar a Asaas
 * — é uma sobrescrita manual do super-admin (ex.: cortesia, correção de um caso, downgrade
 * forçado), não substitui o fluxo de cobrança real. Se o workspace ainda não tem assinatura
 * nenhuma, cria uma sem `asaasCustomerId`/`asaasSubscriptionId` real (o campo fica marcado como
 * "definido pelo admin" implicitamente por não ter esses ids).
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/workspaces/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id: workspaceId } = await ctx.params;
  const corpo = (await request.json()) as CorpoAtualizarWorkspace;

  if (!corpo.assinatura) return NextResponse.json({ erro: "Nada para atualizar." }, { status: 400 });

  const { plano, status } = corpo.assinatura;
  if (plano && !ehPlanoValido(plano)) return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  if (status && !["pendente", "ativa", "atrasada", "cancelada"].includes(status)) {
    return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
  }

  const existente = await prisma.assinatura.findUnique({ where: { workspaceId } });
  const planoFinal = plano ?? existente?.plano ?? "essencial";
  if (!ehPlanoValido(planoFinal)) return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });

  const assinatura = await prisma.assinatura.upsert({
    where: { workspaceId },
    create: {
      id: `assinatura-${workspaceId}`,
      workspaceId,
      plano: planoFinal,
      valor: PLANOS[planoFinal].valor,
      status: status ?? "ativa",
      asaasCustomerId: "",
    },
    update: {
      ...(plano ? { plano, valor: PLANOS[planoFinal].valor } : {}),
      ...(status ? { status } : {}),
    },
  });

  return NextResponse.json({ assinatura });
}
