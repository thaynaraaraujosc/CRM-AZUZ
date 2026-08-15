import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { desconectarWhatsAppNaoOficial } from "@/lib/integracoes/whatsapp-nao-oficial";

/** POST pede pro whatsapp-service encerrar a sessão do workspace de quem está logado — o próprio
 * serviço avisa o novo status (`desconectado`, depois `aguardando_qr`) pelo webhook. */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  try {
    await desconectarWhatsAppNaoOficial();
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao desconectar" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
