import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Saúde da integração do Instagram: o que chegou e o que falhou.
 *
 * Existe porque falha de automação era invisível. Um token vencido ou um limite de chamadas da
 * Meta parava as respostas automáticas em silêncio — o log ficava no servidor, onde a dona do CRM
 * não olha, e o primeiro sinal era o cliente reclamando que ninguém respondeu.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [porTipo, falhas, ultimo] = await Promise.all([
    prisma.instagramEvento.groupBy({
      by: ["tipo"],
      where: { workspaceId, criadoEm: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.instagramEvento.findMany({
      where: { workspaceId, erro: { not: null } },
      orderBy: { criadoEm: "desc" },
      take: 10,
      select: { id: true, tipo: true, erro: true, criadoEm: true },
    }),
    prisma.instagramEvento.findFirst({
      where: { workspaceId },
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true, tipo: true },
    }),
  ]);

  return NextResponse.json(
    {
      ultimoEvento: ultimo ? { tipo: ultimo.tipo, quando: ultimo.criadoEm.toISOString() } : null,
      seteDias: porTipo.map((t) => ({ tipo: t.tipo, quantidade: t._count._all })),
      falhas: falhas.map((f) => ({
        id: f.id,
        tipo: f.tipo,
        erro: f.erro,
        quando: f.criadoEm.toISOString(),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
