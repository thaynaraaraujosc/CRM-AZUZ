import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelarAssinatura } from "@/lib/integracoes/asaas";

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só administradores podem cancelar o plano." }, { status: 403 });
  }

  const workspaceId = sessao.user.workspaceId;
  const assinatura = await prisma.assinatura.findUnique({ where: { workspaceId } });
  if (!assinatura) return NextResponse.json({ erro: "Nenhuma assinatura ativa." }, { status: 404 });

  try {
    if (assinatura.asaasSubscriptionId) {
      await cancelarAssinatura(assinatura.asaasSubscriptionId);
    }
    const atualizada = await prisma.assinatura.update({
      where: { workspaceId },
      data: { status: "cancelada", canceladaEm: new Date() },
    });
    return NextResponse.json({ assinatura: atualizada });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha ao cancelar assinatura na Asaas.";
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
