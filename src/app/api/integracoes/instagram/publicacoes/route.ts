import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { classificarErroMeta, listarPublicacoesInstagram } from "@/lib/integracoes/instagram-login";

/**
 * Publicações da conta conectada: pra escolher em qual delas uma automação de comentário vale.
 *
 * Só leitura, e nada é guardado: a lista muda toda vez que a pessoa publica, e uma cópia no banco
 * envelheceria em horas. O custo é uma chamada à Meta quando o editor de automações abre a lista.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor_slot: { workspaceId: sessao.user.workspaceId, provedor: "meta_instagram", slot: 1 } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  try {
    /*
     * QUANTAS PUBLICAÇÕES. O padrão continua 25, que é o que a grade da tela mostra.
     *
     * A gaveta de gatilhos pede 100 por causa do "Meu próximo post": ele guarda os ids que já
     * existem pra saber depois o que é novo, e quanto mais completa essa foto, menor a chance de
     * um comentário numa publicação antiga ser tratado como se fosse no post seguinte.
     */
    const pedido = Number(new URL(request.url).searchParams.get("limite"));
    const limite = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 1), 100) : 25;
    const publicacoes = await listarPublicacoesInstagram(decriptar(integracao.accessTokenCriptografado), limite);
    return NextResponse.json({ publicacoes }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    const bruto = erro instanceof Error ? erro.message : "Falha ao buscar publicações.";
    // A mensagem crua da Meta é técnica e em inglês; o que volta pra tela diz o que fazer.
    const { explicacao } = classificarErroMeta(bruto);
    return NextResponse.json({ erro: explicacao }, { status: 502 });
  }
}
