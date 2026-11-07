import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { reimportarHistorico } from "@/lib/integracoes/historico-whatsapp";

/**
 * "Buscar conversas que faltam": roda a importação do celular de novo, sem QR Code novo.
 *
 * Rota própria em vez de mais um verbo na rota de sincronização: POST ali avança um passo, PUT
 * devolve as guardadas pra fila e PATCH pausa. "Começar de novo" é outra intenção, e empilhar um
 * quarto significado no mesmo endereço é como se perde o rastro de qual chamada faz o quê.
 *
 * Só remarca o progresso; quem importa é o relógio (e a tela, enquanto estiver aberta). Repetir não
 * duplica nada: ver `reimportarHistorico`.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  // De qual número. Sem `?slot=`, o primeiro: é o que a tela de uma conexão só manda.
  const bruto = Number(new URL(request.url).searchParams.get("slot"));
  const slot = Number.isInteger(bruto) && bruto >= 1 ? bruto : 1;
  const historico = await reimportarHistorico(sessao.user.workspaceId, slot);
  return NextResponse.json({ historico });
}
