import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rodarGatilhoNosLeadsDaEtapa } from "@/lib/funil/gatilhos-etapa";

/**
 * Roda o gatilho agora, nos leads que JÁ estão na etapa.
 *
 * É a caixinha "Aplicar o gatilho a todos os leads já nesta etapa". Sem ela, um gatilho novo só
 * pega quem entrar depois, e a etapa cheia de leads antigos fica de fora justamente do que a
 * pessoa acabou de configurar.
 *
 * Só por POST e só por quem está logado: isto MEXE em leads de verdade (manda mensagem, move
 * card, cria tarefa). Não é uma leitura.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const gatilho = await prisma.gatilhoEtapa.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (!gatilho) return NextResponse.json({ erro: "Gatilho não encontrado" }, { status: 404 });

  const alcancados = await rodarGatilhoNosLeadsDaEtapa({
    workspaceId: sessao.user.workspaceId,
    gatilhoId: gatilho.id,
  });

  return NextResponse.json({ ok: true, alcancados });
}
