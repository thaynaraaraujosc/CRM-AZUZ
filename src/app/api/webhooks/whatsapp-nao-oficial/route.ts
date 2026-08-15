import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarSegredoDoServico } from "@/lib/integracoes/whatsapp-nao-oficial";

type PayloadStatus = {
  tipo: "status";
  workspaceId: string;
  status: "aguardando_qr" | "conectado" | "desconectado";
  qrDataUrl?: string;
  numero?: string | null;
  erro?: string;
};

type PayloadMensagem = {
  tipo: "mensagem";
  workspaceId: string;
  id: string;
  waId: string;
  texto: string;
  timestamp: number;
  nomePerfil?: string | null;
};

/**
 * Recebe avisos do whatsapp-service (processo Baileys separado, ver whatsapp-service/README.md) —
 * autenticado por segredo compartilhado fixo (`x-servico-segredo`), não HMAC como o webhook da
 * Meta, porque quem chama aqui é um serviço nosso, não uma plataforma externa.
 */
export async function POST(request: Request) {
  if (!validarSegredoDoServico(request.headers.get("x-servico-segredo"))) {
    return NextResponse.json({ erro: "Segredo inválido" }, { status: 401 });
  }

  const payload = (await request.json()) as PayloadStatus | PayloadMensagem;

  if (payload.tipo === "status") {
    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId: payload.workspaceId, provedor: "whatsapp_nao_oficial" } },
      create: {
        id: `${payload.workspaceId}-whatsapp_nao_oficial`,
        workspaceId: payload.workspaceId,
        provedor: "whatsapp_nao_oficial",
        status: payload.status,
        metadados: { qrDataUrl: payload.qrDataUrl ?? null, numero: payload.numero ?? null },
        erroMensagem: payload.erro ?? null,
      },
      update: {
        status: payload.status,
        metadados: { qrDataUrl: payload.qrDataUrl ?? null, numero: payload.numero ?? null },
        erroMensagem: payload.erro ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (payload.tipo === "mensagem") {
    const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: payload.id } });
    if (jaExiste) return NextResponse.json({ ok: true });

    // Tenta casar com um contato já existente pelo telefone, pra mensagem aparecer numa conversa
    // que já existe — mesmo comportamento do webhook oficial (Meta): número novo fica salvo, mas
    // sem conversa correspondente na tela ainda (frente de front-end separada, pra depois).
    const contatoExistente = await prisma.contato.findFirst({
      where: { workspaceId: payload.workspaceId, whatsapp: { contains: payload.waId } },
    });
    const chaveContato = contatoExistente?.nome ?? payload.nomePerfil ?? payload.waId;

    await prisma.mensagemExtra.create({
      data: {
        id: payload.id,
        workspaceId: payload.workspaceId,
        contato: chaveContato,
        tipo: "in",
        texto: payload.texto,
        hora: new Date(payload.timestamp * 1000).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        criadoEm: new Date(payload.timestamp * 1000),
        canal: "whatsapp_nao_oficial",
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "Tipo de payload desconhecido" }, { status: 400 });
}
