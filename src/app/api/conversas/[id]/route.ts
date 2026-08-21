import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** PATCH atualiza campos pontuais de uma conversa (marcar como lida, favoritar, arquivar, mudar
 * status ou atendente) — só mexe em conversa do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/conversas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const dados = (await request.json()) as {
    naoLidas?: number;
    favorita?: boolean;
    arquivada?: boolean;
    status?: string;
    atendenteSelecionado?: string | null;
    fotoUrl?: string | null;
  };

  const { count } = await prisma.conversa.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: dados,
  });
  if (count === 0) return NextResponse.json({ erro: "Conversa não encontrada" }, { status: 404 });

  const linha = await prisma.conversa.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(linha);
}

/** DELETE apaga a conversa e as mensagens dela — usado pra limpar uma conversa avulsa que nasceu
 * errada (ex.: mensagem de grupo importada sem reconhecer o grupo, virou uma conversa solta com o
 * nome/telefone de quem escreveu em vez de cair dentro da thread do grupo). Não desfaz sozinho:
 * mensagem nova chegando de novo pra esse mesmo nome cria a conversa de novo. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/conversas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const conversa = await prisma.conversa.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { nome: true },
  });
  if (!conversa) return NextResponse.json({ erro: "Conversa não encontrada" }, { status: 404 });

  await prisma.$transaction([
    prisma.mensagemExtra.deleteMany({ where: { workspaceId: sessao.user.workspaceId, contato: conversa.nome } }),
    prisma.conversa.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
