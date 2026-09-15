import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * De qual anúncio veio um lead.
 *
 * Só do workspace de quem está logado. Origem de lead diz em quais campanhas uma empresa investe e
 * quanto cada uma rende: é informação comercial sensível, e vazar isso entre clientes do CRM seria
 * entregar a estratégia de um pro outro.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const contatoId = new URL(request.url).searchParams.get("contatoId");
  if (!contatoId) return NextResponse.json({ erro: "contatoId é obrigatório" }, { status: 400 });

  const origem = await prisma.origemDoLead.findUnique({
    where: { contatoId },
    select: {
      plataforma: true,
      campanhaNome: true,
      campanhaId: true,
      conjuntoNome: true,
      anuncioNome: true,
      anuncioId: true,
      palavraChave: true,
      utmCampaign: true,
      paginaEntrada: true,
      caminho: true,
      criadoEm: true,
      workspaceId: true,
    },
  });

  // Contato de outra empresa responde igual a contato sem origem: não confirma nem nega que ele
  // existe do outro lado.
  if (!origem || origem.workspaceId !== sessao.user.workspaceId) {
    return NextResponse.json({ origem: null });
  }

  const { workspaceId: _ignorado, ...visivel } = origem;
  return NextResponse.json({ origem: visivel });
}
