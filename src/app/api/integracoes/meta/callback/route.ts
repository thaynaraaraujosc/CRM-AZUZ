import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { encriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL, verificarState } from "@/lib/integracoes/meta";

/** `metadados` tem forma diferente por provedor (união estrutural que o Prisma não casa com
 * `InputJsonValue` automaticamente) — o valor em runtime já é JSON puro, o cast é só pro TS. */
function comoJson(valor: Record<string, unknown>): Prisma.InputJsonValue {
  return valor as Prisma.InputJsonValue;
}

type ErroGraph = { error?: { message?: string } };

async function graphGet<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${META_GRAPH_URL}${caminho}`);
  const corpo = (await resposta.json()) as T & ErroGraph;
  if (!resposta.ok) {
    throw new Error(corpo.error?.message ?? `Falha na Graph API (${resposta.status})`);
  }
  return corpo;
}

async function graphPost<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${META_GRAPH_URL}${caminho}`, { method: "POST" });
  const corpo = (await resposta.json()) as T & ErroGraph;
  if (!resposta.ok) {
    throw new Error(corpo.error?.message ?? `Falha na Graph API (${resposta.status})`);
  }
  return corpo;
}

/** Página em Configurações (ou fora dela, no caso do Ads) pra onde volta depois do OAuth. */
const CATEGORIA_POR_PROVEDOR: Record<string, string> = {
  meta_whatsapp: "/configuracoes?categoria=whatsapp",
  meta_ads: "/trafego",
};

