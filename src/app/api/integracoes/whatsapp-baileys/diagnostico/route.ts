import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Rota de diagnóstico TEMPORÁRIA — só pra investigar por que o histórico do WhatsApp (QR Code)
 * não estava chegando depois da troca pro Evolution API. Autenticada (`auth()`), só devolve dado
 * do próprio workspace de quem chama. Remover depois que o problema for resolvido.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_baileys" } },
  });

  const totalMensagensBaileys = await prisma.mensagemExtra.count({
    where: { workspaceId, canal: "whatsapp_baileys" },
  });

  const mensagensRecentes = await prisma.mensagemExtra.findMany({
    where: { workspaceId, canal: "whatsapp_baileys" },
    orderBy: { criadoEm: "desc" },
    take: 5,
    select: { id: true, contato: true, tipo: true, texto: true, criadoEm: true },
  });

  const conversasWhatsapp = await prisma.conversa.findMany({
    where: { workspaceId, canal: "WhatsApp" },
    select: { id: true, nome: true, contato: true, naoLidas: true, atualizadoEm: true },
  });

  return NextResponse.json({
    workspaceId,
    integracao,
    totalMensagensBaileys,
    mensagensRecentes,
    conversasWhatsapp,
    envVarsConfiguradas: {
      EVOLUTION_API_URL: Boolean(process.env.EVOLUTION_API_URL),
      EVOLUTION_API_KEY: Boolean(process.env.EVOLUTION_API_KEY),
      APP_URL: process.env.APP_URL ?? null,
      WORKER_SECRET: Boolean(process.env.WORKER_SECRET),
    },
  });
}
