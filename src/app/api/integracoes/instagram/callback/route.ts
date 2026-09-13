import { NextResponse } from "next/server";
import { after } from "next/server";
import { explicarErroDoInstagram } from "@/lib/integracoes/erro-instagram";
import { avisoDeContaOcupada, contaOcupadaPorOutroWorkspace } from "@/lib/integracoes/conta-ja-conectada";
import { importarConversasRecentesDoInstagram } from "@/lib/integracoes/historico-instagram";

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
 * GET recebe a volta do diálogo de "Login do Instagram". Mesmo padrão do callback da Meta
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

    /*
     * A MESMA conta do Instagram não pode alimentar dois workspaces.
     *
     * O webhook da Meta chega identificado pela conta, não pelo workspace, e o roteamento pega a
     * primeira integração conectada com aquele identificador. Com duas, uma sempre ganha e a outra
     * nunca recebe nada, dizendo "Conectado" o tempo todo. Recusar aqui, com o nome da empresa que
     * já tem a conta, troca horas de investigação por uma frase.
     */
    const ocupada = await contaOcupadaPorOutroWorkspace({
      provedor: "meta_instagram",
      campo: "instagramContaId",
      identificador: perfil.instagramContaId || instagramContaId,
      workspaceId,
    });
    if (ocupada) throw new Error(avisoDeContaOcupada("Instagram", ocupada));

    // Assinatura dos eventos da conta. Autorizar no OAuth dá acesso, não assina webhook. Sem este
    // passo a conta fica "Conectada" e nenhuma mensagem do Direct chega (ver o comentário da
    // função). O erro, se houver, fica guardado pra tela poder avisar em vez de mentir "conectado".
    const erroAssinatura = await inscreverAppNoInstagram(accessToken);

    const metadadosResolvidos = {
      instagramContaId: perfil.instagramContaId || instagramContaId,
      instagramUsername: perfil.username,
      assinaturaWebhookErro: erroAssinatura,
    };

    // Preserva o que não vem dessa troca (ex.: o toggle "Receber mensagens do Instagram no CRM",
    // e um eventual `pageNome`/`pageId` de uma conexão antiga via Página do Facebook). Mesma
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

    /*
     * Traz as conversas recentes do Direct, DEPOIS de responder o redirecionamento.
     *
     * Sem isto a caixa de entrada ficava vazia até alguém escrever de novo, e quem acabou de
     * conectar concluía, com razão, que não tinha funcionado. Roda em `after` porque a pessoa está
     * esperando o navegador voltar pro CRM: segurar o redirecionamento por causa disso trocaria uma
     * tela vazia por uma tela travada.
     *
     * Falhar aqui não desfaz a conexão, que está correta. Só não há histórico pra mostrar, e o que
     * chegar a partir de agora entra normalmente pelo webhook.
     */
    after(async () => {
      await importarConversasRecentesDoInstagram(workspaceId).catch((erro) =>
        console.error("[instagram/callback] falha ao importar as conversas recentes:", erro),
      );
    });
  } catch (erro) {
    const cru = erro instanceof Error ? erro.message : "Falha desconhecida ao conectar o Instagram.";
    // A frase da Meta manda "entrar no instagram.com e seguir as instruções", que é exatamente o
    // que a pessoa acabou de fazer. Traduz pro que realmente resolve. Ver `erro-instagram.ts`.
    const mensagem = explicarErroDoInstagram(cru);
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
