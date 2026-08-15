import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";

/** Seed padrão criado no primeiro acesso do workspace a essa lista — editável/removível depois,
 * não é fixo por código (diferente do seed de `prisma/seed.ts`, que só semeia o workspace de
 * demonstração). */
const MOTIVOS_PADRAO = ["Achou caro", "Sem retorno", "Fechou com concorrente", "Não era o momento", "Outro"];

/** GET lista os motivos de perda do workspace — semeia os padrões na primeira vez (nenhum motivo
 * cadastrado ainda). */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const existentes = await prisma.motivoPerda.findMany({ where: { workspaceId }, orderBy: { criadoEm: "asc" } });
  if (existentes.length > 0) {
    return NextResponse.json(existentes.map((m) => m.nome));
  }

  await prisma.motivoPerda.createMany({
    data: MOTIVOS_PADRAO.map((nome) => ({ id: `${workspaceId}-${slugId(nome)}`, workspaceId, nome })),
    skipDuplicates: true,
  });
  return NextResponse.json(MOTIVOS_PADRAO);
}

/** POST adiciona um motivo novo à lista do workspace (ignora se já existir, mesmo nome). */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { nome } = (await request.json()) as { nome?: string };
  const nomeLimpo = nome?.trim();
  if (!nomeLimpo) return NextResponse.json({ erro: "Campo obrigatório: nome" }, { status: 400 });

  await prisma.motivoPerda.upsert({
    where: { workspaceId_nome: { workspaceId, nome: nomeLimpo } },
    create: { id: `${workspaceId}-${slugId(nomeLimpo)}`, workspaceId, nome: nomeLimpo },
    update: {},
  });
  return NextResponse.json({ ok: true });
}
