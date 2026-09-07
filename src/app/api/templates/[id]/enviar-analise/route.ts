import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chamarGraph } from "@/lib/integracoes/meta";
import { contaConectada, tratarErroEnvio } from "@/lib/integracoes/whatsapp-oficial";
import { montarComponentesMeta, normalizarNomeMeta, validarTemplate, type TemplateEditavel } from "@/lib/templates/regras";

/**
 * Manda um rascunho de WhatsApp oficial pra análise da Meta e cria o espelho como PENDING.
 * A aprovação/rejeição chega pelo webhook e atualiza o espelho; a lista lê de lá.
 *
 * Não existe versão fictícia disto: sem WhatsApp Business conectado, a rota recusa.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;
  const { id } = await params;

  const template = await prisma.template.findFirst({ where: { id, workspaceId } });
  if (!template) return NextResponse.json({ erro: "Template não encontrado." }, { status: 404 });
  if (template.canal !== "whatsapp_oficial") {
    return NextResponse.json({ erro: "Só template do WhatsApp API Oficial passa por análise." }, { status: 400 });
  }
  if (template.status === "em_analise" || template.status === "aprovado") {
    return NextResponse.json({ erro: "Este template já foi enviado." }, { status: 409 });
  }

  const editavel = template as unknown as TemplateEditavel;
  const problemas = validarTemplate(editavel);
  if (problemas.length) return NextResponse.json({ erro: problemas[0], problemas }, { status: 400 });

  const conta = await contaConectada(workspaceId);
  if (!conta?.wabaId) {
    return NextResponse.json({ erro: "Conecte o WhatsApp Business (Meta) em Configurações antes de enviar pra análise." }, { status: 409 });
  }

  const nomeMeta = normalizarNomeMeta(template.nome);
  const componentes = montarComponentesMeta(editavel);
  try {
    const criado = await chamarGraph<{ id: string; status?: string }>(`/${conta.wabaId}/message_templates`, conta.accessToken, {
      method: "POST",
      body: { name: nomeMeta, language: template.idioma, category: template.categoria, components: componentes },
    });
    const espelho = await prisma.whatsappTemplate.upsert({
      where: { workspaceId_metaId: { workspaceId, metaId: criado.id } },
      create: {
        id: `template-${workspaceId}-${criado.id}`,
        workspaceId,
        metaId: criado.id,
        wabaId: conta.wabaId,
        nome: nomeMeta,
        idioma: template.idioma,
        categoria: template.categoria ?? "MARKETING",
        status: criado.status ?? "PENDING",
        componentes: componentes as never,
      },
      update: { status: criado.status ?? "PENDING", componentes: componentes as never },
    });
    const atualizado = await prisma.template.update({
      where: { id },
      data: { status: "em_analise", motivoRejeicao: null, whatsappTemplateId: espelho.id },
    });
    return NextResponse.json(atualizado);
  } catch (erro) {
    return NextResponse.json({ erro: await tratarErroEnvio(erro, conta.integracaoId) }, { status: 502 });
  }
}
