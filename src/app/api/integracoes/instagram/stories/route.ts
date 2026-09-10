import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { classificarErroMeta, listarStoriesAtivos } from "@/lib/integracoes/instagram-login";

/**
 * Os stories que estão no ar agora: pra escolher a qual deles uma automação de resposta vale.
 *
 * Sempre ao vivo, nunca guardado. Story dura 24 horas, e uma cópia no banco estaria errada antes
 * do fim do dia. O custo é uma chamada à Meta quando o editor abre esse campo.
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
    const stories = await listarStoriesAtivos(decriptar(integracao.accessTokenCriptografado));
    return NextResponse.json({ stories }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    const bruto = erro instanceof Error ? erro.message : "Falha ao buscar os stories.";
    const { explicacao } = classificarErroMeta(bruto);
    return NextResponse.json({ erro: explicacao }, { status: 502 });
  }
}
