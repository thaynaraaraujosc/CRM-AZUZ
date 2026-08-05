import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * POST público (sem `auth()`) — equivalente de `atribuirContatoAoFunilPublico` (que antes lia e
 * regravava `/api/funis` inteiro): move (ou cria) o card desse contato pra etapa escolhida, tirando
 * de onde estivesse antes em qualquer funil — mas só dentro do workspace do formulário, resolvido
 * aqui. Diferente do `PUT /api/funis` (que reconcilia a tabela inteira a partir de um array
 * arbitrário do cliente), essa rota só aceita `{funilId, etapaTitulo, card}` e faz a movimentação
 * ela mesma no servidor — não dá pra um público mandar um payload reconciliando funis inteiros.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/funil">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });
  const workspaceId = formulario.workspaceId;

  const { funilId, etapaTitulo, card } = (await request.json()) as {
    funilId: string;
    etapaTitulo: string;
    card: { nome: string; valor: string; origem: string; dias: string; data: string; responsavel?: string };
  };

  const etapaDestino = await prisma.funilEtapa.findFirst({
    where: { workspaceId, funilId, titulo: etapaTitulo },
  });
  if (!etapaDestino) {
    return NextResponse.json({ erro: "Funil ou etapa não encontrados" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Tira o card de onde estivesse (qualquer funil desse workspace), igual o cliente já fazia.
    await tx.negocioCard.deleteMany({
      where: { workspaceId, nome: card.nome },
    });

    const ultimoCard = await tx.negocioCard.findFirst({
      where: { etapaId: etapaDestino.id },
      orderBy: { ordem: "desc" },
    });

    await tx.negocioCard.create({
      data: {
        id: `negocio-${Date.now()}`,
        workspaceId,
        etapaId: etapaDestino.id,
        ordem: (ultimoCard?.ordem ?? -1) + 1,
        nome: card.nome,
        valor: card.valor,
        origem: card.origem,
        dias: card.dias,
        data: card.data,
        responsavel: card.responsavel,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
