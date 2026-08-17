import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET devolve o status da integração da Meta (`?provedor=`, default `meta_whatsapp`) do workspace
 * de quem está logado — nunca o token, só o que a UI precisa mostrar (status, dados, erro). */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const provedor = new URL(request.url).searchParams.get("provedor") ?? "meta_whatsapp";

  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor } },
    select: { status: true, metadados: true, erroMensagem: true, atualizadoEm: true },
  });

  return NextResponse.json(
    linha ?? { status: "desconectado", metadados: null, erroMensagem: null, atualizadoEm: null },
  );
}

/** PATCH atualiza só um pedaço de `metadados` de uma integração já conectada — faz merge com o que
 * já existe em vez de sobrescrever (ao contrário do callback OAuth, que substitui `metadados`
 * inteiro a cada reconexão). Usado hoje pelo toggle "Receber mensagens do Instagram no CRM", que
 * precisa sobreviver a uma reconexão sem voltar ao padrão sozinho. */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { provedor, metadados } = (await request.json()) as { provedor?: string; metadados?: Record<string, unknown> };
  if (!provedor || !metadados) {
    return NextResponse.json({ erro: "provedor e metadados são obrigatórios" }, { status: 400 });
  }

  const existente = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor } },
    select: { metadados: true },
  });
  if (!existente) return NextResponse.json({ erro: "Integração não conectada" }, { status: 404 });

  const metadadosAtuais = (existente.metadados as Record<string, unknown> | null) ?? {};
  const atualizada = await prisma.integracao.update({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor } },
    data: { metadados: { ...metadadosAtuais, ...metadados } as Prisma.InputJsonValue },
    select: { status: true, metadados: true, erroMensagem: true, atualizadoEm: true },
  });

  return NextResponse.json(atualizada);
}

