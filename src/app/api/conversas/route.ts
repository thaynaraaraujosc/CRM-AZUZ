import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET lista as conversas do workspace de quem está logado, mais recentes primeiro. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.conversa.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { atualizadoEm: "desc" },
  });
  return NextResponse.json(linhas);
}

/**
 * POST cria uma conversa individual vazia (sem mensagem ainda) — usado quando a usuária quer ser a
 * PRIMEIRA a escrever pra alguém, ex.: um participante de grupo que ela nunca conversou fora do
 * grupo. Se já existir uma conversa com esse `contato` (telefone) no workspace, devolve ela em vez
 * de duplicar.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { nome, contato, canal } = (await request.json()) as {
    nome?: string;
    contato?: string;
    canal?: string;
  };
  if (!nome?.trim() || !contato?.trim()) {
    return NextResponse.json({ erro: "nome e contato são obrigatórios" }, { status: 400 });
  }

  const existente = await prisma.conversa.findFirst({
    where: { workspaceId: sessao.user.workspaceId, contato: contato.trim(), ehGrupo: false },
  });
  if (existente) return NextResponse.json(existente);

  const iniciais =
    nome
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join("")
      .toUpperCase() || "?";

  const criada = await prisma.conversa.create({
    data: {
      id: `conversa-${Date.now()}`,
      workspaceId: sessao.user.workspaceId,
      nome: nome.trim(),
      initials: iniciais,
      canal: canal ?? "WhatsApp",
      contato: contato.trim(),
    },
  });
  return NextResponse.json(criada);
}
