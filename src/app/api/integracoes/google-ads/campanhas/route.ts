import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { formatarSubCampanha } from "@/lib/metrics";
import { buscarCampanhas, googleAdsConfigurado } from "@/lib/integracoes/google-ads";
import { contaDoWorkspace, marcarErro } from "@/lib/integracoes/google-ads-conta";

/**
 * As campanhas do Google Ads no MESMO formato que a tela de Tráfego já recebe do Meta Ads.
 *
 * A tela não sabe de onde vem cada campanha além da letra em `plataforma`: ela filtra, ordena e
 * soma os dois conjuntos juntos. Manter o formato idêntico é o que permite isso sem uma segunda
 * tabela e sem um segundo conjunto de indicadores.
 *
 * `sub` sai de `formatarSubCampanha` e não de um template solto aqui, porque a tela lê leads e
 * investimento DE VOLTA dessa frase com expressão regular. Montar a frase por fora já produziu
 * campanha com zero lead na tela, sem erro nenhum, quando o número vinha com casa decimal.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  if (!googleAdsConfigurado()) {
    return NextResponse.json({ erro: "Google Ads não liberado nesta instalação" }, { status: 503 });
  }

  const conta = await contaDoWorkspace(sessao.user.workspaceId);
  if (!conta) return NextResponse.json({ erro: "Google Ads não conectado" }, { status: 404 });

  try {
    const campanhas = await buscarCampanhas(conta);
    // Campanha que não gastou nada no período é ruído: entra na lista empurrando pra baixo o que
    // importa, e ainda puxa o custo por lead pra baixo sem ter custo nenhum.
    const comGasto = campanhas.filter((c) => c.investido > 0);
    const maior = Math.max(1, ...comGasto.map((c) => c.investido));

    return NextResponse.json(
      comGasto.map((c) => ({
        plataforma: "G" as const,
        nome: c.nome,
        sub: formatarSubCampanha(c.leads, c.investido),
        roas: `${(c.investido > 0 ? c.receita / c.investido : 0).toFixed(1).replace(".", ",")}x`,
        barra: Math.round((c.investido / maior) * 100),
        vendas: Math.round(c.vendas),
      })),
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao buscar campanhas do Google Ads.";
    /*
     * Marca a conexão como quebrada quando o Google recusa a IDENTIDADE, não quando recusa a
     * consulta. 401 e 403 querem dizer que a autorização morreu (o cliente removeu o acesso, o
     * token de desenvolvedor perdeu o nível) e ninguém vai consertar sozinho. Já um 500 do lado
     * deles é passageiro, e derrubar a conexão por causa dele obrigaria a reconectar à toa.
     */
    if (/\((401|403)\)/.test(mensagem)) {
      await marcarErro(sessao.user.workspaceId, mensagem).catch(() => {});
    }
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }
}
