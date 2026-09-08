import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chamarGraph } from "@/lib/integracoes/meta";
import { contaConectada, tratarErroEnvio } from "@/lib/integracoes/whatsapp-oficial";
import { LIMITES } from "@/lib/templates/regras";
import { prepararTemplate, type CorpoTemplate } from "@/lib/templates/preparar";

/** Sempre pelo workspace da sessão E pelo id. Id é adivinhável. */
async function templateDoWorkspace(id: string, workspaceId: string) {
  return prisma.template.findFirst({ where: { id, workspaceId } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const template = await templateDoWorkspace(id, sessao.user.workspaceId);
  if (!template) return NextResponse.json({ erro: "Template não encontrado." }, { status: 404 });
  return NextResponse.json(template);
}

/**
 * PATCH edita. Template que já está na Meta (em análise ou aprovado) não é editável aqui: a Meta
 * trata edição como um modelo novo pra análise, e reescrever o corpo local sem passar por ela
 * faria a tela mostrar um texto e a pessoa receber outro. O caminho é "Duplicar".
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const atual = await templateDoWorkspace(id, sessao.user.workspaceId);
  if (!atual) return NextResponse.json({ erro: "Template não encontrado." }, { status: 404 });
  if (atual.whatsappTemplateId && atual.status !== "rejeitado") {
    return NextResponse.json(
      { erro: "Este template já está na Meta. Pra mudar o texto, duplique e envie a cópia pra análise." },
      { status: 409 },
    );
  }

  const recebido = (await request.json()) as CorpoTemplate;
  const { editavel, problemas } = prepararTemplate({ ...recebido, canal: recebido.canal ?? (atual.canal as CorpoTemplate["canal"]) });
  if (problemas.length) return NextResponse.json({ erro: problemas[0], problemas }, { status: 400 });

  const template = await prisma.template.update({
    where: { id },
    data: {
      nome: editavel.nome,
      canal: editavel.canal,
      categoria: editavel.categoria,
      idioma: editavel.idioma,
      assunto: editavel.assunto,
      corpo: editavel.corpo,
      variaveis: editavel.variaveis as never,
      botoes: editavel.botoes as never,
      // Rejeitado que foi editado volta a rascunho. O vínculo com a Meta se desfaz, porque a
      // versão de lá é outra.
      ...(atual.status === "rejeitado" ? { status: "rascunho", whatsappTemplateId: null, motivoRejeicao: null } : {}),
      ...(!LIMITES[editavel.canal].temAnalise ? { status: "aprovado" } : {}),
    },
  });
  return NextResponse.json(template);
}

/** DELETE apaga aqui e, se estiver na Meta, lá também (a Graph apaga por nome). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;
  const { id } = await params;
  const atual = await templateDoWorkspace(id, workspaceId);
  if (!atual) return NextResponse.json({ erro: "Template não encontrado." }, { status: 404 });

  if (atual.whatsappTemplateId) {
    const espelho = await prisma.whatsappTemplate.findFirst({ where: { id: atual.whatsappTemplateId, workspaceId } });
    const conta = await contaConectada(workspaceId);
    if (espelho && conta?.wabaId) {
      try {
        await chamarGraph(`/${conta.wabaId}/message_templates?name=${encodeURIComponent(espelho.nome)}`, conta.accessToken, {
          method: "DELETE",
        });
      } catch (erro) {
        return NextResponse.json({ erro: await tratarErroEnvio(erro, conta.integracaoId) }, { status: 502 });
      }
    }
    if (espelho) await prisma.whatsappTemplate.deleteMany({ where: { id: espelho.id, workspaceId } });
  }
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
