import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { cortesiaValendo, statusEfetivo } from "@/lib/assinatura/cortesia";

/** GET agrega números da plataforma inteira (todos os workspaces) pro dashboard do super-admin:
 * totais, MRR (soma das assinaturas ativas) e crescimento de workspaces nos últimos 6 meses. Tudo
 * calculado na hora: não guarda nada derivado no banco. */
export async function GET() {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const [totalWorkspaces, totalMembros, membrosAtivos, assinaturas] = await Promise.all([
    prisma.workspace.count(),
    prisma.membro.count(),
    prisma.membro.count({ where: { ativo: true } }),
    prisma.assinatura.findMany({
      select: { status: true, valor: true, cortesiaAte: true, asaasSubscriptionId: true },
    }),
  ]);

  /*
   * O MRR CONTA SÓ QUEM PAGA DE VERDADE.
   *
   * Antes era "toda assinatura com status ativa", e o painel dizia R$ 788 de receita mensal sem
   * nada ter sido vendido: conta de cortesia e conta de teste nascem com status "ativa" de
   * propósito, porque é isso que libera o produto pra elas. Um número de receita que inclui quem
   * não paga não é um número aproximado — ele responde errado à única pergunta que justifica
   * existir.
   *
   * Pagante é quem tem assinatura de verdade na Asaas (`asaasSubscriptionId`) e não está em
   * cortesia. Cortesia e teste aparecem contados à parte, porque saber quantas contas usam o CRM
   * de graça também é informação — só não é receita.
   */
  const ehPagante = (a: (typeof assinaturas)[number]) =>
    statusEfetivo(a) === "ativa" && Boolean(a.asaasSubscriptionId?.trim()) && !cortesiaValendo(a);

  const pagantes = assinaturas.filter(ehPagante);
  const mrr = pagantes.reduce((soma, a) => soma + Number(a.valor), 0);
  const emCortesia = assinaturas.filter((a) => cortesiaValendo(a)).length;
  const liberadasSemCobranca = assinaturas.filter(
    (a) => statusEfetivo(a) === "ativa" && !a.asaasSubscriptionId?.trim(),
  ).length;

  const porStatus: Record<string, number> = {};
  for (const a of assinaturas) {
    const efetivo = statusEfetivo(a);
    porStatus[efetivo] = (porStatus[efetivo] ?? 0) + 1;
  }

  // Crescimento: workspaces criados por mês, últimos 6 meses (incluindo o atual).
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
    /** Quantas contas pagam de verdade. É o par do MRR: receita sem contagem não se confere. */
    pagantes: pagantes.length,
    emCortesia,
    liberadasSemCobranca,
    porStatus,
    crescimento,
  });
}
