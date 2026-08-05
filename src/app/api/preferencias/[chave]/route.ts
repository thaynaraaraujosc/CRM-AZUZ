import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Rota genérica pra blobs de preferência sem entidade própria (Notificações, Central do Dia,
 * Configurações, Conversas-config) — cada Context é uma linha só, identificada pela chave
 * (ex.: "notificacoes"). GET devolve o objeto salvo ou `{}` se ainda não existir (Provider aplica
 * os próprios defaults nesse caso, igual já fazia lendo de um localStorage vazio).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/preferencias/[chave]">) {
  const { chave } = await ctx.params;
  const linha = await prisma.preferencia.findUnique({ where: { chave } });
  return NextResponse.json(linha?.dados ?? {});
}

export async function PUT(request: Request, ctx: RouteContext<"/api/preferencias/[chave]">) {
  const { chave } = await ctx.params;
  const dados = await request.json();

  await prisma.preferencia.upsert({
    where: { chave },
    create: { chave, dados },
    update: { dados },
  });

  return NextResponse.json({ ok: true });
}
