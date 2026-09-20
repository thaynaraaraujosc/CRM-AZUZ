import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * O estado da devolução de vendas pro Google, pra tela de Rastreamento.
 *
 * Existe porque a devolução acontece sozinha, no cron, sem ninguém pedir. Recurso que roda
 * escondido e não presta contas é indistinguível de recurso quebrado: a pessoa marca a venda como
 * ganha, não vê nada acontecer, e conclui que não funciona. Estes três números são a prestação de
 * contas.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const conexao = await prisma.integracao.findFirst({
    where: { workspaceId, provedor: "google_ads", status: "conectado" },
    select: { id: true },
  });

  const [enviadas, comClique, ultimaFalha] = await Promise.all([
    prisma.origemDoLead.count({ where: { workspaceId, conversaoEnviadaEm: { not: null } } }),
    // Leads que TÊM como ser devolvidos: vieram do Google e trouxeram código de clique. Contar os
    // outros aqui faria parecer que há uma fila parada quando não há nada a fazer.
    prisma.origemDoLead.count({
      where: { workspaceId, plataforma: "google", cliqueId: { not: null }, conversaoEnviadaEm: null },
    }),
    prisma.origemDoLead.findFirst({
      where: { workspaceId, conversaoErro: { not: null } },
      orderBy: { criadoEm: "desc" },
      select: { conversaoErro: true },
    }),
  ]);

  return NextResponse.json(
    {
      googleConectado: Boolean(conexao),
      enviadas,
      aguardandoVenda: comClique,
      ultimoErro: ultimaFalha?.conversaoErro ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
