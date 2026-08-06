import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type BaileysEventMap,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";

const SESSOES_DIR = process.env.SESSOES_DIR ?? "./sessoes";
const NEXTJS_BASE_URL = process.env.NEXTJS_BASE_URL;
const WORKER_SECRET = process.env.WORKER_SECRET;

type StatusSessao = "aguardando_qr" | "conectado" | "desconectado";

type Sessao = {
  status: StatusSessao;
  qrDataUrl: string | null;
  numero: string | null;
  sock: WASocket | null;
};

/**
 * Uma sessão Baileys por workspace, mantida em memória enquanto o processo do worker está de pé —
 * é o que substitui, aqui, o "access token" que a integração via Meta guarda no banco: em vez de um
 * token, é um socket TCP vivo. `useMultiFileAuthState` persiste as credenciais em disco (pasta por
 * workspace) pra sobreviver a um restart do processo sem precisar escanear o QR de novo.
 */
const sessoes = new Map<string, Sessao>();

const logger = pino({ level: "warn" });

function pastaDaSessao(workspaceId: string): string {
  return path.join(SESSOES_DIR, workspaceId);
}

function garantirEntrada(workspaceId: string): Sessao {
  let sessao = sessoes.get(workspaceId);
  if (!sessao) {
    sessao = { status: "desconectado", qrDataUrl: null, numero: null, sock: null };
    sessoes.set(workspaceId, sessao);
  }
  return sessao;
}

export function statusDaSessao(workspaceId: string) {
  const sessao = sessoes.get(workspaceId);
  if (!sessao) return { status: "desconectado" as const, qrDataUrl: null, numero: null };
  return { status: sessao.status, qrDataUrl: sessao.qrDataUrl, numero: sessao.numero };
}

async function avisarMensagemRecebida(workspaceId: string, contato: string, texto: string) {
  if (!NEXTJS_BASE_URL || !WORKER_SECRET) {
    console.error(`[${workspaceId}] NEXTJS_BASE_URL/WORKER_SECRET não configurados — não dá pra avisar o CRM.`);
    return;
  }
  try {
    const resposta = await fetch(`${NEXTJS_BASE_URL}/api/webhooks/whatsapp-baileys`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-secret": WORKER_SECRET },
      body: JSON.stringify({
        workspaceId,
        contato,
        texto,
        hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      }),
    });
    const corpo = await resposta.text();
    if (!resposta.ok) {
      console.error(`[${workspaceId}] CRM recusou o aviso de mensagem: ${resposta.status} ${corpo}`);
    } else {
      console.log(`[${workspaceId}] avisou o CRM sobre mensagem de ${contato}: ${resposta.status}`);
    }
  } catch (erro) {
    console.error(`[${workspaceId}] Falha ao avisar o CRM sobre mensagem recebida`, erro);
  }
}

/** Cria (se não existir) e conecta a sessão do workspace — idempotente: chamar de novo com uma
 * sessão já conectada ou já aguardando QR não faz nada. */
export async function iniciarSessao(workspaceId: string) {
  const existente = sessoes.get(workspaceId);
  if (existente?.status === "conectado" || existente?.status === "aguardando_qr") return;

  const pasta = pastaDaSessao(workspaceId);
  if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true });

  const sessao = garantirEntrada(workspaceId);
  const { state, saveCreds } = await useMultiFileAuthState(pasta);

  const sock = makeWASocket({
    auth: state,
    logger,
    // Logo após escanear o QR, o WhatsApp derruba a conexão uma vez (reconexão normal, código 515)
    // e em seguida o Baileys tenta sincronizar o histórico completo de conversas — isso costuma
    // travar/dar timeout em serviços hospedados (o worker não precisa de histórico antigo, só das
    // mensagens novas daqui pra frente), então desliga essa sincronização de propósito.
    syncFullHistory: false,
    markOnlineOnConnect: false,
    // O padrão (60s) vem estourando com frequência daqui do Railway pra buscar
    // props/blocklist/privacidade logo após conectar — não é fatal (a sessão segue funcionando),
    // mas dá mais margem pra rede mais lenta/instável não gerar ruído nos logs à toa.
    defaultQueryTimeoutMs: 120_000,
  });
  sessao.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: BaileysEventMap["connection.update"]) => {
    const { connection, lastDisconnect, qr } = update;
    if (connection) {
      console.log(`[${workspaceId}] connection.update: ${connection}`);
    }

    if (qr) {
      sessao.status = "aguardando_qr";
      sessao.qrDataUrl = await QRCode.toDataURL(qr);
    }

    if (connection === "open") {
      sessao.status = "conectado";
      sessao.qrDataUrl = null;
      sessao.numero = sock.user?.id?.split(":")[0] ?? null;
      console.log(`[${workspaceId}] conectado como ${sessao.numero}`);
    }

    if (connection === "close") {
      const motivo = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const deslogado = motivo === DisconnectReason.loggedOut;
      console.log(`[${workspaceId}] conexão fechada, motivo: ${motivo}, deslogado: ${deslogado}`);
      sessao.status = "desconectado";
      sessao.qrDataUrl = null;
      sessao.sock = null;
      if (deslogado) {
        // Sessão invalidada pelo WhatsApp (401) — as credenciais salvas em disco não servem mais
        // pra nada, e mantê-las faz a próxima tentativa de conectar reusá-las e cair no mesmo 401
        // na hora, sem nunca gerar QR novo. Apaga pra próxima tentativa começar do zero de verdade.
        rmSync(pastaDaSessao(workspaceId), { recursive: true, force: true });
      } else {
        // Qualquer outro motivo (queda de rede, restart do processo, timeout etc.) tenta reconectar
        // sozinho, reaproveitando o auth state já salvo, sem precisar de novo QR.
        void iniciarSessao(workspaceId);
      }
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }: BaileysEventMap["messages.upsert"]) => {
    console.log(`[${workspaceId}] messages.upsert: type=${type}, ${messages.length} mensagem(ns)`);
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const texto =
        msg.message.conversation ?? msg.message.extendedTextMessage?.text ?? "";
      if (!texto) continue;
      const numeroRemetente = msg.key.remoteJid?.split("@")[0];
      if (!numeroRemetente) continue;
      void avisarMensagemRecebida(workspaceId, numeroRemetente, texto);
    }
  });
}

export async function enviarMensagem(workspaceId: string, destinatario: string, texto: string) {
  const sessao = sessoes.get(workspaceId);
  if (!sessao?.sock || sessao.status !== "conectado") {
    throw new Error("Sessão não está conectada.");
  }
  const numeroLimpo = destinatario.replace(/\D/g, "");
  await sessao.sock.sendMessage(`${numeroLimpo}@s.whatsapp.net`, { text: texto });
}

export async function desconectarSessao(workspaceId: string) {
  const sessao = sessoes.get(workspaceId);
  if (sessao?.sock) {
    await sessao.sock.logout().catch(() => {});
  }
  sessoes.delete(workspaceId);
  // Desconexão pedida manualmente também deve deixar tudo limpo pra próxima conexão pedir QR novo.
  rmSync(pastaDaSessao(workspaceId), { recursive: true, force: true });
}
