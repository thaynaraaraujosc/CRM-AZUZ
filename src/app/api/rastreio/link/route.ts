import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * O link rastreado desta empresa, pronto pra colar no botão de WhatsApp do site.
 *
 * Devolve também se existe número conectado: sem número o link não tem pra onde mandar ninguém, e
 * é melhor a tela dizer isso do que entregar um endereço que leva pra lugar nenhum.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: sessao.user.workspaceId },
    select: { slug: true },
  });
  if (!workspace) return NextResponse.json({ erro: "Workspace não encontrado" }, { status: 404 });

  const conexoes = await prisma.integracao.findMany({
    where: {
      workspaceId: sessao.user.workspaceId,
      provedor: { in: ["meta_whatsapp", "whatsapp_nao_oficial"] },
      status: "conectado",
    },
    select: { metadados: true },
  });
  const numero = conexoes
    .map((c) => {
      const d = (c.metadados as Record<string, unknown> | null) ?? {};
      return (d.numeroExibicao ?? d.numero ?? d.telefone) as string | undefined;
    })
    .find((n) => n && n.replace(/\D/g, "").length >= 10);

  const origem = new URL(request.url).origin;
  return NextResponse.json({
    link: `${origem}/ir/${workspace.slug}`,
    temNumero: Boolean(numero),
    numero: numero ?? null,
  });
}
