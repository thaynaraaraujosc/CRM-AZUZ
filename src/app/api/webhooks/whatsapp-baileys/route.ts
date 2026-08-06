import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";

/**
 * POST recebe mensagens do `whatsapp-worker` quando chega algo novo numa sessão conectada — sem
 * `auth()` de propósito (quem chama é o worker, não um usuário logado). Validação é por segredo
 * fixo no header (`x-worker-secret`), comparação direta — mesmo espírito do
 * `ASAAS_WEBHOOK_TOKEN`/`META_WEBHOOK_VERIFY_TOKEN`, o worker não assina com HMAC.
 */
export async function POST(request: Request) {
  const segredo = request.headers.get("x-worker-secret");
  if (!segredo || segredo !== process.env.WORKER_SECRET) {
    return NextResponse.json({ erro: "Segredo inválido" }, { status: 401 });
  }

  const { workspaceId, contato, texto, hora } = (await request.json()) as {
    workspaceId?: string;
    contato?: string;
    texto?: string;
    hora?: string;
  };
  if (!workspaceId || !contato || !texto) {
    return NextResponse.json({ erro: "workspaceId, contato e texto são obrigatórios" }, { status: 400 });
  }

  // Mesmo casamento por telefone já usado no webhook da Meta (`webhooks/whatsapp/route.ts`) — número
  // novo sem contato cadastrado ainda cai no fallback do próprio número como "chave".
  const contatoExistente = await prisma.contato.findFirst({
    where: { workspaceId, whatsapp: { contains: contato } },
  });
  const chaveContato = contatoExistente?.nome ?? contato;

  await prisma.mensagemExtra.create({
    data: {
      id: `baileys-${workspaceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      contato: chaveContato,
      tipo: "in",
      texto,
      hora: hora ?? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      criadoEm: new Date(),
      canal: "whatsapp_baileys",
    },
  });

  await upsertConversaAoReceberMensagem({
    workspaceId,
    nome: chaveContato,
    canal: "WhatsApp",
    contato,
    origem: "Direto",
  });

  return NextResponse.json({ ok: true });
}
