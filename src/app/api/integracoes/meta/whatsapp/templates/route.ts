import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chamarGraph } from "@/lib/integracoes/meta";
import { contaConectada, tratarErroEnvio } from "@/lib/integracoes/whatsapp-oficial";
import { sincronizarTemplatesMeta } from "@/lib/templates/sincronizar-meta";

/**
 * Modelos de mensagem (templates) do WhatsApp Business. Cada WABA tem os próprios, não existe
 * template global. São o único jeito de falar com alguém fora da janela de 24h.
 *
 * O status inicial é sempre PENDING; a aprovação/rejeição chega pelo webhook
 * `message_template_status_update` e atualiza o registro local (sem polling).
 */
/** GET sincroniza a lista da Graph API com o espelho local e devolve o espelho. Assim a tela
 * funciona mesmo se a Graph estiver fora do ar no momento. A sincronização mora em
 * `src/lib/templates/sincronizar-meta.ts`, compartilhada com `/api/templates`. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  await sincronizarTemplatesMeta(workspaceId);

  const templates = await prisma.whatsappTemplate.findMany({
    where: { workspaceId },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(templates);
}

/** POST cria um modelo novo na Graph API e grava o espelho local como PENDING. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { nome, idioma, categoria, componentes } = (await request.json()) as {
    nome?: string;
    idioma?: string;
    categoria?: string;
    componentes?: unknown[];
  };
  if (!nome?.trim() || !idioma || !categoria || !componentes?.length) {
    return NextResponse.json({ erro: "nome, idioma, categoria e componentes são obrigatórios" }, { status: 400 });
  }

  const conta = await contaConectada(workspaceId);
  if (!conta?.wabaId) {
    return NextResponse.json({ erro: "WhatsApp Business (Meta) não conectado" }, { status: 404 });
  }

  try {
    const criado = await chamarGraph<{ id: string; status?: string }>(
      `/${conta.wabaId}/message_templates`,
      conta.accessToken,
      { method: "POST", body: { name: nome, language: idioma, category: categoria, components: componentes } },
    );
    const template = await prisma.whatsappTemplate.create({
      data: {
        id: `template-${workspaceId}-${criado.id}`,
        workspaceId,
        metaId: criado.id,
        wabaId: conta.wabaId,
        nome,
        idioma,
        categoria,
        status: criado.status ?? "PENDING",
        componentes: componentes as never,
      },
    });
    return NextResponse.json(template);
  } catch (erro) {
    return NextResponse.json({ erro: await tratarErroEnvio(erro, conta.integracaoId) }, { status: 502 });
  }
}

/** DELETE remove um modelo (por nome, é assim que a Graph API aceita) e apaga o espelho local. */
export async function DELETE(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const nome = new URL(request.url).searchParams.get("nome");
  if (!nome) return NextResponse.json({ erro: "nome é obrigatório" }, { status: 400 });

  const conta = await contaConectada(workspaceId);
  if (!conta?.wabaId) {
    return NextResponse.json({ erro: "WhatsApp Business (Meta) não conectado" }, { status: 404 });
  }

  try {
    await chamarGraph(`/${conta.wabaId}/message_templates?name=${encodeURIComponent(nome)}`, conta.accessToken, {
      method: "DELETE",
    });
    // Filtra por workspace também: nunca só pelo nome, senão apagaria o espelho de outra empresa
    // que por acaso usa o mesmo nome de modelo.
    await prisma.whatsappTemplate.deleteMany({ where: { workspaceId, nome } });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return NextResponse.json({ erro: await tratarErroEnvio(erro, conta.integracaoId) }, { status: 502 });
  }
}
