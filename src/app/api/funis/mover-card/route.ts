import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH move UM card pra outra etapa imediatamente — chamado direto no drop do drag-and-drop, sem
 * esperar o debounce de 500ms do sync geral (`funis-context.tsx`, que sincroniza o array de funis
 * inteiro). Existe porque o sync geral sozinho não é confiável pra essa ação específica: se der F5
 * bem rápido, ou tiver mais de uma aba do CRM aberta ao mesmo tempo (cada uma com seu próprio
 * snapshot local que pode estar desatualizado), o PUT do array inteiro de uma aba mais lenta pode
 * sobrescrever o card que acabou de ser arrastado com uma posição antiga — era isso que fazia o
 * funil "voltar pra etapa inicial" depois de atualizar a página. Uma escrita direta e imediata só
 * desse card não tem esse problema.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { cardId, etapaId, ordem } = (await request.json()) as {
    cardId?: string;
    etapaId?: string;
    ordem?: number;
  };
  if (!cardId || !etapaId || typeof ordem !== "number") {
    return NextResponse.json({ erro: "cardId, etapaId e ordem são obrigatórios" }, { status: 400 });
  }

  const { count } = await prisma.negocioCard.updateMany({
    where: { id: cardId, workspaceId: sessao.user.workspaceId },
    data: { etapaId, ordem },
  });
  if (count === 0) return NextResponse.json({ erro: "Negócio não encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
