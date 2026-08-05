import { NextResponse } from "next/server";

import type { Contato } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function paraContato(linha: { etiquetas: unknown; [k: string]: unknown }): Contato {
  return {
    ...linha,
    etiquetas: Array.isArray(linha.etiquetas) ? (linha.etiquetas as string[]) : undefined,
  } as Contato;
}

/**
 * POST público (sem `auth()`) — equivalente de `POST /api/contatos`, mas pro fluxo de
 * `/formulario-preview`: cria/atualiza o contato do lead que respondeu, no workspace do
 * formulário (resolvido aqui, nunca enviado pelo cliente). Mesma semântica de upsert-por-nome.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/contatos">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });
  const workspaceId = formulario.workspaceId;

  const body = (await request.json()) as {
    nome: string;
    dados?: Partial<Contato> & Record<string, unknown>;
    origemPadrao?: Contato["origem"];
  };
  const { nome, dados = {}, origemPadrao = "Formulário" } = body;
  if (!nome) {
    return NextResponse.json({ erro: "Campo obrigatório: nome" }, { status: 400 });
  }

  const existente = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome } } });
  const linha = existente
    ? await prisma.contato.update({
        where: { workspaceId_nome: { workspaceId, nome } },
        data: { ...dados, etiquetas: dados.etiquetas ?? undefined },
      })
    : await prisma.contato.create({
        data: {
          id: `${workspaceId}-${slugId(nome)}`,
          workspaceId,
          initials: iniciais(nome),
          nome,
          origem: origemPadrao,
          etapa: "Novo",
          responsavel: "—",
          ultima: "Agora",
          valor: "—",
          ...dados,
          etiquetas: dados.etiquetas ?? undefined,
        },
      });

  return NextResponse.json(paraContato(linha), { status: existente ? 200 : 201 });
}
