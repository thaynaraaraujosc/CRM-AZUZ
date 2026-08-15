import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";

/** GET lista todo mundo que tem login no CRM, de qualquer workspace — "todos os usuários" que o
 * super-admin pediu pra enxergar num lugar só. */
export async function GET() {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const membros = await prisma.membro.findMany({
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      papelTipo: true,
      ativo: true,
      convitePendente: true,
      criadoEm: true,
      workspace: { select: { id: true, nome: true } },
    },
  });

  return NextResponse.json(membros);
}
