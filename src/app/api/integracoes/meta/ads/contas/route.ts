import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL } from "@/lib/integracoes/meta";
import { rotuloDoStatusDaConta } from "@/lib/integracoes/conta-de-anuncios";

/**
 * AS CONTAS DE ANÚNCIOS QUE ESTE ACESSO ENXERGA, E QUAL DELAS O CRM ESTÁ LENDO.
 *
 * "E se essa campanha tiver errada? Eu tô achando que essa conta não é essa conta. Como que eu
 * faço pra mudar? Como que eu faço pra escolher?"
 *
 * Não fazia: o CRM escolhia sozinho. No fim do OAuth, `resolverAds()` pegava
 * `contas.data.find(c => c.account_status === 1) ?? contas.data[0]` — a primeira ativa da lista
 * da Meta, ou simplesmente a primeira. Quem administra mais de uma conta (agência, conta de
 * cliente, a conta velha de teste) ficava com a que calhou de vir primeiro, e sem tela nenhuma
 * pra trocar: reconectar só repetia o mesmo chute.
 *
 * Esta rota é a pergunta ("quais existem?") e a resposta ("é esta aqui") no mesmo lugar.
 */

type ContaDaGraph = { id: string; name: string; account_status: number; currency: string };

async function listarContas(accessToken: string): Promise<ContaDaGraph[]> {
  const resposta = await fetch(
    `${META_GRAPH_URL}/me/adaccounts?fields=id,name,account_status,currency&limit=200&access_token=${accessToken}`,
  );
  const corpo = (await resposta.json()) as { data?: ContaDaGraph[]; error?: { message?: string } };
  if (!resposta.ok) throw new Error(corpo.error?.message ?? `Falha na Graph API (${resposta.status})`);
  return corpo.data ?? [];
}

async function integracaoDeAds(workspaceId: string) {
  return prisma.integracao.findUnique({
    where: { workspaceId_provedor_slot: { workspaceId, provedor: "meta_ads", slot: 1 } },
  });
}

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const integracao = await integracaoDeAds(sessao.user.workspaceId);
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Meta Ads não conectado" }, { status: 404 });
  }

  const { adAccountId } = (integracao.metadados ?? {}) as { adAccountId?: string };

  try {
    const contas = await listarContas(decriptar(integracao.accessTokenCriptografado));
    return NextResponse.json({
      escolhida: adAccountId ?? null,
      contas: contas.map((c) => ({
        id: c.id,
        nome: c.name,
        moeda: c.currency,
        status: rotuloDoStatusDaConta(c.account_status),
        ativa: c.account_status === 1,
      })),
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao listar as contas de anúncios.";
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }
}

/**
 * Troca a conta de anúncios que o CRM lê. Só o campo da conta muda: o acesso (token) é o mesmo,
 * então não há nada pra reconectar — e é por isso que a troca pode acontecer aqui, sem jogar a
 * pessoa de volta no diálogo da Meta.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as { adAccountId?: unknown } | null;
  const pedida = typeof corpo?.adAccountId === "string" ? corpo.adAccountId : null;
  if (!pedida) return NextResponse.json({ erro: "Informe a conta de anúncios." }, { status: 400 });

  const integracao = await integracaoDeAds(sessao.user.workspaceId);
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Meta Ads não conectado" }, { status: 404 });
  }

  try {
    /*
     * A CONTA É CONFERIDA CONTRA A META, não aceita como o cliente mandou.
     *
     * O id vai parar numa URL da Graph (`/{adAccountId}/campaigns`). Gravar texto que veio do
     * navegador sem conferir deixaria qualquer pessoa logada apontar essa chamada pra onde
     * quisesse. Só entra id que ESTE acesso realmente enxerga.
     */
    const contas = await listarContas(decriptar(integracao.accessTokenCriptografado));
    const conta = contas.find((c) => c.id === pedida);
    if (!conta) {
      return NextResponse.json(
        { erro: "Essa conta de anúncios não está entre as que o acesso conectado enxerga." },
        { status: 400 },
      );
    }

    const metadados = { ...((integracao.metadados ?? {}) as Record<string, unknown>) };
    metadados.adAccountId = conta.id;
    metadados.adAccountNome = conta.name;
    metadados.moeda = conta.currency;

    await prisma.integracao.update({
      where: { id: integracao.id },
      // `metadados` tem forma diferente por provedor; em runtime já é JSON puro, o cast é só pro
      // TS (mesmo motivo do `comoJson` no callback do OAuth).
      data: { metadados: metadados as Prisma.InputJsonValue },
    });

    return NextResponse.json({ ok: true, adAccountId: conta.id, adAccountNome: conta.name });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao trocar a conta de anúncios.";
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }
}