/** Resolve o token de longa duração (~60 dias) a partir do `code` do OAuth — comum aos 3 provedores. */
async function trocarCodePorToken(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string,
): Promise<{ accessToken: string; expiraEm: Date | null }> {
  const tokenCurto = await graphGet<{ access_token: string }>(
    `/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
  );
  const tokenLongo = await graphGet<{ access_token: string; expires_in?: number }>(
    `/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenCurto.access_token}`,
  );
  return {
    accessToken: tokenLongo.access_token,
    expiraEm: tokenLongo.expires_in ? new Date(Date.now() + tokenLongo.expires_in * 1000) : null,
  };
}

/** Resolve o WhatsApp Business Account + número conectados — lógica original da Fase A, inalterada. */
async function resolverWhatsapp(accessToken: string) {
  const negocios = await graphGet<{ data: { id: string; name: string }[] }>(`/me/businesses?access_token=${accessToken}`);
  const negocio = negocios.data?.[0];
  if (!negocio) throw new Error("Nenhum Business Manager encontrado nessa conta.");

  const wabas = await graphGet<{ data: { id: string; name: string }[] }>(
    `/${negocio.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`,
  );
  const waba = wabas.data?.[0];
  if (!waba) throw new Error("Nenhuma conta do WhatsApp Business encontrada nesse Business Manager.");

  const numeros = await graphGet<{ data: { id: string; display_phone_number: string; verified_name: string }[] }>(
    `/${waba.id}/phone_numbers?access_token=${accessToken}`,
  );
  const numero = numeros.data?.[0];
  if (!numero) throw new Error("Nenhum número de telefone encontrado nessa conta do WhatsApp Business.");

  // Sem isso, a Meta nunca manda os eventos de mensagem recebida pro nosso webhook — o app fica
  // "conectado" (o resto acima funcionou) mas nenhuma mensagem real chega, porque o WABA nunca foi
  // inscrito pra notificar ESTE app especificamente (é inscrição por WABA, não automática por OAuth).
  await graphPost(`/${waba.id}/subscribed_apps?access_token=${accessToken}`);

  return {
    accessToken,
    metadados: {
      businessId: negocio.id,
      businessNome: negocio.name,
      wabaId: waba.id,
      phoneNumberId: numero.id,
      numeroExibicao: numero.display_phone_number,
      numeroVerificado: numero.verified_name,
    },
  };
}

/** Resolve a conta de anúncios (ad account) — prioriza uma ativa, senão pega a primeira. */
async function resolverAds(accessToken: string) {
  const contas = await graphGet<{ data: { id: string; name: string; account_status: number; currency: string }[] }>(
    `/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`,
  );
  const conta = contas.data?.find((c) => c.account_status === 1) ?? contas.data?.[0];
  if (!conta) throw new Error("Nenhuma conta de anúncios encontrada nessa conta.");

  return {
    accessToken,
    metadados: { adAccountId: conta.id, adAccountNome: conta.name, moeda: conta.currency },
  };
}

/**
 * GET recebe a volta do diálogo OAuth da Meta — pro provedor que estava assinado no `state`. Troca
 * o `code` pelo token, resolve os recursos daquele provedor, e grava tudo em `Integracao` — sempre
 * no workspace do `state` (nunca de uma sessão nova, o navegador pode ter perdido a sessão original
 * durante o redirect).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const resultadoState = verificarState(url.searchParams.get("state"));
  const workspaceId = resultadoState?.workspaceId;
  const provedor = resultadoState?.provedor;

  const redirecionarConfig = new URL(provedor ? (CATEGORIA_POR_PROVEDOR[provedor] ?? "/configuracoes") : "/configuracoes", url.origin);

  if (!workspaceId || !provedor) {
    redirecionarConfig.searchParams.set("integracaoErro", "Link de autorização inválido ou expirado.");
    return NextResponse.redirect(redirecionarConfig);
  }
  if (!code) {
    redirecionarConfig.searchParams.set("integracaoErro", "Autorização cancelada.");
    return NextResponse.redirect(redirecionarConfig);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    redirecionarConfig.searchParams.set("integracaoErro", "Integração não configurada no servidor.");
    return NextResponse.redirect(redirecionarConfig);
  }

  const redirectUri = `${url.origin}/api/integracoes/meta/callback`;

  try {
    const { accessToken: accessTokenUsuario, expiraEm } = await trocarCodePorToken(code, redirectUri, appId, appSecret);

    let resolvido: { accessToken: string; metadados: Record<string, unknown> };
    switch (provedor) {
      case "meta_whatsapp":
        resolvido = await resolverWhatsapp(accessTokenUsuario);
        break;
      case "meta_ads":
        resolvido = await resolverAds(accessTokenUsuario);
        break;
      default:
        throw new Error(`Provedor desconhecido: ${provedor}`);
    }

    // Preserva preferências guardadas em `metadados` que não vêm da Graph API (ex.: o toggle
    // "Receber mensagens do Instagram no CRM", ver PATCH em /api/integracoes/meta) — sem isso, toda
    // reconexão apagaria essa escolha e voltaria ao padrão sozinha.
    const existente = await prisma.integracao.findUnique({
      where: { workspaceId_provedor: { workspaceId, provedor } },
      select: { metadados: true },
    });
    const metadadosPreservados = (existente?.metadados as Record<string, unknown> | null) ?? {};
    const metadadosFinal = comoJson({ ...metadadosPreservados, ...resolvido.metadados });

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor } },
      create: {
        id: `integracao-${workspaceId}-${provedor}`,
        workspaceId,
        provedor,
        status: "conectado",
        accessTokenCriptografado: encriptar(resolvido.accessToken),
        expiraEm,
        metadados: metadadosFinal,
        erroMensagem: null,
      },
      update: {
        status: "conectado",
        accessTokenCriptografado: encriptar(resolvido.accessToken),
        expiraEm,
        metadados: metadadosFinal,
        erroMensagem: null,
      },
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida ao conectar a integração.";
    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor } },
      create: {
        id: `integracao-${workspaceId}-${provedor}`,
        workspaceId,
        provedor,
        status: "erro",
        erroMensagem: mensagem,
      },
      update: { status: "erro", erroMensagem: mensagem },
    });
    redirecionarConfig.searchParams.set("integracaoErro", mensagem);
    return NextResponse.redirect(redirecionarConfig);
  }

  return NextResponse.redirect(redirecionarConfig);
}
