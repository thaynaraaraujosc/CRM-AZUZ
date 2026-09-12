import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { PLANOS } from "@/lib/assinatura/planos";

/** GET traz o workspace inteiro: membros (com papel/permissões), integrações conectadas e a
 * assinatura: a "visão 360°" de uma empresa cliente pro super-admin. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/workspaces/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id } = await ctx.params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    // Lista fechada nos dois pontos sensíveis. `membros: true` trazia o hash da senha de cada
    // pessoa, e `integracoes: true` trazia os tokens criptografados da Meta. Mesmo numa tela de
    // super-admin, o que não trafega não vaza: nem por log, nem por cache, nem por aba esquecida
    // aberta. A tela precisa de quem é quem e do que está conectado, não dos segredos.
    include: {
      membros: {
        orderBy: { criadoEm: "asc" },
        select: {
          id: true,
          nome: true,
          email: true,
          papel: true,
          papelTipo: true,
          permissoes: true,
          ativo: true,
          convitePendente: true,
          criadoEm: true,
          ultimoAcesso: true,
        },
      },
      integracoes: {
        select: { id: true, provedor: true, status: true, erroMensagem: true, atualizadoEm: true },
      },
      assinatura: true,
    },
  });
  if (!workspace) return NextResponse.json({ erro: "Workspace não encontrado" }, { status: 404 });

  return NextResponse.json(workspace);
}

type CorpoAtualizarWorkspace = {
  assinatura?: { status?: string };
};

/**
 * PATCH altera o status da assinatura de um workspace **direto no banco**, sem chamar a Asaas:
 * é uma sobrescrita manual do super-admin (ex.: cortesia, correção de um caso, bloqueio manual),
 * não substitui o fluxo de cobrança real. Plano é sempre "completo" (plano único do CRM. Ver
 * `src/lib/assinatura/planos.ts`), não tem o que escolher aqui.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/workspaces/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id: workspaceId } = await ctx.params;
  const corpo = (await request.json()) as CorpoAtualizarWorkspace;

  const status = corpo.assinatura?.status;
  if (!status) return NextResponse.json({ erro: "Nada para atualizar." }, { status: 400 });
  if (!["pendente", "ativa", "atrasada", "cancelada"].includes(status)) {
    return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
  }

  const assinatura = await prisma.assinatura.upsert({
    where: { workspaceId },
    create: {
      id: `assinatura-${workspaceId}`,
      workspaceId,
      plano: "completo",
      valor: PLANOS.completo.valor,
      status,
      asaasCustomerId: "",
    },
    update: { status },
  });

  return NextResponse.json({ assinatura });
}
