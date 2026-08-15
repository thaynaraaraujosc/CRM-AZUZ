import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

/** GET (chamado pela página server-side, ver `/convite/[id]`) devolve os dados públicos do convite
 * — sem autenticação, porque quem está aceitando ainda não tem conta. Só existe pra centralizar a
 * regra "só é válido se ainda estiver pendente" num lugar. */
export async function GET(_request: Request, ctx: RouteContext<"/api/convite/[id]">) {
  const { id } = await ctx.params;
  const membro = await prisma.membro.findUnique({
    where: { id },
    include: { workspace: { select: { nome: true } } },
  });
  if (!membro || !membro.convitePendente) {
    return NextResponse.json({ erro: "Convite não encontrado ou já usado." }, { status: 404 });
  }
  return NextResponse.json({ nome: membro.nome, email: membro.email, workspaceNome: membro.workspace.nome });
}

/** POST aceita o convite: define a senha de verdade, ativa a conta e marca o convite como usado.
 * Sem autenticação (a pessoa ainda não tem login) — a validação é "esse id existe e ainda está
 * pendente", mesma regra do GET. */
export async function POST(request: Request, ctx: RouteContext<"/api/convite/[id]">) {
  const { id } = await ctx.params;
  const { senha } = (await request.json()) as { senha?: string };
  if (!senha || senha.length < 8) {
    return NextResponse.json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }

  const membro = await prisma.membro.findUnique({ where: { id } });
  if (!membro || !membro.convitePendente) {
    return NextResponse.json({ erro: "Convite não encontrado ou já usado." }, { status: 404 });
  }

  const hash = await bcrypt.hash(senha, 10);
  await prisma.membro.update({
    where: { id },
    data: { senha: hash, ativo: true, convitePendente: false },
  });

  return NextResponse.json({ ok: true });
}
