import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { encriptar } from "@/lib/integracoes/crypto";
import { auditar } from "@/lib/seguranca/auditoria";
import {
  googleAdsConfigurado,
  listarContasAcessiveis,
  trocarCodigoPorTokens,
  verificarState,
} from "@/lib/integracoes/google-ads";

/**
 * Retorno do Google depois que a pessoa autoriza.
 *
 * Sem `auth()` de propósito: quem chega aqui vem redirecionado pelo Google, e nem sempre com a
 * sessão do CRM ativa na aba. A identidade vem do `state` ASSINADO, e é por isso que ele é
 * assinado: ele volta pelo navegador de quem clicou, ou seja, por um canal que a pessoa controla.
 * Sem a assinatura, bastaria trocar o workspace na URL pra conectar a conta de anúncio de uma
 * empresa dentro do workspace de outra.
 */
export const dynamic = "force-dynamic";

/**
 * `integracaoErro`, e nao `erro`: e o nome que o `useIntegracaoMeta` le da URL pra mostrar a
 * mensagem depois do redirect. Com qualquer outro nome a explicacao chega na barra de endereco e
 * some da tela, que e o mesmo que nao explicar nada.
 */
function voltarPraTrafego(origem: string, erro?: string): NextResponse {
  const destino = new URL("/trafego", origem);
  if (erro) destino.searchParams.set("integracaoErro", erro);
  return NextResponse.redirect(destino);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origem = url.origin;

  if (!googleAdsConfigurado()) {
    return voltarPraTrafego(origem, "A integração com o Google Ads ainda não está liberada.");
  }

  // A pessoa pode ter clicado em "Cancelar" na tela do Google. Isso não é falha: é desistência, e
  // merece voltar em silêncio em vez de uma tela de erro.
  if (url.searchParams.get("error")) {
    return voltarPraTrafego(origem);
  }

  const codigo = url.searchParams.get("code");
  const estado = verificarState(url.searchParams.get("state"));
  if (!codigo || !estado) {
    return voltarPraTrafego(origem, "Não foi possível confirmar a autorização. Tente conectar de novo.");
  }

  try {
    const tokens = await trocarCodigoPorTokens(codigo, `${origem}/api/integracoes/google-ads/callback`);

    /*
     * Sem refresh token não adianta gravar.
     *
     * O Google só devolve refresh token quando `access_type=offline` e `prompt=consent` vão juntos,
     * e mesmo assim ele pode faltar se a conta já tiver autorizado antes por outro caminho. Gravar
     * só o token de uma hora daria uma conexão que funciona hoje e morre amanhã, sem erro que
     * aponte pra causa. Melhor recusar agora, com explicação.
     */
    if (!tokens.refreshToken) {
      return voltarPraTrafego(
        origem,
        "O Google não devolveu a autorização de longo prazo. Remova o acesso do Azuz CRM em " +
          "myaccount.google.com/permissions e conecte de novo.",
      );
    }

    const contas = await listarContasAcessiveis(tokens.accessToken);
    if (!contas.length) {
      return voltarPraTrafego(
        origem,
        "Nenhuma conta do Google Ads foi encontrada nesse login. Entre com a conta que administra os anúncios.",
      );
    }

    const provedor = "google_ads";
    /*
     * `metadados` VAI PRA TELA: o `GET /api/integracoes/meta?provedor=` devolve esse campo inteiro
     * pro navegador. Token ali dentro, mesmo criptografado, é segredo entregue a quem não precisa
     * dele. O refresh token vai na coluna própria, que nenhuma rota de leitura seleciona.
     */
    const metadados = { contaId: contas[0], contasDisponiveis: contas };

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId: estado.workspaceId, provedor } },
      create: {
        id: `integracao-${estado.workspaceId}-${provedor}`,
        workspaceId: estado.workspaceId,
        provedor,
        status: "conectado",
        accessTokenCriptografado: encriptar(tokens.accessToken),
        refreshTokenCriptografado: encriptar(tokens.refreshToken),
        expiraEm: tokens.expiraEm,
        metadados,
        erroMensagem: null,
      },
      update: {
        status: "conectado",
        accessTokenCriptografado: encriptar(tokens.accessToken),
        refreshTokenCriptografado: encriptar(tokens.refreshToken),
        expiraEm: tokens.expiraEm,
        metadados,
        erroMensagem: null,
      },
    });

    await auditar({
      workspaceId: estado.workspaceId,
      acao: "integracao.conectada",
      recurso: provedor,
      detalhe: `conta ${contas[0]}`,
    });

    return voltarPraTrafego(origem);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao conectar o Google Ads.";
    console.error("[google-ads] falha no callback:", mensagem);
    return voltarPraTrafego(origem, mensagem);
  }
}
