import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH atualiza colunas reais do `Workspace` (hoje só `nome`) — diferente da rota genérica
 * `/api/preferencias/configuracoes`, que guarda os campos descritivos (segmento, país, cidade,
 * fuso, idioma, moeda, formatos) num blob JSON. `nome` precisa ser coluna de verdade porque é lido
 * em vários lugares fora desse blob (sidebar via sessão, painel de super-admin, `Workspace.slug`
 * indiretamente) — sem essa rota, renomear o workspace em Configurações nunca refletia fora da
 * própria tela.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o admin do workspace pode editar essas informações." }, { status: 403 });
  }

  const { nome } = (await request.json()) as { nome?: string };
  if (!nome?.trim()) {
    return NextResponse.json({ erro: "Nome não pode ficar vazio." }, { status: 400 });
  }

  await prisma.workspace.update({
    where: { id: sessao.user.workspaceId },
    data: { nome: nome.trim() },
  });

  return NextResponse.json({ ok: true });
}
