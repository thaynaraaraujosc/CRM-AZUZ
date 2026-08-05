import { NextResponse } from "next/server";

import type { Formulario } from "@/lib/formularios-context";
import { prisma } from "@/lib/prisma";

function paraFormulario(linha: {
  paginas: unknown;
  paginaFinal: unknown;
  tema: unknown;
  integracoes: unknown;
  versoes: unknown;
  [k: string]: unknown;
}): Formulario {
  return {
    ...linha,
    paginas: linha.paginas as Formulario["paginas"],
    paginaFinal: linha.paginaFinal as Formulario["paginaFinal"],
    tema: linha.tema as Formulario["tema"],
    integracoes: (linha.integracoes as Formulario["integracoes"]) ?? undefined,
    versoes: linha.versoes as Formulario["versoes"],
  } as Formulario;
}

/** Atualização por id — usada pelo helper `tocar()` do Context, que centraliza todo mutador que
 * edita um formulário existente (páginas, perguntas, publicação, versões...). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/formularios/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<Formulario>;
  // id/criadoEm/atualizadoEm são geridos pelo banco (PK e @updatedAt) — nunca vêm do front.
  const dados: Partial<Formulario> = { ...body };
  delete dados.id;
  delete dados.criadoEm;
  delete dados.atualizadoEm;

  const linha = await prisma.formulario.update({
    where: { id },
    data: {
      ...dados,
      integracoes: dados.integracoes ?? undefined,
    },
  });
  return NextResponse.json(paraFormulario(linha));
}

/** DELETE também apaga as respostas desse formulário — mesma regra que `excluirFormulario` já tinha
 * (RespostaFormulario não tem FK real pro Formulario no schema, então o cascade é manual). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/formularios/[id]">) {
  const { id } = await ctx.params;
  await prisma.$transaction([
    prisma.respostaFormulario.deleteMany({ where: { formularioId: id } }),
    prisma.formulario.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
