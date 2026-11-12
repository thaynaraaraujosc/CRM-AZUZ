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

    /*
     * A MINIATURA DO CRIATIVO, pedida duas vezes: "se tem como mostrar a miniatura das campanhas
     * que estão rodando, então faz".
     *
     * UMA chamada pra conta inteira, não uma por campanha. Pedindo `/{campanha}/ads` campanha a
     * campanha, uma conta com vinte campanhas vira vinte idas à Graph só pra desenhar vinte
     * quadradinhos — e a tela passa a demorar em proporção ao tamanho da conta de quem a usa.
     *
     * A miniatura é a do PRIMEIRO anúncio que a campanha devolver. Campanha tem vários anúncios e
     * escolher "o principal" exigiria gasto por anúncio, que é mais uma consulta. Na lista, o
     * quadradinho responde "qual é essa campanha?" — e pra isso qualquer peça dela serve.
     *
     * FALHA SOZINHA, sem derrubar a tela. É enfeite com função, não dado: se a Graph negar este
     * pedido (acontece quando o acesso tem `ads_read` mas não `ads_management`), a tabela aparece
     * inteira, só sem as fotos. Deixar o erro subir trocaria a tela toda por uma mensagem.
     */
    const miniaturas = new Map<string, string>();
    try {
      const anuncios = await graphGet<{
        data: { campaign_id: string; creative?: { thumbnail_url?: string } }[];
      }>(
        `/${adAccountId}/ads?fields=campaign_id,creative{thumbnail_url}&limit=200&access_token=${accessToken}`,
      );
      for (const anuncio of anuncios.data ?? []) {
        const url = anuncio.creative?.thumbnail_url;
        if (url && !miniaturas.has(anuncio.campaign_id)) miniaturas.set(anuncio.campaign_id, url);
      }
    } catch {
      // Sem miniatura. A tabela não depende dela.
    }

    const todas = campanhas.data
      .map((c) => {
        const insight = insights.data.find((i) => i.campaign_id === c.id);
        const spend = Number(insight?.spend ?? 0);
        const leads = Number(insight?.actions?.find((a) => TIPOS_LEAD.includes(a.action_type))?.value ?? 0);
        const vendas = Number(insight?.actions?.find((a) => TIPOS_COMPRA.includes(a.action_type))?.value ?? 0);
        const receita = Number(insight?.action_values?.find((a) => TIPOS_COMPRA.includes(a.action_type))?.value ?? 0);
        const roas = spend > 0 ? receita / spend : 0;
        return {
          nome: c.name,
          spend,
          leads,
          vendas,
          roas,
          pausada: c.status !== "ACTIVE",
          miniatura: miniaturas.get(c.id) ?? null,
          /* O estado CRU da Meta, e não só "pausada sim/não". `WITH_ISSUES` (rejeitada ou sem
             forma de pagamento) e `IN_PROCESS` (em análise) são os dois casos em que a campanha
             existe, aparece na lista e NÃO ENTREGA — e, sem o rótulo, ler "pausada" ali seria
             entender que alguém a pausou de propósito. */
          situacao: c.status,
        };
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
      miniatura: i.miniatura,
      situacao: i.situacao,
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
