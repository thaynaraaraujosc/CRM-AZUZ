import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { urlAutorizacao, assinarStateInstagram } from "@/lib/integracoes/instagram-login";

/**
 * GET redireciona pro diálogo de "Login do Instagram" (produto separado do Login do Facebook, ver
 * src/lib/integracoes/instagram-login.ts) — o botão "Conectar" do Instagram em Configurações linka
 * direto pra cá.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/integracoes/instagram/callback`;

  try {
    const state = assinarStateInstagram(sessao.user.workspaceId);
    return NextResponse.redirect(urlAutorizacao(redirectUri, state));
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Integração do Instagram não configurada no servidor.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
