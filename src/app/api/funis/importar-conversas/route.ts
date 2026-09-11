import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { contarDesalinhados, reconciliarFunilEConversas } from "@/lib/conversas/reconciliar";

/**
 * Põe funil e Conversas pra contar a mesma história, agora.
 *
 * A regra é: quem está no funil está em Conversas, e quem está em Conversas está no funil. Este
 * botão fazia só metade dela, criando negócio a partir de conversa; o outro sentido não existia.
 *
 * Nunca mexe em registro existente e nunca apaga: só cria o lado que falta. Grupo fica de fora
 * (grupo não é um lead) e conversa arquivada também (arquivar é dizer "isso não está em
 * atendimento"). A mesma reconciliação roda sozinha pelo relógio, de hora em hora.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Os DOIS sentidos, não só conversa → negócio.
  //
  // Este botão criava negócio a partir de conversa e só. O caminho de volta não existia, então
  // negócio sem conversa ficava assim pra sempre, e na tela isso vira "conversei com a pessoa e a
  // conversa não chegou". A mesma reconciliação roda sozinha pelo relógio; aqui ela roda na hora,
  // pra quem não quer esperar.
  const resultado = await reconciliarFunilEConversas(sessao.user.workspaceId);
  return NextResponse.json({
    criados: resultado.cardsCriados,
    conversasCriadas: resultado.conversasCriadas,
    semComoLigar: resultado.semComoLigar,
  });
}

/** Quantos estão fora de compasso agora. A tela usa pra só mostrar o botão quando há o que fazer. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  return NextResponse.json(await contarDesalinhados(sessao.user.workspaceId));
}
