import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { encriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL, verificarState } from "@/lib/integracoes/meta";

type ErroGraph = { error?: { message?: string } };

async function graphGet<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${META_GRAPH_URL}${caminho}`);
  const corpo = (await resposta.json()) as T & ErroGraph;
  if (!resposta.ok) {
    throw new Error(corpo.error?.message ?? `Falha na Graph API (${resposta.status})`);
  }
  return corpo;
}

/**
 * GET recebe a volta do diálogo OAuth da Meta. Troca o `code` pelo token, resolve o WABA e o
 * número de telefone conectados, e grava tudo em `Integracao` — sempre no workspace do `state`
 * (nunca de uma sessão nova, o navegador pode ter perdido a sessão original durante o redirect).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const workspaceId = verificarState(url.searchParams.get("state"));
  const redirecionarConfig = new URL("/configuracoes?categoria=whatsapp", url.origin);

  if (!workspaceId) {
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
    const tokenCurto = await graphGet<{ access_token: string }>(
      `/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
    );

    // Troca pelo token de longa duração (~60 dias) — o curto expira em poucas horas.
    const tokenLongo = await graphGet<{ access_token: string; expires_in?: number }>(
      `/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenCurto.access_token}`,
    );
    const accessToken = tokenLongo.access_token;

    const negocios = await graphGet<{ data: { id: string; name: string }[] }>(
      `/me/businesses?access_token=${accessToken}`,
    );
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

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
      create: {
        id: `integracao-${workspaceId}-meta_whatsapp`,
        workspaceId,
        provedor: "meta_whatsapp",
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        expiraEm: tokenLongo.expires_in ? new Date(Date.now() + tokenLongo.expires_in * 1000) : null,
        metadados: {
          businessId: negocio.id,
          businessNome: negocio.name,
          wabaId: waba.id,
          phoneNumberId: numero.id,
          numeroExibicao: numero.display_phone_number,
          numeroVerificado: numero.verified_name,
        },
        erroMensagem: null,
      },
      update: {
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        expiraEm: tokenLongo.expires_in ? new Date(Date.now() + tokenLongo.expires_in * 1000) : null,
        metadados: {
          businessId: negocio.id,
          businessNome: negocio.name,
          wabaId: waba.id,
          phoneNumberId: numero.id,
          numeroExibicao: numero.display_phone_number,
          numeroVerificado: numero.verified_name,
        },
        erroMensagem: null,
      },
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida ao conectar o WhatsApp.";
    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
      create: {
        id: `integracao-${workspaceId}-meta_whatsapp`,
        workspaceId,
        provedor: "meta_whatsapp",
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
