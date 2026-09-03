import { NextResponse } from "next/server";

import { rodarRodadaDeCampanhas } from "@/lib/campanhas/worker";

/**
 * Batida do relógio das campanhas.
 *
 * Chamada pelo cron da plataforma (ver `vercel.json`), NÃO por navegador. É o que faz o disparo
 * acontecer com a aba fechada e o agendamento valer de verdade.
 *
 * `maxDuration` acompanha a janela que o worker usa: sem isso a função seria cortada no meio de um
 * envio, e o destinatário ficaria preso em "enviando" até a próxima rodada.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // A rota é pública por natureza (o cron não faz login), então a defesa é o segredo compartilhado.
  // Sem ele, qualquer um na internet poderia acelerar as campanhas de todos os clientes chamando
  // esta URL em laço.
  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const autorizacao = request.headers.get("authorization");
    if (autorizacao !== `Bearer ${segredo}`) {
      return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
    }
  }

  const resultado = await rodarRodadaDeCampanhas();
  return NextResponse.json({ ok: true, ...resultado });
}
