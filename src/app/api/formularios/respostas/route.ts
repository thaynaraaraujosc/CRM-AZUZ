import { NextResponse } from "next/server";

import type { RespostaFormulario } from "@/lib/formularios-context";
import { prisma } from "@/lib/prisma";

/** GET lista todas as respostas de todos os formulários (o Provider filtra por formularioId). */
export async function GET() {
  const linhas = await prisma.respostaFormulario.findMany({ orderBy: { criadoEm: "asc" } });
  const respostas: RespostaFormulario[] = linhas.map((l) => ({
    id: l.id,
    formularioId: l.formularioId,
    criadoEm: l.criadoEm.toISOString(),
    valores: l.valores as Record<string, string>,
  }));
  return NextResponse.json(respostas);
}
