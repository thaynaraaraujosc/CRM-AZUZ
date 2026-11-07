import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET devolve o status da conexão de WhatsApp por QR Code do workspace de quem está logado:
 * inclui o QR code (`metadados.qrDataUrl`) enquanto aguarda leitura.
 *
 * RESPONDE POR UMA CONEXÃO, e de propósito: é esta rota que a tela antiga e a caixa de entrada
 * leem pra saber "o WhatsApp está ligado?". A lista completa tem rota própria (`/numeros`).
 *
 * Qual conexão? A PRIMEIRA QUE ESTIVER CONECTADA, e não a posição 1 fixa. A diferença aparece no
 * dia em que a empresa tem dois números e o primeiro cai: lendo a posição 1, esta rota diria
 * "desconectado" com o segundo número recebendo normalmente — e a caixa de entrada esconde as
 * conversas de WhatsApp quando nenhuma conexão se diz ligada. Some tudo da tela com o atendimento
 * funcionando.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // `?slot=` pede uma conexão específica (a tela de vários números usa). Sem ele, a regra acima.
  const bruto = Number(new URL(request.url).searchParams.get("slot"));
  const slotPedido = Number.isInteger(bruto) && bruto >= 1 ? bruto : null;

  const linhas = await prisma.integracao.findMany({
    where: {
      workspaceId: sessao.user.workspaceId,
      provedor: "whatsapp_nao_oficial",
      ...(slotPedido ? { slot: slotPedido } : {}),
    },
    select: { slot: true, status: true, metadados: true, erroMensagem: true, atualizadoEm: true },
    orderBy: { slot: "asc" },
  });

  const escolhida = linhas.find((l) => l.status === "conectado") ?? linhas[0] ?? null;

  return NextResponse.json(
    escolhida ?? { slot: slotPedido ?? 1, status: "desconectado", metadados: null, erroMensagem: null, atualizadoEm: null },
  );
}
