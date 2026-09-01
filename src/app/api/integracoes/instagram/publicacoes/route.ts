import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { classificarErroMeta, listarPublicacoesInstagram } from "@/lib/integracoes/instagram-login";

/**
 * Publicações da conta conectada — pra escolher em qual delas uma automação de comentário vale.
 *
 * Só leitura, e nada é guardado: a lista muda toda vez que a pessoa publica, e uma cópia no banco
 * envelheceria em horas. O custo é uma chamada à Meta quando o editor de automações abre a lista.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  try {
    const publicacoes = await listarPublicacoesInstagram(decriptar(integracao.accessTokenCriptografado));
    return NextResponse.json({ publicacoes }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    const bruto = erro instanceof Error ? erro.message : "Falha ao buscar publicações.";
    // A mensagem crua da Meta é técnica e em inglês; o que volta pra tela diz o que fazer.
    const { explicacao } = classificarErroMeta(bruto);
    return NextResponse.json({ erro: explicacao }, { status: 502 });
  }
}
