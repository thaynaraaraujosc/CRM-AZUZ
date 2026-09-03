import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ehRotaPublica } from "@/lib/rotas-publicas";

/** Módulo do CRM que cada rota pertence, pro bloqueio de permissão (item 4 do pedido: "se eu
 * restringir Formulários/Automações/Configurações, o membro realmente não pode mexer"). Checa só
 * a permissão `_visualizar` de cada módulo — é o suficiente pra decidir se a rota inteira abre ou
 * não; ações mais finas (criar/editar/excluir) continuam decorativas por enquanto, ver
 * `src/lib/configuracoes/permissoes.ts`. Rota que não aparece aqui não é restringível (fica aberta
 * pra qualquer membro logado, mesmo sem nenhuma permissão marcada). */
const ROTA_PERMISSAO: Record<string, string> = {
  "/contatos": "contatos_visualizar",
  "/conversas": "wa_visualizar",
  "/funil": "funil_visualizar",
  "/pipeline": "funil_visualizar",
  "/formularios": "form_visualizar",
  "/automacoes": "auto_visualizar",
  "/configuracoes": "config_visualizar",
  "/relatorios": "rel_visualizar",
  "/trafego": "rel_visualizar",
  "/performance-vendas": "rel_visualizar",
  "/atividades-vendas": "rel_visualizar",
  "/jornada-cliente": "rel_visualizar",
  "/motivos-perda": "rel_visualizar",
  "/crm-live": "rel_visualizar",
  "/inteligencia-comercial": "rel_visualizar",
};

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A lista mora em `rotas-publicas.ts`, com teste — ver o porquê lá.
  if (ehRotaPublica(pathname)) return NextResponse.next();

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

  // Permissão por módulo — admin do workspace sempre vê tudo (é o dono da conta, restringir ele
  // mesmo não faz sentido); qualquer outro papelTipo só entra se o módulo da rota estiver marcado
  // nas permissões dele. Sem isso, o toggle de permissão em Configurações > Usuários era só
  // decorativo (salvava no banco, nunca impedia nada de verdade).
  if (!sessao.user.superAdmin && sessao.user.papelTipo !== "admin" && !pathname.startsWith("/api")) {
    const rotaBase = "/" + pathname.split("/")[1];
    const permissaoNecessaria = ROTA_PERMISSAO[rotaBase];
    if (permissaoNecessaria && !sessao.user.permissoes.includes(permissaoNecessaria)) {
      return NextResponse.redirect(new URL("/inicio", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
