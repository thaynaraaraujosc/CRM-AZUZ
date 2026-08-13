import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROTAS_PUBLICAS = ["/login", "/cadastro", "/formulario-preview", "/acesso-bloqueado"];

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
    pathname === "/api/webhooks/instagram" ||
    // Chamado direto pelo whatsapp-worker (serviço separado, sessão via QR Code), validado por
    // segredo fixo dentro da própria rota — mesmo padrão dos outros webhooks acima.
    pathname === "/api/webhooks/whatsapp-baileys" ||
    // Chamado direto pela Asaas (eventos de cobrança da assinatura do CRM), validado pelo token
    // `asaas-access-token` dentro da própria rota — mesmo padrão dos outros webhooks acima.
    pathname === "/api/webhooks/asaas"
  ) {
    return NextResponse.next();
  }

  const sessao = await auth();
  if (!sessao) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Painel de super-admin (visão cross-tenant de todos os workspaces) — só a conta marcada como
  // superAdmin em `auth.ts` (via SUPERADMIN_EMAIL) pode entrar; qualquer outro Membro logado que
  // tentar acessar /admin ou /api/admin/* volta pro próprio workspace, não pro login (ele está
  // autenticado, só não tem permissão pra essa área).
  const rotaDeAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  if (rotaDeAdmin && !sessao.user.superAdmin) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  // Bloqueio por pagamento — consulta o banco a cada navegação de página (não em chamada de API,
  // pra não quebrar os providers do shell que buscam dado em segundo plano) porque o status muda
  // por webhook da Asaas, fora do controle de quando o token JWT da sessão foi emitido; não dá pra
  // confiar em cache de sessão pra isso. Super-admin nunca é afetado (ele não é "de" nenhum
  // workspace pra fins de cobrança).
  //
  // Só "ativa" libera acesso — sem isso, item novo (workspace recém-cadastrado, ainda "pendente"
  // porque não pagou) passaria direto sem bloqueio nenhum. É o paywall: ninguém usa o CRM antes de
  // confirmar o pagamento, e quem atrasar/cancelar depois volta a ficar bloqueado do mesmo jeito.
  if (!sessao.user.superAdmin && !pathname.startsWith("/api")) {
    const assinatura = await prisma.assinatura.findUnique({
      where: { workspaceId: sessao.user.workspaceId },
      select: { status: true },
    });
    const bloqueado = assinatura?.status !== "ativa";

    if (bloqueado && sessao.user.papelTipo === "admin" && pathname !== "/configuracoes") {
      return NextResponse.redirect(new URL("/configuracoes", request.url));
    }
    if (bloqueado && sessao.user.papelTipo !== "admin") {
      return NextResponse.redirect(new URL("/acesso-bloqueado", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
