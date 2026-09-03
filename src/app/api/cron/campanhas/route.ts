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
  // Esta rota não passa pela checagem de sessão do `proxy.ts` — não pode, o cron não faz login —
  // então o segredo compartilhado é a ÚNICA defesa dela. Por isso ele é obrigatório: antes a
  // verificação só valia `if (segredo)`, e sem a variável configurada a rota ficava aberta pra
  // qualquer um na internet acelerar as campanhas de todos os clientes chamando a URL em laço.
  // Recusar quando falta configuração é o lado seguro do erro.
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const resultado = await rodarRodadaDeCampanhas();
  return NextResponse.json({ ok: true, ...resultado });
}
