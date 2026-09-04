import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Reordena os cards DENTRO de cada coluna pela data da última mensagem da conversa correspondente:
 * quem falou por último fica no topo.
 *
 * É uma correção de UMA VEZ, disparada por botão — não um comportamento automático. A partir da
 * correção que colocou o lead novo no topo (`src/lib/funis/upsert.ts`), o funil já nasce na ordem
 * certa; o que esta rota resolve é o acúmulo de antes, que entrou pelo fim da coluna e continuaria
 * assim pra sempre.
 *
 * NUNCA muda card de ETAPA. Cada card fica exatamente na coluna em que está — o que muda é só a
 * posição dentro dela. Card sem conversa correspondente (criado à mão, ou de alguém que não tem
 * thread) vai pro fim da coluna, mantendo a ordem relativa que já tinha entre eles: não há data de
 * atividade pra comparar, e inventar uma seria pior do que preservar o que a pessoa arrumou.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const [etapas, conversas] = await Promise.all([
    prisma.funilEtapa.findMany({
      where: { workspaceId },
      select: { id: true, cards: { select: { id: true, nome: true, ordem: true }, orderBy: { ordem: "asc" } } },
    }),
    prisma.conversa.findMany({
      where: { workspaceId },
      select: { nome: true, atualizadoEm: true },
    }),
  ]);

  const atividadePorNome = new Map(conversas.map((c) => [c.nome, c.atualizadoEm.getTime()]));

  const atualizacoes: { id: string; ordem: number }[] = [];
  for (const etapa of etapas) {
    const ordenados = etapa.cards
      .map((card, posicaoAtual) => ({ ...card, posicaoAtual, atividade: atividadePorNome.get(card.nome) }))
      .sort((a, b) => {
        // Sem conversa vai pro fim, na ordem relativa que já tinha.
        if (a.atividade === undefined && b.atividade === undefined) return a.posicaoAtual - b.posicaoAtual;
        if (a.atividade === undefined) return 1;
        if (b.atividade === undefined) return -1;
        return b.atividade - a.atividade;
      });

    ordenados.forEach((card, ordem) => {
      if (card.ordem !== ordem) atualizacoes.push({ id: card.id, ordem });
    });
  }

  if (!atualizacoes.length) return NextResponse.json({ reordenados: 0 });

  // Uma transação só: com o funil aberto noutra aba, metade reordenada e metade não seria pior do
  // que não ter reordenado nada.
  await prisma.$transaction(
    atualizacoes.map((a) => prisma.negocioCard.update({ where: { id: a.id }, data: { ordem: a.ordem } })),
  );

  return NextResponse.json({ reordenados: atualizacoes.length });
}
