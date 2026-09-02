import { NextResponse } from "next/server";

import type { Formulario } from "@/lib/formularios-context";
import { auth } from "@/lib/auth";
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

/**
 * GET busca um formulário único — sem autenticação (rota pública, dentro do prefixo
 * `/api/formularios` já liberado no proxy). Usada por `/formulario-preview`, que precisa desse
 * único formulário (pra saber a que workspace ele pertence e resolver as rotas públicas
 * `contatos-sugeridos`/`equipe-sugerida`/`fluxos-automacao`/etc. a partir daí), nunca a lista
 * inteira de formulários de todas as empresas.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]">) {
  const { id } = await ctx.params;
  const linha = await prisma.formulario.findUnique({ where: { id } });
  if (!linha) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  // Rota PÚBLICA devolve só o que a tela pública precisa pra desenhar o formulário.
  //
  // Antes ela devolvia a linha inteira do banco — inclusive `integracoes`, que guarda a
  // configuração de para onde as respostas são enviadas, e `versoes`, com o histórico de edições.
  // Nada disso é necessário pra preencher um formulário, e tudo isso estava acessível a qualquer
  // pessoa com o id em mãos. Endpoint aberto devolve o mínimo, não o registro completo.
  const publico = paraFormulario(linha);
  return NextResponse.json({
    id: publico.id,
    nome: publico.nome,
    descricao: publico.descricao,
    status: publico.status,
    paginas: publico.paginas,
    paginaFinal: publico.paginaFinal,
    tema: publico.tema,
    // Necessário pra tela pública resolver as demais rotas públicas a partir daqui.
    workspaceId: linha.workspaceId,
  });
}

/** Atualização por id — usada pelo helper `tocar()` do Context, que centraliza todo mutador que
 * edita um formulário existente (páginas, perguntas, publicação, versões...). Só mexe em formulário
 * do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/formularios/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<Formulario>;
  // id/criadoEm/atualizadoEm são geridos pelo banco (PK e @updatedAt) — nunca vêm do front.
  const dados: Partial<Formulario> = { ...body };
  delete dados.id;
  delete dados.criadoEm;
  delete dados.atualizadoEm;

  const { count } = await prisma.formulario.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: {
      ...dados,
      integracoes: dados.integracoes ?? undefined,
    },
  });
  if (count === 0) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  const linha = await prisma.formulario.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(paraFormulario(linha));
}

/** DELETE também apaga as respostas desse formulário — mesma regra que `excluirFormulario` já tinha
 * (RespostaFormulario não tem FK real pro Formulario no schema, então o cascade é manual). Só mexe
 * em formulário do mesmo workspace de quem está logado. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/formularios/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  await prisma.$transaction([
    prisma.respostaFormulario.deleteMany({ where: { formularioId: id } }),
    prisma.formulario.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
