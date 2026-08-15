import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";

/** GET agrega números da plataforma inteira (todos os workspaces) pro dashboard do super-admin:
 * totais, MRR (soma das assinaturas ativas) e crescimento de workspaces nos últimos 6 meses. Tudo
 * calculado na hora — não guarda nada derivado no banco. */
export async function GET() {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const [totalWorkspaces, totalMembros, membrosAtivos, assinaturas] = await Promise.all([
    prisma.workspace.count(),
    prisma.membro.count(),
    prisma.membro.count({ where: { ativo: true } }),
    prisma.assinatura.findMany({ select: { status: true, valor: true } }),
  ]);

  const mrr = assinaturas.filter((a) => a.status === "ativa").reduce((soma, a) => soma + Number(a.valor), 0);

  const porStatus: Record<string, number> = {};
  for (const a of assinaturas) {
    porStatus[a.status] = (porStatus[a.status] ?? 0) + 1;
  }

  // Crescimento — workspaces criados por mês, últimos 6 meses (incluindo o atual).
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 5);
  seisMesesAtras.setDate(1);
  seisMesesAtras.setHours(0, 0, 0, 0);

  const workspacesRecentes = await prisma.workspace.findMany({
    where: { criadoEm: { gte: seisMesesAtras } },
    select: { criadoEm: true },
  });

  const crescimento: { mes: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const referencia = new Date();
    referencia.setMonth(referencia.getMonth() - i);
    const chave = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, "0")}`;
    const total = workspacesRecentes.filter((w) => {
      const d = w.criadoEm;
      return d.getFullYear() === referencia.getFullYear() && d.getMonth() === referencia.getMonth();
    }).length;
    crescimento.push({ mes: chave, total });
  }

  return NextResponse.json({
    totalWorkspaces,
    totalMembros,
    membrosAtivos,
    totalAssinaturas: assinaturas.length,
    mrr,
    porStatus,
    crescimento,
  });
}
