import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { enviarEmail, templateConvite } from "@/lib/email";

/** Linha do banco -> `Membro` do front — formato de `permissoes` (JSON) e `ultimoAcesso` (Date ->
 * ISO string) mudam. */
function paraMembro(linha: { permissoes: unknown; ultimoAcesso?: Date | null; [k: string]: unknown }): Membro {
  return {
    ...linha,
    permissoes: Array.isArray(linha.permissoes) ? (linha.permissoes as string[]) : [],
    ultimoAcesso: linha.ultimoAcesso ? linha.ultimoAcesso.toISOString() : null,
  } as Membro;
}

/** GET lista os membros da equipe do workspace de quem está logado. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.membro.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json(linhas.map(paraMembro));
}

/**
 * POST cria um convite de membro novo — mesma semântica que `convidarMembro` já tinha no Context
 * (ver equipe-context.tsx): entra sem senha, inativo, com `convitePendente`, associado ao workspace
 * de quem está convidando. Se o id (slug do nome) já existir, retorna o membro existente em vez de
 * duplicar.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = (await request.json()) as Pick<
    Membro,
    "nome" | "email" | "papel" | "papelTipo" | "papelNota" | "enxerga" | "permissoes"
  >;
  if (!dados.nome || !dados.email) {
    return NextResponse.json({ erro: "Campos obrigatórios: nome, email" }, { status: 400 });
  }

  const id = slugId(dados.nome);
  const existente = await prisma.membro.findUnique({ where: { id } });
  if (existente) {
    return NextResponse.json(paraMembro(existente));
  }

  const initials = dados.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const linha = await prisma.membro.create({
    data: {
      id,
      workspaceId: sessao.user.workspaceId,
      initials,
      nome: dados.nome,
      email: dados.email,
      senha: null,
      papel: dados.papel,
      papelTipo: dados.papelTipo,
      papelNota: dados.papelNota,
      leads: "—",
      enxerga: dados.enxerga,
      permissoes: dados.permissoes,
      ativo: false,
      convitePendente: true,
    },
  });

  const link = `${process.env.APP_URL ?? "https://azuzcrm.com.br"}/convite/${id}`;
  await enviarEmail({
    to: dados.email,
    subject: `${sessao.user.workspaceNome ?? "Alguém"} te convidou pro CRM AZUZ`,
    html: templateConvite(dados.nome, sessao.user.workspaceNome ?? "o workspace", link),
  });

  return NextResponse.json(paraMembro(linha), { status: 201 });
}
