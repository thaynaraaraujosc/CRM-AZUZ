import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";

const ROTAS_PUBLICAS = ["/login", "/cadastro", "/formulario-preview"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`)) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/formularios") ||
    pathname === "/api/cadastro" ||
    // Chamado direto pela Meta (verificação de webhook + mensagens recebidas), sem sessão de
    // navegador nenhuma — a validação de assinatura HMAC dentro da rota é que garante que é a
    // Meta chamando, não o proxy.
    pathname === "/api/webhooks/whatsapp" ||
    pathname === "/api/webhooks/instagram"
  ) {
    return NextResponse.next();
  }

  const sessao = await auth();
  if (!sessao) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
