import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Rota genérica pra blobs de preferência sem entidade própria (Notificações, Central do Dia,
 * Configurações, Conversas-config) — cada Context é uma linha só por workspace, identificada por
 * (workspaceId, chave) (ex.: "notificacoes"). GET devolve o objeto salvo ou `{}` se ainda não
 * existir (Provider aplica os próprios defaults nesse caso, igual já fazia lendo de um localStorage
 * vazio).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/preferencias/[chave]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { chave } = await ctx.params;
  const linha = await prisma.preferencia.findUnique({
    where: { workspaceId_chave: { workspaceId: sessao.user.workspaceId, chave } },
  });
  return NextResponse.json(linha?.dados ?? {});
}

export async function PUT(request: Request, ctx: RouteContext<"/api/preferencias/[chave]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { chave } = await ctx.params;
  const dados = await request.json();

  await prisma.preferencia.upsert({
    where: { workspaceId_chave: { workspaceId, chave } },
    create: { workspaceId, chave, dados },
    update: { dados },
  });

  return NextResponse.json({ ok: true });
}
