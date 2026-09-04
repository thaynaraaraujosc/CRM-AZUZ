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
 * (`sub`/`roas`) que a página de Tráfego já espera dos dados mocados — assim o resto da página
 * (parse, ordenação, filtro) não precisa mudar nada, só a fonte dos dados.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "meta_ads" } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Meta Ads não conectado" }, { status: 404 });
  }

  const { adAccountId } = integracao.metadados as { adAccountId?: string };
  if (!adAccountId) return NextResponse.json({ erro: "Conta de anúncios não configurada" }, { status: 404 });

  try {
    const accessToken = decriptar(integracao.accessTokenCriptografado);

    const campanhas = await graphGet<{ data: Campanha[] }>(
      `/${adAccountId}/campaigns?fields=id,name,status&effective_status=["ACTIVE","PAUSED"]&access_token=${accessToken}`,
    );
    const insights = await graphGet<{ data: Insight[] }>(
      `/${adAccountId}/insights?level=campaign&fields=campaign_id,spend,actions,action_values&date_preset=last_30d&access_token=${accessToken}`,
    );

    const investimentos = campanhas.data
      .map((c) => {
        const insight = insights.data.find((i) => i.campaign_id === c.id);
        const spend = Number(insight?.spend ?? 0);
        const leads = Number(insight?.actions?.find((a) => TIPOS_LEAD.includes(a.action_type))?.value ?? 0);
        const vendas = Number(insight?.actions?.find((a) => TIPOS_COMPRA.includes(a.action_type))?.value ?? 0);
        const receita = Number(insight?.action_values?.find((a) => TIPOS_COMPRA.includes(a.action_type))?.value ?? 0);
        const roas = spend > 0 ? receita / spend : 0;
        return { nome: c.name, spend, leads, vendas, roas, pausada: c.status !== "ACTIVE" };
      })
      // Campanha pausada só aparece se gastou algo no período — pausada e sem gasto é ruído.
      .filter((i) => !i.pausada || i.spend > 0);

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

    return NextResponse.json(resultado);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao buscar campanhas do Meta Ads.";
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }
}
