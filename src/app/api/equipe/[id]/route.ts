import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function paraMembro(linha: { permissoes: unknown; [k: string]: unknown }): Membro {
  return {
    ...linha,
    permissoes: Array.isArray(linha.permissoes) ? (linha.permissoes as string[]) : [],
  } as Membro;
}

/**
 * Os campos que esta rota aceita mudar. LISTA FECHADA, e é o ponto dela.
 *
 * Antes o corpo era espalhado direto no `update` (`data: { ...dados }`), o que significa que
 * qualquer campo mandado pelo navegador ia pro banco: `senha` (que aqui entraria como texto puro,
 * quebrando o login de quem depende do hash), `convitePendente` (marcar alguém como já aceito sem
 * nunca ter aceitado), `workspaceId` (mover um membro pra outra empresa). Nada disso era intenção
 * de ninguém; era só o `...` fazendo o que `...` faz.
 *
 * `senha` NÃO está aqui de propósito: senha se define por convite ou por "Gerar nova senha", que
 * são os caminhos que passam pelo hash.
 */
const CAMPOS_EDITAVEIS = [
  "nome",
  "email",
  "initials",
  "papel",
  "papelTipo",
  "papelNota",
  "leads",
  "enxerga",
  "permissoes",
  "ativo",
  "foto",
] as const;

/** Atualização direta por id: usada por `editarMembro`/`alternarAtivo`. Só mexe em membro do
 * mesmo workspace de quem está logado (senão qualquer id daria pra editar gente de outra empresa). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const corpo = (await request.json()) as Partial<Membro> & Record<string, unknown>;

  const dados: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (corpo[campo] !== undefined) dados[campo] = corpo[campo];
  }
  if (!Object.keys(dados).length) {
    return NextResponse.json({ erro: "Nada pra atualizar." }, { status: 400 });
  }

  // E-mail é chave única e é por ele que se entra no CRM. Trocar pra um que já pertence a outra
  // pessoa faria o banco recusar com um erro técnico; aqui a recusa vem em português, antes.
  if (typeof dados.email === "string") {
    const email = dados.email.trim().toLowerCase();
    if (!email.includes("@")) return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
    const jaUsado = await prisma.membro.findFirst({ where: { email, NOT: { id } }, select: { id: true } });
    if (jaUsado) {
      return NextResponse.json({ erro: "Já existe alguém com esse e-mail." }, { status: 409 });
    }
    dados.email = email;
  }

  const { count } = await prisma.membro.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: dados,
  });
  if (count === 0) {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }

  const linha = await prisma.membro.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(paraMembro(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.membro.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
