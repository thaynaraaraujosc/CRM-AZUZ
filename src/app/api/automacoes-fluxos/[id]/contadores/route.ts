import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Quantas vezes cada bloco do fluxo já rodou. É o "Lançamentos: 585.7k / 100%" em cima do passo.
 *
 * O número é o de EXECUÇÕES DISTINTAS que passaram pelo bloco, não o de linhas de histórico: um
 * bloco que foi tentado de novo depois de uma falha gera duas linhas e continua sendo uma pessoa
 * que passou por ali. Contar linhas faria o bloco com mais problema parecer o mais usado.
 *
 * A porcentagem é contra o primeiro passo do fluxo, que é o 100%: é assim que se enxerga onde as
 * pessoas param de avançar.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const fluxo = await prisma.fluxoAutomacao.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { id: true },
  });
  if (!fluxo) return NextResponse.json({ erro: "Automação não encontrada" }, { status: 404 });

  // Consulta crua porque é `COUNT(DISTINCT ...)`, que o `groupBy` do Prisma não faz: ele só
  // conta linhas, e um bloco tentado de novo depois de falhar viraria duas passagens.
  const linhas = await prisma.$queryRaw<{ noId: string; total: bigint }[]>`
    SELECT p.noId AS noId, COUNT(DISTINCT p.execucaoId) AS total
    FROM PassoAutomacao p
    JOIN ExecucaoAutomacao e ON e.id = p.execucaoId
    WHERE p.workspaceId = ${sessao.user.workspaceId} AND e.fluxoId = ${fluxo.id}
    GROUP BY p.noId
  `;

  const porNo: Record<string, number> = {};
  // BigInt não passa por JSON.stringify; o COUNT do MySQL volta como BigInt.
  for (const linha of linhas) porNo[linha.noId] = Number(linha.total);

  return NextResponse.json({ porNo }, { headers: { "cache-control": "no-store" } });
}
