import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizarNumeroBrasileiro } from "@/lib/integracoes/meta";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { criarContatoPeloWhatsAppSeNaoExistir, encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead } from "@/lib/funis/upsert";

/**
 * POST recebe os eventos que a Evolution API manda pra instância conectada (webhook configurado
 * na criação da instância, ver `src/lib/integracoes/baileys.ts`) — sem `auth()` de propósito
 * (quem chama é a Evolution API, não um usuário logado). Validação é por segredo fixo no header
 * (`x-worker-secret`, cadastrado como `headers` do webhook na Evolution API), comparação direta —
 * mesmo espírito do `ASAAS_WEBHOOK_TOKEN`/`META_WEBHOOK_VERIFY_TOKEN`.
 *
 * `instance` no payload é o nome da instância, que é sempre o `workspaceId` (ver
 * `iniciarSessaoBaileys`) — não precisa resolver de outra forma.
 *
 * Dois eventos tratados:
 * - `messages.upsert`: mensagem nova chegando ao vivo, uma por vez.
 * - `messages.set`: pacote do histórico completo (sync ao conectar, `syncFullHistory: true` na
 *   criação da instância) — `data` vem como ARRAY de mensagens, pode chegar em vários pacotes
 *   (não só um POST).
 */
type ItemMensagemEvolution = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
  messageTimestamp?: number;
};

type PayloadEvolution = {
  event?: string;
  instance?: string;
  data?: ItemMensagemEvolution | ItemMensagemEvolution[];
};

type MensagemExtraida = {
  id: string;
  contato: string;
  fromMe: boolean;
  texto: string;
  pushName?: string;
  criadoEm: Date;
};

/** Extrai o que interessa de um item de mensagem cru da Evolution API — usado tanto pro evento ao
 * vivo quanto pra cada item do histórico (mesmo formato nos dois). `null` = ignora (grupo, sem
 * texto, ou faltando o essencial). */
function extrairMensagem(item: ItemMensagemEvolution): MensagemExtraida | null {
  if (!item.key?.remoteJid || !item.key.id || item.key.remoteJid.endsWith("@g.us")) return null;
  const texto = item.message?.conversation ?? item.message?.extendedTextMessage?.text;
  if (!texto) return null;

  const numeroBruto = item.key.remoteJid.split("@")[0].replace(/\D/g, "");
  return {
    id: `baileys-${item.key.id}`,
    contato: normalizarNumeroBrasileiro(numeroBruto),
    fromMe: item.key.fromMe === true,
    texto,
    pushName: item.pushName,
    criadoEm: item.messageTimestamp ? new Date(item.messageTimestamp * 1000) : new Date(),
  };
}

function horaLocal(data: Date): string {
  // `timeZone` explícito — sem isso, roda no fuso do servidor (UTC na Vercel), 3h adiantado do
  // horário de Brasília.
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/** Acha (ou cria) o Contato pelo telefone — mesmo casamento normalizado usado no webhook da Meta
 * (`webhooks/whatsapp/route.ts`); número novo ganha um Contato de verdade automaticamente.
 * `novo: true` só quando esta chamada acabou de criar o Contato (não existia por telefone ainda) —
 * é o sinal usado pra decidir se entra no funil (lead novo) ou não (contato já existia). */
async function resolverContato(
  workspaceId: string,
  telefone: string,
  pushName?: string,
): Promise<{ contato: Awaited<ReturnType<typeof criarContatoPeloWhatsAppSeNaoExistir>>; novo: boolean }> {
  const existente = await encontrarContatoPorTelefone(workspaceId, telefone);
  if (existente) return { contato: existente, novo: false };
  const contato = await criarContatoPeloWhatsAppSeNaoExistir({
    workspaceId,
    nome: pushName ?? telefone,
    whatsapp: telefone,
  });
  return { contato, novo: true };
}

async function processarMensagemAoVivo(workspaceId: string, item: ItemMensagemEvolution) {
  const extraida = extrairMensagem(item);
  // `fromMe` ao vivo é eco da mensagem que o próprio CRM acabou de mandar — já foi gravada na
  // hora do envio, ignora aqui pra não duplicar.
  if (!extraida || extraida.fromMe) return;

  const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: extraida.id } });
  if (jaExiste) return;

  const { contato, novo } = await resolverContato(workspaceId, extraida.contato, extraida.pushName);

  // Regra de negócio: todo lead novo entra no funil pela primeira etapa. Contato que já existia
  // (mandou mensagem de novo) nunca é mexido de etapa aqui — só o vendedor move manualmente.
  if (novo) {
    await entrarNaPrimeiraEtapaComoNovoLead({ workspaceId, contatoNome: contato.nome, origem: "WhatsApp" });
  }

  await prisma.mensagemExtra.create({
    data: {
      id: extraida.id,
      workspaceId,
      contato: contato.nome,
      tipo: "in",
      texto: extraida.texto,
      hora: horaLocal(extraida.criadoEm),
      criadoEm: extraida.criadoEm,
      canal: "whatsapp_baileys",
    },
  });

  await upsertConversaAoReceberMensagem({
    workspaceId,
    nome: contato.nome,
    canal: "WhatsApp",
    contato: extraida.contato,
    contatoId: contato.id,
    origem: "Direto",
  });
}

