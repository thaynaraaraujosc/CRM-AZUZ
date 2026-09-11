import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHAVE_RETOMADA, type ConfigRetomada } from "@/lib/conversas/retomada";

/**
 * O modelo aprovado que o CRM manda sozinho quando a janela de 24 horas fecha.
 *
 * Escolhido UMA vez. Depois disso nenhuma automação precisa saber que a regra existe: o follow-up
 * sai, e sai com um texto que a pessoa aprovou.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const [linha, modelos] = await Promise.all([
    prisma.preferencia.findUnique({
      where: { workspaceId_chave: { workspaceId, chave: CHAVE_RETOMADA } },
      select: { dados: true },
    }),
    // Só os aprovados: oferecer um pendente seria oferecer uma escolha que a Meta recusa na hora.
    prisma.template.findMany({
      where: { workspaceId, status: "aprovado" },
      select: { id: true, nome: true, idioma: true, corpo: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return NextResponse.json({
    templateId: (linha?.dados as ConfigRetomada | null)?.templateId ?? "",
    modelos,
  });
}

export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { templateId } = (await request.json()) as { templateId?: string };
  const limpo = (templateId ?? "").trim();

  // Id vindo do navegador nunca é aceito sem conferir que ele é DESTE workspace e está aprovado.
  if (limpo) {
    const existe = await prisma.template.findFirst({
      where: { id: limpo, workspaceId, status: "aprovado" },
      select: { id: true },
    });
    if (!existe) return NextResponse.json({ erro: "Esse modelo não existe ou não está aprovado." }, { status: 400 });
  }

  const dados: ConfigRetomada = { templateId: limpo };
  await prisma.preferencia.upsert({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE_RETOMADA } },
    create: { workspaceId, chave: CHAVE_RETOMADA, dados },
    update: { dados },
  });
  return NextResponse.json({ templateId: limpo });
}
