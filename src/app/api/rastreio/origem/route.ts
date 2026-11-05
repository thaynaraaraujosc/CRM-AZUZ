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
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      utmTerm: true,
      referrer: true,
      paginaEntrada: true,
      caminho: true,
      criadoEm: true,
      ultimoToque: true,
      ultimoToqueEm: true,
      workspaceId: true,
      /*
       * OS IDENTIFICADORES NÃO SAEM DAQUI.
       *
       * `gclid`, `fbc`, `fbp`, `ttclid`, `igSid`, `psid` e companhia são dados pessoais
       * pseudonimizados: eles existem pra ser devolvidos à plataforma de anúncio, pelo servidor, e
       * não pra aparecer numa tela. Mandá-los pro navegador seria ampliar o alcance deles sem
       * ninguém ganhar nada — a ficha do lead responde "de qual anúncio veio", não "qual é o
       * código do clique". O que a tela precisa saber sobre eles é se EXISTEM, e isso vai no
       * campo abaixo.
       */
      cliqueId: true,
      tipoDoClique: true,
    },
  });

  // Contato de outra empresa responde igual a contato sem origem: não confirma nem nega que ele
  // existe do outro lado.
  if (!origem || origem.workspaceId !== sessao.user.workspaceId) {
    return NextResponse.json({ origem: null });
  }

  const { workspaceId: _ignorado, cliqueId, tipoDoClique, ...visivel } = origem;
  return NextResponse.json({
    origem: {
      ...visivel,
      // Só o TIPO do código, nunca o código. "Tem gclid" é o que a tela precisa dizer pra alguém
      // entender por que a conversão foi ou não devolvida.
      temCodigoDeClique: Boolean(cliqueId),
      tipoDoClique: cliqueId ? tipoDoClique : null,
    },
  });
}
