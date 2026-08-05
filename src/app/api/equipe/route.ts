import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";

/** Linha do banco -> `Membro` do front — só o formato de `permissoes` (JSON no banco) muda. */
function paraMembro(linha: { permissoes: unknown; [k: string]: unknown }): Membro {
  return {
    ...linha,
    permissoes: Array.isArray(linha.permissoes) ? (linha.permissoes as string[]) : [],
  } as Membro;
}

/** GET lista todos os membros da equipe. */
export async function GET() {
  const linhas = await prisma.membro.findMany({ orderBy: { criadoEm: "asc" } });
  return NextResponse.json(linhas.map(paraMembro));
}

/**
 * POST cria um convite de membro novo — mesma semântica que `convidarMembro` já tinha no Context
 * (ver equipe-context.tsx): entra sem senha, inativo, com `convitePendente`. Se o id (slug do nome)
 * já existir, retorna o membro existente em vez de duplicar.
 */
export async function POST(request: Request) {
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

  return NextResponse.json(paraMembro(linha), { status: 201 });
}
