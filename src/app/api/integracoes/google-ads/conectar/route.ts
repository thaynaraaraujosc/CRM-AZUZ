import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { googleAdsConfigurado, urlDeAutorizacao } from "@/lib/integracoes/google-ads";

/**
 * Manda a pessoa pro diálogo de autorização do Google, pra conectar a conta de anúncio dela.
 *
 * Mesmo desenho do `meta/conectar`: link direto no botão, sem fetch nem JS. O `state` assinado
 * carrega o workspace, e é ele que o callback confere pra não gravar a conta de uma empresa dentro
 * de outra.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Enquanto o token de desenvolvedor não estiver aprovado e nas variáveis, esta rota recusa. A
  // tela nem mostra o botão nesse estado (ver `googleAdsConfigurado`), mas quem tiver o endereço
  // guardado recebe uma explicação em vez de um erro sem sentido.
  if (!googleAdsConfigurado()) {
    return NextResponse.json(
      { erro: "A integração com o Google Ads ainda não está liberada nesta instalação." },
      { status: 503 },
    );
  }

  const origem = new URL(request.url).origin;
  return NextResponse.redirect(
    urlDeAutorizacao(sessao.user.workspaceId, `${origem}/api/integracoes/google-ads/callback`),
  );
}