/** Processa um pacote do histórico completo — chega em lote, então usa `createMany` (uma query
 * só) em vez de criar mensagem por mensagem; conversa é uma por contato único no lote, não por
 * mensagem, e nunca conta como "não lida" (é histórico, não chegou agora). */
async function processarPacoteHistorico(workspaceId: string, itens: ItemMensagemEvolution[]) {
  const extraidas = itens.map(extrairMensagem).filter((m): m is MensagemExtraida => m !== null);
  if (extraidas.length === 0) return;

  const idsExistentes = new Set(
    (
      await prisma.mensagemExtra.findMany({
        where: { id: { in: extraidas.map((m) => m.id) } },
        select: { id: true },
      })
    ).map((m) => m.id),
  );
  const novas = extraidas.filter((m) => !idsExistentes.has(m.id));
  if (novas.length === 0) return;

  const contatosUnicos = [...new Set(novas.map((m) => m.contato))];
  const contatosPorTelefone = new Map<string, Awaited<ReturnType<typeof resolverContato>>>();
  for (const telefone of contatosUnicos) {
    const pushName = novas.find((m) => m.contato === telefone)?.pushName;
    contatosPorTelefone.set(telefone, await resolverContato(workspaceId, telefone, pushName));
  }

  await prisma.mensagemExtra.createMany({
    data: novas.map((m) => ({
      id: m.id,
      workspaceId,
      contato: contatosPorTelefone.get(m.contato)!.contato.nome,
      tipo: m.fromMe ? "out" : "in",
      texto: m.texto,
      hora: horaLocal(m.criadoEm),
      criadoEm: m.criadoEm,
      canal: "whatsapp_baileys",
    })),
    skipDuplicates: true,
  });

  // Sync de histórico nunca entra no funil, mesmo pra contato recém-criado aqui — não é um lead
  // "chegando agora", é mensagem antiga sendo importada; entrar no funil é reservado pro evento ao
  // vivo (`processarMensagemAoVivo`), senão importar histórico empurraria gente de anos atrás pra
  // dentro do funil como se fosse novidade.
  for (const [telefone, { contato }] of contatosPorTelefone) {
    await upsertConversaAoReceberMensagem({
      workspaceId,
      nome: contato.nome,
      canal: "WhatsApp",
      contato: telefone,
      contatoId: contato.id,
      origem: "Direto",
      contarComoNaoLida: false,
    });
  }
}

export async function POST(request: Request) {
  const segredo = request.headers.get("x-worker-secret");
  if (!segredo || segredo !== process.env.WORKER_SECRET) {
    return NextResponse.json({ erro: "Segredo inválido" }, { status: 401 });
  }

  const payload = (await request.json()) as PayloadEvolution;
  const workspaceId = payload.instance;
  const evento = payload.event?.toLowerCase();

  if (!workspaceId || !payload.data) return NextResponse.json({ ok: true });

  if (evento === "messages.set") {
    const itens = Array.isArray(payload.data) ? payload.data : [payload.data];
    await processarPacoteHistorico(workspaceId, itens);
  } else if (evento === "messages.upsert" && !Array.isArray(payload.data)) {
    await processarMensagemAoVivo(workspaceId, payload.data);
  }

  return NextResponse.json({ ok: true });
}
