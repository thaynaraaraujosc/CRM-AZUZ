import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { limparDadosDoWhatsApp } from "@/lib/integracoes/limpar-dados-whatsapp";

/** POST desconecta a integração da Meta (`?provedor=`, default `meta_whatsapp`) do workspace de
 * quem está logado. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const provedor = new URL(request.url).searchParams.get("provedor") ?? "meta_whatsapp";
  // `limparDados` vem do clique de quem já confirmou na tela o que vai ser apagado — nunca é o
  // padrão, porque é irreversível. Só faz sentido pro canal de WhatsApp (Ads/Instagram não
  // espelham conversa nenhuma pro CRM).
  const { limparDados } = await request
    .json()
    .then((corpo: { limparDados?: boolean }) => corpo)
    .catch(() => ({ limparDados: false }));

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

  const limpeza =
    limparDados && provedor === "meta_whatsapp"
      ? await limparDadosDoWhatsApp(sessao.user.workspaceId, "oficial")
      : null;

  return NextResponse.json({ ok: true, limpeza });
}
