import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ehRotaPublica } from "@/lib/rotas-publicas";
import { decidirAcesso } from "@/lib/assinatura/acesso";

/** Módulo do CRM que cada rota pertence, pro bloqueio de permissão (item 4 do pedido: "se eu
 * restringir Formulários/Automações/Configurações, o membro realmente não pode mexer"). Checa só
 * a permissão `_visualizar` de cada módulo. É o suficiente pra decidir se a rota inteira abre ou
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

  // A lista mora em `rotas-publicas.ts`, com teste: ver o porquê lá.
  if (ehRotaPublica(pathname)) return NextResponse.next();

  const sessao = await auth();
  if (!sessao) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Painel de super-admin (visão cross-tenant de todos os workspaces). Só a conta marcada como
  // superAdmin em `auth.ts` (via SUPERADMIN_EMAIL) pode entrar; qualquer outro Membro logado que
  // tentar acessar /admin ou /api/admin/* volta pro próprio workspace, não pro login (ele está
  // autenticado, só não tem permissão pra essa área).
  const rotaDeAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  if (rotaDeAdmin && !sessao.user.superAdmin) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  /*
   * Bloqueio por pagamento. O paywall de verdade.
   *
   * Consulta o banco a cada requisição porque o status muda por webhook da Asaas, fora do controle
   * de quando o token da sessão foi emitido: não dá pra confiar em cache de sessão pra isso.
   *
   * `/api` entra no bloqueio, e essa é a correção que importa. Antes ficava inteiramente de fora
   * "pra não quebrar os provedores da casca", só que o CRM é feito de telas que leem tudo por
   * `/api`: o produto inteiro respondia a quem nunca pagou. A regra em si mora em
   * `lib/assinatura/acesso.ts`, com teste.
   */
  const assinatura = await prisma.assinatura.findUnique({
    where: { workspaceId: sessao.user.workspaceId },
    select: { status: true },
  });
  const decisao = decidirAcesso({
    pathname,
    superAdmin: sessao.user.superAdmin,
    papelTipo: sessao.user.papelTipo,
    statusAssinatura: assinatura?.status ?? null,
  });
  if (!decisao.liberado) {
    // API responde 402, nunca redirecionamento: um `fetch` que recebe redirecionamento pra página
    // HTML devolve o HTML como se fosse resposta boa, e a tela mostra erro de formato em vez de
    // dizer que o pagamento está pendente.
    if (decisao.ehApi) {
      return NextResponse.json(
        { erro: "Assinatura pendente.", destino: decisao.destino },
        { status: 402, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.redirect(new URL(decisao.destino, request.url));
  }

  // Permissão por módulo: admin do workspace sempre vê tudo (é o dono da conta, restringir ele
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
