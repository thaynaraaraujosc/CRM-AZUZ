import { NextResponse } from "next/server";

import type { RespostaFormulario } from "@/lib/formularios-context";
import { prisma } from "@/lib/prisma";

/** POST registra uma resposta pra esse formulário — usado por `registrarResposta` no Context e
 * pela página pública `/formulario-preview` (sem Provider, chama a API direto). */
export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/respostas">) {
  const { id } = await ctx.params;
  const { valores } = (await request.json()) as { valores: Record<string, string> };

  const linha = await prisma.respostaFormulario.create({
    data: { id: `resposta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, formularioId: id, valores },
  });

  const resposta: RespostaFormulario = {
    id: linha.id,
    formularioId: linha.formularioId,
    criadoEm: linha.criadoEm.toISOString(),
    valores: linha.valores as Record<string, string>,
  };
  return NextResponse.json(resposta, { status: 201 });
}
