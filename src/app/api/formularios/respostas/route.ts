import { NextResponse } from "next/server";

import type { RespostaFormulario } from "@/lib/formularios-context";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET lista as respostas de todos os formulários do workspace de quem está logado (o Provider
 * filtra por formularioId). */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.respostaFormulario.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "asc" },
  });
  const respostas: RespostaFormulario[] = linhas.map((l) => ({
    id: l.id,
    formularioId: l.formularioId,
    criadoEm: l.criadoEm.toISOString(),
    valores: l.valores as Record<string, string>,
  }));
  return NextResponse.json(respostas);
}
