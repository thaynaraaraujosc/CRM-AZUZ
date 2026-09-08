import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { provedorDeIA } from "@/lib/automacoes/ia";

/**
 * O que o SERVIDOR tem configurado. Não o que o workspace conectou (isso é `/api/canais`).
 *
 * Existe pra a interface não oferecer o que não funciona. O caso concreto: sem chave de IA, o
 * bloco "Responder com IA" ficaria na biblioteca esperando alguém montar um fluxo inteiro em volta
 * dele pra só então descobrir, no histórico, que nada foi enviado. Melhor ele não aparecer.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  return NextResponse.json(
    { ia: provedorDeIA() !== null },
    { headers: { "cache-control": "private, no-store" } },
  );
}
