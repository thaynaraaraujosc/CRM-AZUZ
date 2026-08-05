import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { assinarState } from "@/lib/integracoes/meta";

/**
 * GET redireciona pro diálogo OAuth da Meta pra conectar o WhatsApp Business do workspace de quem
 * está logado. O botão "Conectar" em Configurações → WhatsApp e no modal de Conversas linkam pra
 * cá diretamente (`<a href="/api/integracoes/meta/conectar">`) — não precisa de fetch/JS.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json({ erro: "META_APP_ID não configurado no servidor" }, { status: 500 });
  }

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/integracoes/meta/callback`;
  const scopes = ["whatsapp_business_management", "whatsapp_business_messaging", "business_management"];

  const dialogo = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  dialogo.searchParams.set("client_id", appId);
  dialogo.searchParams.set("redirect_uri", redirectUri);
  dialogo.searchParams.set("scope", scopes.join(","));
  dialogo.searchParams.set("state", assinarState(sessao.user.workspaceId));
  dialogo.searchParams.set("response_type", "code");

  return NextResponse.redirect(dialogo.toString());
}
