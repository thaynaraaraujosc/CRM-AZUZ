import { existsSync, mkdirSync } from "node:fs";
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
    logger.error("NEXTJS_BASE_URL/WORKER_SECRET não configurados — não dá pra avisar o CRM.");
    return;
  }
  try {
    await fetch(`${NEXTJS_BASE_URL}/api/webhooks/whatsapp-baileys`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-secret": WORKER_SECRET },
      body: JSON.stringify({
        workspaceId,
        contato,
        texto,
        hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      }),
    });
  } catch (erro) {
    logger.error({ erro }, "Falha ao avisar o CRM sobre mensagem recebida");
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

  const sock = makeWASocket({ auth: state, logger });
  sessao.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: BaileysEventMap["connection.update"]) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sessao.status = "aguardando_qr";
      sessao.qrDataUrl = await QRCode.toDataURL(qr);
    }

    if (connection === "open") {
      sessao.status = "conectado";
      sessao.qrDataUrl = null;
      sessao.numero = sock.user?.id?.split(":")[0] ?? null;
    }

    if (connection === "close") {
      const motivo = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const deslogado = motivo === DisconnectReason.loggedOut;
      sessao.status = "desconectado";
      sessao.qrDataUrl = null;
      sessao.sock = null;
      // Qualquer motivo que não seja "deslogado explicitamente" tenta reconectar sozinho (queda de
      // rede, restart do processo etc.) — reaproveita o auth state já salvo, sem novo QR.
      if (!deslogado) {
        void iniciarSessao(workspaceId);
      }
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }: BaileysEventMap["messages.upsert"]) => {
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
}
