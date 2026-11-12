import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL } from "@/lib/integracoes/meta";

type ErroGraph = { error?: { message?: string } };

async function graphGet<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${META_GRAPH_URL}${caminho}`);
  const corpo = (await resposta.json()) as T & ErroGraph;
  if (!resposta.ok) {
    throw new Error(corpo.error?.message ?? `Falha na Graph API (${resposta.status})`);
  }
  return corpo;
}

type Campanha = { id: string; name: string; status: string };
type Insight = { campaign_id: string; spend: string; actions?: { action_type: string; value: string }[]; action_values?: { action_type: string; value: string }[] };

const TIPOS_LEAD = ["lead", "onsite_conversion.lead_grouped"];
const TIPOS_COMPRA = ["purchase", "offsite_conversion.fb_pixel_purchase"];

/**
 * GET devolve as campanhas ativas do Meta Ads conectado, já formatadas no mesmo formato de texto
 * (`sub`/`roas`) que a página de Tráfego já espera dos dados mocados. Assim o resto da página
 * (parse, ordenação, filtro) não precisa mudar nada, só a fonte dos dados.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor_slot: { workspaceId: sessao.user.workspaceId, provedor: "meta_ads", slot: 1 } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Meta Ads não conectado" }, { status: 404 });
  }

  const { adAccountId } = integracao.metadados as { adAccountId?: string };
  if (!adAccountId) return NextResponse.json({ erro: "Conta de anúncios não configurada" }, { status: 404 });

  try {
    const accessToken = decriptar(integracao.accessTokenCriptografado);

    /* `effective_status` e um ARRAY JSON num parametro de URL, e ia cru: aspas e colchetes sem
       codificar. A Graph aceita na maioria das vezes e recusa quando o proxy pelo caminho
       normaliza a URL — falha intermitente, do tipo que ninguem reproduz. `encodeURIComponent`
       tira a duvida. */
    /*
     * CAMPANHA EM ANÁLISE OU COM PROBLEMA TAMBÉM É CAMPANHA.
     *
     * Pedia só ACTIVE e PAUSED. No nível de campanha a Meta também devolve `IN_PROCESS` (em
     * análise) e `WITH_ISSUES` (rejeitada, ou sem forma de pagamento válida) — e justamente essas
     * são as que a pessoa mais procura na tela, porque são as que não estão entregando. Ficavam
     * invisíveis, e a tela dizia "nenhuma campanha" sobre uma conta cheia de campanha.
     */
    const statusPedido = encodeURIComponent(
      JSON.stringify(["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES"]),
    );
    const campanhas = await graphGet<{ data: Campanha[] }>(
      `/${adAccountId}/campaigns?fields=id,name,status&effective_status=${statusPedido}&access_token=${accessToken}`,
    );
    const insights = await graphGet<{ data: Insight[] }>(
      `/${adAccountId}/insights?level=campaign&fields=campaign_id,spend,actions,action_values&date_preset=last_30d&access_token=${accessToken}`,
    );

    const todas = campanhas.data
      .map((c) => {
        const insight = insights.data.find((i) => i.campaign_id === c.id);
        const spend = Number(insight?.spend ?? 0);
        const leads = Number(insight?.actions?.find((a) => TIPOS_LEAD.includes(a.action_type))?.value ?? 0);
        const vendas = Number(insight?.actions?.find((a) => TIPOS_COMPRA.includes(a.action_type))?.value ?? 0);
        const receita = Number(insight?.action_values?.find((a) => TIPOS_COMPRA.includes(a.action_type))?.value ?? 0);
        const roas = spend > 0 ? receita / spend : 0;
        return { nome: c.name, spend, leads, vendas, roas, pausada: c.status !== "ACTIVE" };
      });

    const investimentos = todas
      // Campanha pausada só aparece se gastou algo no período. Pausada e sem gasto é ruído.
      .filter((i) => !i.pausada || i.spend > 0);

    /*
     * O QUE FOI DESCARTADO, pra tela poder dizer o porquê de não ter nada.
     *
     * "Aqui fala que está conectado, mas o Meta não devolveu nenhuma campanha. Por quê? Tem que
     * entender o porquê."
     *
     * Lista vazia tinha três causas possíveis e a rota não contava nenhuma: a conta não tem
     * campanha (quase sempre é a conta errada na conexão), tem campanha mas toda pausada e sem
     * gasto nos últimos 30 dias (o filtro de cima), ou tem campanha e nenhum gasto registrado no
     * período. São diagnósticos diferentes, com saídas diferentes, e "não devolveu nada" não
     * distingue. O que a rota VIU vai junto da resposta.
     */
    const descartadas = todas.filter((i) => i.pausada && i.spend === 0);

    const maiorSpend = Math.max(1, ...investimentos.map((i) => i.spend));

    const resultado = investimentos.map((i) => ({
      plataforma: "M" as const,
      nome: i.nome,
      sub: `${i.leads} leads · R$ ${i.spend.toLocaleString("pt-BR")} investidos`,
      roas: `${i.roas.toFixed(1).replace(".", ",")}x`,
      barra: Math.round((i.spend / maiorSpend) * 100),
      vendas: i.vendas,
      pausada: i.pausada,
    }));

    /*
     * RESPOSTA COM DIAGNÓSTICO, e não só a lista.
     *
     * A forma mudou de `Campanha[]` pra `{ campanhas, diagnostico }`. Quem consome são duas telas
     * (Tráfego e o montador de relatório), as duas neste repositório, as duas ajustadas na mesma
     * entrega. O preço de um campo a mais é baixo; o de uma tela que não sabe explicar o vazio,
     * alto — foi o que a Thaynara encontrou.
     */
    return NextResponse.json({
      campanhas: resultado,
      diagnostico: {
        conta: adAccountId,
        /** Quantas campanhas a conta devolveu, ANTES de qualquer filtro nosso. */
        naConta: todas.length,
        /** Quantas saíram por estarem pausadas e sem gasto nos últimos 30 dias. */
        descartadasPausadasSemGasto: descartadas.length,
        /** Alguns nomes, pra tela poder mostrar de quais está falando. */
        nomesDescartados: descartadas.slice(0, 6).map((i) => i.nome),
        /** Quantas linhas de gasto o período devolveu. Zero = não se gastou nada em 30 dias. */
        linhasDeGasto: insights.data.length,
      },
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao buscar campanhas do Meta Ads.";
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }
}
