import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST desconecta a integração da Meta (`?provedor=`, default `meta_whatsapp`) do workspace de
 * quem está logado. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const provedor = new URL(request.url).searchParams.get("provedor") ?? "meta_whatsapp";

  await prisma.integracao.updateMany({
    where: { workspaceId: sessao.user.workspaceId, provedor },
    data: {
      status: "desconectado",
      accessTokenCriptografado: null,
      refreshTokenCriptografado: null,
      expiraEm: null,
      metadados: undefined,
      erroMensagem: null,
    },
  });

  return NextResponse.json({ ok: true });
}
