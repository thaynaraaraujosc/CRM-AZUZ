import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST desconecta o WhatsApp Business do workspace de quem está logado. */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  await prisma.integracao.updateMany({
    where: { workspaceId: sessao.user.workspaceId, provedor: "meta_whatsapp" },
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
