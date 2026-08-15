import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ESCOPOS_POR_PROVEDOR, assinarState } from "@/lib/integracoes/meta";

/**
 * GET redireciona pro diálogo OAuth da Meta pra conectar o provedor pedido (`?provedor=`, default
 * `meta_whatsapp` pra manter os links existentes funcionando sem mudança) do workspace de quem
 * está logado. Os botões "Conectar" em Configurações linkam pra cá diretamente
 * (`<a href="/api/integracoes/meta/conectar?provedor=...">`) — não precisa de fetch/JS. O
 * `redirect_uri` é sempre o mesmo callback pros três provedores; só o `state` assinado diz qual é.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json({ erro: "META_APP_ID não configurado no servidor" }, { status: 500 });
  }

  const url = new URL(request.url);
  const provedor = url.searchParams.get("provedor") ?? "meta_whatsapp";
  const escopos = ESCOPOS_POR_PROVEDOR[provedor];
  if (!escopos) {
    return NextResponse.json({ erro: `Provedor desconhecido: ${provedor}` }, { status: 400 });
  }

  const redirectUri = `${url.origin}/api/integracoes/meta/callback`;

  const dialogo = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  dialogo.searchParams.set("client_id", appId);
  dialogo.searchParams.set("redirect_uri", redirectUri);
  dialogo.searchParams.set("scope", escopos.join(","));
  dialogo.searchParams.set("state", assinarState(sessao.user.workspaceId, provedor));
  dialogo.searchParams.set("response_type", "code");

  return NextResponse.redirect(dialogo.toString());
}
