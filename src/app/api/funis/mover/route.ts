import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Move UM negócio: de etapa, de funil e/ou de responsável — numa chamada só, gravada na hora.
 *
 * Existe porque até aqui o funil inteiro era reconciliado por um PUT de estado completo, com 500ms
 * de espera. Isso tinha três consequências ruins:
 *
 * 1. Uma falha derrubava TUDO. O PUT é uma transação só; se qualquer parte falhava, nada era
 *    gravado — nem o funil novo, nem a etapa nova, nem o card arrastado. E o cliente não conferia
 *    o resultado da resposta, então a falha era invisível: a tela mostrava a mudança feita e o
 *    banco não tinha nada.
 * 2. "Não veio no payload" significava "apague". Um estado desatualizado do navegador podia apagar
 *    do banco o que outra aba (ou o webhook) tinha acabado de criar.
 * 3. Arrastar um card e recarregar em menos de 500ms perdia o movimento.
 *
 * Aqui é o oposto: uma operação, um registro, resposta imediata e um erro que o front consegue ver
 * — e desfazer na tela se a gravação não aconteceu.
 *
 * O card é o MESMO registro do começo ao fim: muda de etapa, nunca é recriado. É o que garante que
 * histórico, valor e data de fechamento sigam o negócio ao mudar de funil.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { cardId, etapaId, responsavel, ordem } = (await request.json()) as {
    cardId?: string;
    etapaId?: string;
    /** `null` remove o responsável; ausente mantém o atual. */
    responsavel?: string | null;
    ordem?: number;
  };

  if (!cardId) return NextResponse.json({ erro: "cardId é obrigatório" }, { status: 400 });

  // Posse conferida pelos DOIS lados, sempre pelo workspace da sessão e nunca por id vindo da
  // requisição: um id de outra empresa não pode ser lido nem escrito, e um card não pode ser
  // empurrado pra uma etapa que não é da mesma empresa.
  const card = await prisma.negocioCard.findFirst({ where: { id: cardId, workspaceId } });
  if (!card) return NextResponse.json({ erro: "Negócio não encontrado." }, { status: 404 });

  if (etapaId) {
    const etapa = await prisma.funilEtapa.findFirst({
      where: { id: etapaId, workspaceId },
      select: { id: true },
    });
    if (!etapa) {
      return NextResponse.json({ erro: "Etapa não encontrada neste workspace." }, { status: 400 });
    }
  }

  const atualizado = await prisma.negocioCard.update({
    where: { id: cardId },
    data: {
      ...(etapaId ? { etapaId } : {}),
      ...(ordem !== undefined ? { ordem } : {}),
      // `undefined` mantém o valor atual; `null` limpa. Sem essa distinção, mudar só o funil
      // apagaria o responsável sem ninguém pedir.
      ...(responsavel !== undefined ? { responsavel } : {}),
    },
    select: { id: true, etapaId: true, responsavel: true },
  });

  return NextResponse.json({ ok: true, card: atualizado }, { headers: { "cache-control": "no-store" } });
}
