import { NextResponse } from "next/server";

import type { RespostaFormulario } from "@/lib/formularios-context";
import { prisma } from "@/lib/prisma";

/**
 * POST registra uma resposta pra esse formulário — usado por `registrarResposta` no Context e
 * pela página pública `/formulario-preview` (sem sessão, sem Provider, chama a API direto). Sem
 * `auth()` de propósito: quem responde é um lead externo. O `workspaceId` da resposta nunca vem do
 * corpo da requisição — é copiado do Formulario pai, resolvido aqui pelo `formularioId` da URL.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/respostas">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  const { valores } = (await request.json()) as { valores: Record<string, string> };

  const linha = await prisma.respostaFormulario.create({
    data: {
      id: `resposta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: formulario.workspaceId,
      formularioId: id,
      valores,
    },
  });

  const resposta: RespostaFormulario = {
    id: linha.id,
    formularioId: linha.formularioId,
    criadoEm: linha.criadoEm.toISOString(),
    valores: linha.valores as Record<string, string>,
  };
  return NextResponse.json(resposta, { status: 201 });
}
