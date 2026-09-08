import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * O histórico de execuções de um fluxo — o que aconteceu, com quem, e onde parou.
 *
 * Até agora não existia: o motor antigo só imprimia a contagem de passos no log do servidor, então
 * quando uma automação não respondia um cliente ninguém tinha como saber por quê. É a pergunta mais
 * comum sobre automação ("rodou? parou onde?") e ela não tinha resposta.
 *
 * Traz as últimas execuções com os passos de cada uma. `erroTecnico` fica de fora da listagem: ele
 * é pra investigação e pode carregar o corpo de erro de um provedor externo.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/automacoes-fluxos/[id]/execucoes">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { id } = await ctx.params;
  const limite = Math.min(Number(new URL(request.url).searchParams.get("limite") ?? 20) || 20, 50);

  const execucoes = await prisma.execucaoAutomacao.findMany({
    where: { workspaceId, fluxoId: id },
    orderBy: { iniciadaEm: "desc" },
    take: limite,
  });

  const passos = execucoes.length
    ? await prisma.passoAutomacao.findMany({
        where: { workspaceId, execucaoId: { in: execucoes.map((e) => e.id) } },
        orderBy: { criadoEm: "asc" },
        select: { execucaoId: true, noId: true, noTipo: true, titulo: true, resultado: true, detalhe: true, criadoEm: true },
      })
    : [];

  const porExecucao = new Map<string, typeof passos>();
  for (const passo of passos) {
    const lista = porExecucao.get(passo.execucaoId) ?? [];
    lista.push(passo);
    porExecucao.set(passo.execucaoId, lista);
  }

  return NextResponse.json(
    execucoes.map((e) => ({
      id: e.id,
      contatoNome: e.contatoNome,
      gatilho: e.gatilho,
      situacao: e.situacao,
      iniciadaEm: e.iniciadaEm.toISOString(),
      finalizadaEm: e.finalizadaEm?.toISOString() ?? null,
      aguardandoAte: e.aguardandoAte?.toISOString() ?? null,
      aguardandoEvento: e.aguardandoEvento,
      erroMensagem: e.erroMensagem,
      passos: (porExecucao.get(e.id) ?? []).map((p) => ({
        noId: p.noId,
        noTipo: p.noTipo,
        titulo: p.titulo,
        resultado: p.resultado,
        detalhe: p.detalhe,
        em: p.criadoEm.toISOString(),
      })),
    })),
    { headers: { "cache-control": "no-store" } },
  );
}
