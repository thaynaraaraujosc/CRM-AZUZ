import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { juntarCardsDuplicados, planejarJuncaoDeCards } from "@/lib/funis/consolidar";

/**
 * Juntar negócios duplicados do funil.
 *
 * O GET só PLANEJA: devolve quem fica e quem sai, sem tocar em nada. É o que a tela mostra antes de
 * perguntar. O POST executa, e apaga linha.
 *
 * Essa separação existe porque apagar o card errado apaga trabalho de venda de alguém, e um
 * endereço que faz isso ao ser aberto seria um acidente esperando acontecer.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const plano = await planejarJuncaoDeCards(sessao.user.workspaceId);
  return NextResponse.json(
    { plano, cardsQueSaem: plano.reduce((soma, g) => soma + g.saem.length, 0) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  // Só admin: juntar negócio mexe no funil da empresa inteira, não no trabalho de uma pessoa.
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o administrador pode juntar negócios duplicados." }, { status: 403 });
  }

  const resultado = await juntarCardsDuplicados(sessao.user.workspaceId);
  return NextResponse.json(resultado);
}
