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

/** GET lista todos os formulários. */
export async function GET() {
  const linhas = await prisma.formulario.findMany({ orderBy: { criadoEm: "asc" } });
  return NextResponse.json(linhas.map(paraFormulario));
}

/** POST cria um formulário novo (ou uma cópia) — mesma semântica de `criarFormulario`/`duplicarFormulario`. */
export async function POST(request: Request) {
  const dados = (await request.json()) as Formulario;

  const linha = await prisma.formulario.create({
    data: {
      id: dados.id,
      nome: dados.nome,
      descricao: dados.descricao,
      status: dados.status,
      paginas: dados.paginas,
      paginaFinal: dados.paginaFinal,
      tema: dados.tema,
      senha: dados.senha,
      integracoes: dados.integracoes ?? undefined,
      versoes: dados.versoes,
    },
  });

  return NextResponse.json(paraFormulario(linha), { status: 201 });
}
