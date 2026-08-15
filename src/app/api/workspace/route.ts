import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET devolve as colunas reais do `Workspace` (`nome`/`segmento`) — fonte única de verdade pra
 * Configurações > Workspace, em vez do blob genérico de preferências (que só guarda o resto dos
 * campos descritivos: país, cidade, fuso, idioma, moeda, formatos). Sem isso, o formulário
 * carregava o nome/segmento do blob (que podia nascer vazio ou dessincronizar da coluna real usada
 * na sessão/sidebar/e-mails), dando a impressão de que editar "não salvava".
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: sessao.user.workspaceId },
    select: { nome: true, segmento: true },
  });
  if (!workspace) return NextResponse.json({ erro: "Workspace não encontrado" }, { status: 404 });

  return NextResponse.json({ nome: workspace.nome, segmento: workspace.segmento ?? "" });
}

/**
 * PATCH atualiza colunas reais do `Workspace` (`nome`/`segmento`) — `nome` precisa ser coluna de
 * verdade porque é lido em vários lugares fora desse formulário (sidebar via sessão, e-mail de
 * convite, PDF de relatório, painel de super-admin); `segmento` virou coluna pelo mesmo motivo —
 * um dado que "pertence à conta" não pode viver só num blob que pode nascer vazio ou dessincronizar.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o admin do workspace pode editar essas informações." }, { status: 403 });
  }

  const { nome, segmento } = (await request.json()) as { nome?: string; segmento?: string };
  if (nome !== undefined && !nome.trim()) {
    return NextResponse.json({ erro: "Nome não pode ficar vazio." }, { status: 400 });
  }

  await prisma.workspace.update({
    where: { id: sessao.user.workspaceId },
    data: {
      ...(nome !== undefined ? { nome: nome.trim() } : {}),
      ...(segmento !== undefined ? { segmento: segmento.trim() || null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
