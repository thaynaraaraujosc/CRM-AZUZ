import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizarNumeroBrasileiro } from "@/lib/integracoes/meta";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";

/**
 * POST recebe os eventos que a Evolution API manda quando chega mensagem nova numa instância
 * conectada (webhook configurado na criação da instância, ver `src/lib/integracoes/baileys.ts`) —
 * sem `auth()` de propósito (quem chama é a Evolution API, não um usuário logado). Validação é por
 * segredo fixo no header (`x-worker-secret`, cadastrado como `headers` do webhook na Evolution
 * API), comparação direta — mesmo espírito do `ASAAS_WEBHOOK_TOKEN`/`META_WEBHOOK_VERIFY_TOKEN`.
 *
 * `instance` no payload é o nome da instância, que é sempre o `workspaceId` (ver
 * `iniciarSessaoBaileys`) — não precisa resolver de outra forma.
 */
type PayloadEvolution = {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    message?: { conversation?: string; extendedTextMessage?: { text?: string } };
    messageTimestamp?: number;
  };
};

export async function POST(request: Request) {
  const segredo = request.headers.get("x-worker-secret");
  if (!segredo || segredo !== process.env.WORKER_SECRET) {
    return NextResponse.json({ erro: "Segredo inválido" }, { status: 401 });
  }

  const payload = (await request.json()) as PayloadEvolution;
  const workspaceId = payload.instance;
  const dados = payload.data;

  // Só interessa mensagem de texto recebida de verdade — ignora eco de mensagem que o próprio CRM
  // mandou (`fromMe`), outros eventos (conexão, presença etc.) e grupos (`@g.us`, fora de escopo).
  if (
    payload.event?.toLowerCase() !== "messages.upsert" ||
    !workspaceId ||
    !dados?.key?.remoteJid ||
    dados.key.fromMe ||
    dados.key.remoteJid.endsWith("@g.us")
  ) {
    return NextResponse.json({ ok: true });
  }

  const texto = dados.message?.conversation ?? dados.message?.extendedTextMessage?.text;
  if (!texto || !dados.key.id) return NextResponse.json({ ok: true });

  const numeroBruto = dados.key.remoteJid.split("@")[0].replace(/\D/g, "");
  const contato = normalizarNumeroBrasileiro(numeroBruto);

  const idMensagem = `baileys-${dados.key.id}`;
  const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: idMensagem } });
  if (jaExiste) return NextResponse.json({ ok: true });

  // Mesmo casamento por telefone já usado no webhook da Meta (`webhooks/whatsapp/route.ts`) —
  // número novo sem contato cadastrado ainda cai no fallback do próprio número como "chave".
  const contatoExistente = await prisma.contato.findFirst({
    where: { workspaceId, whatsapp: { contains: contato } },
  });
  const chaveContato = contatoExistente?.nome ?? dados.pushName ?? contato;

  const criadoEm = dados.messageTimestamp ? new Date(dados.messageTimestamp * 1000) : new Date();

  await prisma.mensagemExtra.create({
    data: {
      id: idMensagem,
      workspaceId,
      contato: chaveContato,
      tipo: "in",
      texto,
      // `timeZone` explícito — sem isso, roda no fuso do servidor (UTC na Vercel), 3h adiantado
      // do horário de Brasília.
      hora: criadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      criadoEm,
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
