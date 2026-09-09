import { NextResponse } from "next/server";

import type { VersaoFluxo } from "@/lib/automation-flow/types";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * As versões publicadas de uma automação, da tabela `VersaoAutomacao`.
 *
 * A tabela é a fonte da verdade: é dela que o motor executa. O editor lia de outro lugar (o Json
 * `historicoVersoes` dentro do próprio fluxo), e as duas listas podiam divergir — o histórico
 * mostrava uma coisa e o cliente recebia outra. Com esta rota, a tela e o motor olham o mesmo
 * lugar.
 *
 * O Json continua sendo escrito por enquanto: fluxos publicados antes desta rota só têm as versões
 * lá, e apagá-lo agora perderia esse histórico.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const fluxo = await prisma.fluxoAutomacao.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { id: true, historicoVersoes: true },
  });
  if (!fluxo) return NextResponse.json({ erro: "Automação não encontrada" }, { status: 404 });

  const linhas = await prisma.versaoAutomacao.findMany({
    where: { workspaceId: sessao.user.workspaceId, fluxoId: id },
    orderBy: { versao: "desc" },
  });

  const daTabela: VersaoFluxo[] = linhas.map((l) => ({
    versao: l.versao,
    publicadoEm: l.publicadoEm.toISOString(),
    publicadoPor: l.publicadoPor ?? "",
    nodes: l.nodes as VersaoFluxo["nodes"],
    edges: l.edges as VersaoFluxo["edges"],
    configuracoes: l.configuracoes as VersaoFluxo["configuracoes"],
  }));

  // Versões que só existem no formato antigo entram junto, marcadas pela ausência na tabela. Sem
  // isto, quem publicou antes desta rota veria o histórico "sumir".
  const jaNaTabela = new Set(daTabela.map((v) => v.versao));
  const doJson = (Array.isArray(fluxo.historicoVersoes) ? fluxo.historicoVersoes : []) as VersaoFluxo[];
  const antigas = doJson.filter((v) => v && typeof v.versao === "number" && !jaNaTabela.has(v.versao));

  return NextResponse.json([...daTabela, ...antigas].sort((a, b) => b.versao - a.versao), {
    headers: { "cache-control": "no-store" },
  });
}
