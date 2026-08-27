import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { encriptar } from "@/lib/integracoes/crypto";
import {
  trocarCodePorTokenInstagram,
  buscarPerfilInstagram,
  inscreverAppNoInstagram,
  verificarStateInstagram,
} from "@/lib/integracoes/instagram-login";

function comoJson(valor: Record<string, unknown>): Prisma.InputJsonValue {
  return valor as Prisma.InputJsonValue;
}

/**
 * GET recebe a volta do diálogo de "Login do Instagram" — mesmo padrão do callback da Meta
 * principal (src/app/api/integracoes/meta/callback/route.ts), mas nesse fluxo o `state` só carrega
 * o workspaceId (o provedor é sempre `meta_instagram`, não tem outro provedor possível aqui).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const workspaceId = verificarStateInstagram(url.searchParams.get("state"));
  const provedor = "meta_instagram";

  const redirecionarConfig = new URL("/configuracoes?categoria=instagram", url.origin);

  if (!workspaceId) {
    redirecionarConfig.searchParams.set("integracaoErro", "Link de autorização inválido ou expirado.");
    return NextResponse.redirect(redirecionarConfig);
  }
  if (!code) {
    redirecionarConfig.searchParams.set("integracaoErro", "Autorização cancelada.");
    return NextResponse.redirect(redirecionarConfig);
  }

  const redirectUri = `${url.origin}/api/integracoes/instagram/callback`;

  try {
    const { accessToken, instagramContaId, expiraEm } = await trocarCodePorTokenInstagram(code, redirectUri);
    const perfil = await buscarPerfilInstagram(accessToken);

    // Assinatura dos eventos da conta — autorizar no OAuth dá acesso, não assina webhook. Sem este
    // passo a conta fica "Conectada" e nenhuma mensagem do Direct chega (ver o comentário da
    // função). O erro, se houver, fica guardado pra tela poder avisar em vez de mentir "conectado".
    const erroAssinatura = await inscreverAppNoInstagram(accessToken);

    const metadadosResolvidos = {
      instagramContaId: perfil.instagramContaId || instagramContaId,
      instagramUsername: perfil.username,
      assinaturaWebhookErro: erroAssinatura,
    };

    // Preserva o que não vem dessa troca (ex.: o toggle "Receber mensagens do Instagram no CRM",
    // e um eventual `pageNome`/`pageId` de uma conexão antiga via Página do Facebook) — mesma
    // lógica de merge do callback principal, pelo mesmo motivo: reconectar não pode apagar
    // preferência salva.
    const existente = await prisma.integracao.findUnique({
      where: { workspaceId_provedor: { workspaceId, provedor } },
      select: { metadados: true },
    });
    const metadadosPreservados = (existente?.metadados as Record<string, unknown> | null) ?? {};
    const metadadosFinal = comoJson({ ...metadadosPreservados, ...metadadosResolvidos });

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor } },
      create: {
        id: `integracao-${workspaceId}-${provedor}`,
        workspaceId,
        provedor,
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        expiraEm,
        metadados: metadadosFinal,
        erroMensagem: null,
      },
      update: {
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        expiraEm,
        metadados: metadadosFinal,
        erroMensagem: null,
      },
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida ao conectar o Instagram.";
    console.error("[instagram/callback] falha ao conectar:", erro);
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
