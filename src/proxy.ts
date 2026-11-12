import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { ehRotaPublica } from "@/lib/rotas-publicas";
import { decidirAcesso } from "@/lib/assinatura/acesso";
import { statusDaAssinatura } from "@/lib/assinatura/status-cache";
import { ROTA_INICIAL, ROTA_SEM_PERMISSAO, primeiraRotaPermitida } from "@/lib/rota-inicial";
import { permissaoDoEndereco } from "@/lib/permissao-da-rota";


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
    return NextResponse.redirect(new URL(ROTA_INICIAL, request.url));
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
  const decisao = decidirAcesso({
    pathname,
    superAdmin: sessao.user.superAdmin,
    papelTipo: sessao.user.papelTipo,
    // Com memória curta: o bloqueio agora vale também em `/api`, e sem cache isso virava uma
    // consulta ao banco por requisição. O CRM faz muitas, e o produto inteiro ficou lento. Ver
    // `status-cache.ts` pro que isso custa (poucos segundos de atraso ao destravar).
    statusAssinatura: await statusDaAssinatura(sessao.user.workspaceId),
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
  /*
   * A API ENTROU NO BLOQUEIO, e essa é a correção que importa.
   *
   * Estava escrito aqui: `&& !pathname.startsWith("/api")`. A TELA era barrada e os DADOS não —
   * qualquer página que chamasse a API de outro módulo recebia tudo, e quem soubesse o endereço
   * pedia direto. "Ele tem acesso a tudo": tinha mesmo, por baixo.
   *
   * O mapa agora é um só, com teste (`permissao-da-rota.ts`), e a resposta na API é 403 em vez de
   * redirecionar: redirecionar um `fetch` devolve o HTML de outra tela, e a tela que pediu os
   * dados engasga com um erro que não explica nada.
   */
  if (!sessao.user.superAdmin && sessao.user.papelTipo !== "admin") {
    const rotaBase = "/" + pathname.split("/")[1];
    const permissaoNecessaria = permissaoDoEndereco(pathname);
    if (permissaoNecessaria && !sessao.user.permissoes.includes(permissaoNecessaria)) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          { erro: "Você não tem permissão para este módulo." },
          { status: 403 },
        );
      }
      /*
       * O DESTINO NÃO PODE SER UMA ROTA QUE ELA TAMBÉM NÃO PODE VER.
       *
       * Era sempre `ROTA_INICIAL`, que é `/conversas` — e `/conversas` é uma das rotas
       * restringíveis. Quem não tinha permissão de Conversas era mandado pra Conversas, de novo e
       * de novo: o navegador desistia com "redireções em excesso" e a conta ficava inutilizável,
       * sem nenhuma mensagem dizendo o que estava acontecendo.
       *
       * Agora o destino é a primeira rota que ela CONSEGUE abrir; não havendo nenhuma, ela vai
       * pra uma tela que explica isso em vez de um laço.
       */
      const destino = primeiraRotaPermitida({
        papelTipo: sessao.user.papelTipo,
        permissoes: sessao.user.permissoes,
      });
      const alvo = destino && destino !== rotaBase ? destino : ROTA_SEM_PERMISSAO;
      if (pathname === alvo) return NextResponse.next();
      return NextResponse.redirect(new URL(alvo, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  /**
   * `marca` está de fora junto com os caminhos internos do Next porque `public/` é, por definição,
   * conteúdo público: são os arquivos da marca, servidos antes de qualquer login.
   *
   * Sem essa exclusão, `GET /marca/logo-azuz.jpg` de quem não está logado caía na regra geral e
   * levava 307 pra `/login`. O estrago não era só o arquivo não abrir: o otimizador de imagem do
   * Next busca o arquivo local por HTTP, recebia o redirecionamento em vez dos bytes, não
   * conseguia identificar o tipo e devolvia 400. Resultado: a logo do cabeçalho não aparecia na
   * landing pra NENHUM visitante — ou seja, exatamente para todo mundo que ainda não é cliente, na
   * única página que existe pra vender o produto. E sem erro visível: só um espaço vazio.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|marca/).*)"],
};
