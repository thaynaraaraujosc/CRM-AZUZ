import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITES } from "@/lib/templates/regras";
import { prepararTemplate, type CorpoTemplate } from "@/lib/templates/preparar";
import { sincronizarTemplatesMeta } from "@/lib/templates/sincronizar-meta";

/**
 * Templates do CRM — mensagens reutilizáveis, por workspace.
 *
 * GET sincroniza com a Meta antes de listar (modelo criado no WhatsApp Manager aparece aqui sem
 * a pessoa fazer nada) e devolve tudo do workspace de quem está logado. Nunca de outro.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  await sincronizarTemplatesMeta(workspaceId);

  const templates = await prisma.template.findMany({
    where: { workspaceId },
    orderBy: [{ atualizadoEm: "desc" }],
  });
  return NextResponse.json(templates, { headers: { "cache-control": "private, no-store" } });
}

/** POST cria um template. Canal sem análise nasce "aprovado" (pronto pra usar); oficial nasce
 * rascunho e só vai pra Meta quando a pessoa mandar pra análise. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { editavel, problemas } = prepararTemplate((await request.json()) as CorpoTemplate);
  if (problemas.length) return NextResponse.json({ erro: problemas[0], problemas }, { status: 400 });

  const template = await prisma.template.create({
    data: {
      id: `tpl-${workspaceId}-${Date.now()}`,
      workspaceId,
      nome: editavel.nome,
      canal: editavel.canal,
      categoria: editavel.categoria,
      idioma: editavel.idioma,
      assunto: editavel.assunto,
      corpo: editavel.corpo,
      variaveis: editavel.variaveis as never,
      botoes: editavel.botoes as never,
      status: LIMITES[editavel.canal].temAnalise ? "rascunho" : "aprovado",
    },
  });
  return NextResponse.json(template, { status: 201 });
}
