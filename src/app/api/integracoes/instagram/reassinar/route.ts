import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { inscreverAppNoInstagram } from "@/lib/integracoes/instagram-login";

/**
 * Refaz a assinatura dos webhooks da conta do Instagram já conectada.
 *
 * A assinatura é feita UMA vez, no momento de conectar. Se ela falhar ali — e já falhou, por um
 * nome de campo errado do nosso lado — a conta fica "Conectada" e nenhuma mensagem chega, sem que
 * nada na tela indique o que fazer. A única saída era desconectar e conectar de novo, um passo que
 * assusta (parece que vai perder as conversas) e que ninguém adivinha sozinho.
 *
 * Este botão refaz só a assinatura, sem tocar na conexão nem nos dados.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  const erro = await inscreverAppNoInstagram(decriptar(integracao.accessTokenCriptografado));

  const metadados = (integracao.metadados as Record<string, unknown> | null) ?? {};
  await prisma.integracao.update({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
    data: {
      metadados: { ...metadados, assinaturaWebhookErro: erro } as Prisma.InputJsonValue,
    },
  });

  if (erro) return NextResponse.json({ erro }, { status: 502 });
  return NextResponse.json({ ok: true });
}
