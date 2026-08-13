import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";

/** GET lista todos os workspaces da plataforma (cross-tenant, só o super-admin chega aqui) com o
 * essencial pra tabela: quantos membros, plano/status da assinatura, quando foi criado. */
export async function GET() {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const workspaces = await prisma.workspace.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      _count: { select: { membros: true } },
      assinatura: { select: { plano: true, status: true, valor: true, proximoVencimento: true } },
    },
  });

  return NextResponse.json(workspaces);
}
