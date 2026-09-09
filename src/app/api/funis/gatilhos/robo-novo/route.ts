import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Cria um robô VAZIO e devolve o id, pra a grade do funil abrir o editor nele.
 *
 * É o "+ Criar novo robô" do painel de gatilho. Existe pra não haver dois caminhos de criação: o
 * robô nasce como um `FluxoAutomacao` comum, na mesma tabela e com a mesma forma dos que a aba
 * Automações lista. Quem cria pelo funil e quem cria pela biblioteca criam a MESMA coisa, e é por
 * isso que o robô aparece nos dois lugares sem ninguém sincronizar nada.
 *
 * Nasce sem bloco de gatilho de propósito: quem dispara é a etapa. O motor sabe começar um fluxo
 * assim (o início é o único nó em que ninguém entra).
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { nome } = (await request.json().catch(() => ({}))) as { nome?: string };

  const linha = await prisma.fluxoAutomacao.create({
    data: {
      id: `fluxo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: sessao.user.workspaceId,
      nome: nome?.trim() || "Novo robô",
      status: "rascunho",
      ativa: false,
      arquivada: false,
      nodes: [],
      edges: [],
      versaoAtual: 0,
      configuracoes: {},
      execucoes: 0,
      historicoVersoes: [],
      modeloDemonstracao: false,
    },
    select: { id: true, nome: true },
  });

  return NextResponse.json(linha, { status: 201 });
}
