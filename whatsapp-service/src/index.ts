import "dotenv/config";
import express from "express";
import { pino } from "pino";
import QRCode from "qrcode";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket,
  type WAMessage,
  DisconnectReason,
} from "@whiskeysockets/baileys";

/**
 * Serviço separado (processo sempre ligado) que espelha UM número de WhatsApp via Baileys —
 * conecta direto no protocolo multi-device, sem navegador. Não roda dentro do Next.js/Vercel
 * (serverless não sustenta o WebSocket vivo), por isso é um processo próprio hospedado à parte
 * (Railway, junto com o banco — ver README.md).
 *
 * Escopo desta primeira versão: um serviço = uma sessão = um WORKSPACE_ID (um número de WhatsApp
 * por empresa). Multi-sessão (várias empresas num serviço só) fica pra depois, se precisar.
 */

const PORTA = Number(process.env.PORT ?? 3333);
const WORKSPACE_ID = process.env.WORKSPACE_ID;
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
const SERVICO_SEGREDO = process.env.SERVICO_SEGREDO;
const PASTA_SESSAO = process.env.PASTA_SESSAO ?? "./sessao";

for (const [nome, valor] of Object.entries({ WORKSPACE_ID, CRM_WEBHOOK_URL, SERVICO_SEGREDO })) {
  if (!valor) {
    console.error(`Faltou configurar a variável de ambiente ${nome} — ver .env.example.`);
    process.exit(1);
  }
}

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

let socket: WASocket | null = null;
let ultimoQrDataUrl: string | null = null;
let statusAtual: "aguardando_qr" | "conectado" | "desconectado" = "desconectado";

/** Avisa o CRM (rota /api/webhooks/whatsapp-nao-oficial) sobre status ou mensagem recebida —
 * autenticado por segredo compartilhado (mesmo espírito do HMAC do webhook da Meta, só que mais
 * simples porque os dois lados são serviços nossos, não a Meta). */
async function avisarCrm(corpo: Record<string, unknown>) {
  try {
    const resposta = await fetch(CRM_WEBHOOK_URL!, {
      method: "POST",
      headers: { "content-type": "application/json", "x-servico-segredo": SERVICO_SEGREDO! },
      body: JSON.stringify({ workspaceId: WORKSPACE_ID, ...corpo }),
    });
    if (!resposta.ok) {
      log.warn({ status: resposta.status }, "CRM recusou o aviso do webhook");
    }
  } catch (erro) {
    log.error({ erro }, "Falha ao avisar o CRM");
  }
}

async function iniciarSessao() {
  const { state, saveCreds } = await useMultiFileAuthState(PASTA_SESSAO);
  const { version } = await fetchLatestBaileysVersion();

  const novoSocket = makeWASocket({
    version,
    auth: state,
    logger: log.child({ modulo: "baileys" }),
    printQRInTerminal: false,
  });
  socket = novoSocket;

  novoSocket.ev.on("creds.update", saveCreds);

  novoSocket.ev.on("connection.update", async (atualizacao) => {
    const { connection, lastDisconnect, qr } = atualizacao;

    if (qr) {
      ultimoQrDataUrl = await QRCode.toDataURL(qr);
      statusAtual = "aguardando_qr";
      log.info("Novo QR code gerado — aguardando leitura no app do WhatsApp");
      await avisarCrm({ tipo: "status", status: "aguardando_qr", qrDataUrl: ultimoQrDataUrl });
    }

    if (connection === "open") {
      statusAtual = "conectado";
      ultimoQrDataUrl = null;
      const numero = socket?.user?.id?.split(":")[0] ?? null;
      log.info({ numero }, "WhatsApp conectado");
      await avisarCrm({ tipo: "status", status: "conectado", numero });
    }

    if (connection === "close") {
      statusAtual = "desconectado";
      const codigo = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;
      const deveReconectar = codigo !== DisconnectReason.loggedOut;
      log.warn({ codigo, deveReconectar }, "Conexão do WhatsApp caiu");
      await avisarCrm({
        tipo: "status",
        status: "desconectado",
        erro: deveReconectar ? "Conexão caiu — reconectando." : "Sessão encerrada (logout).",
      });
      if (deveReconectar) {
        setTimeout(iniciarSessao, 3000);
      }
    }
  });

  novoSocket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const mensagem of messages) {
      await repassarMensagem(mensagem);
    }
  });
}

/** Repassa só mensagens de texto recebidas (não enviadas por nós mesmos) — mídia/áudio/figurinha
 * ficam de fora desta primeira versão, mesmo escopo inicial que a integração oficial (Meta) teve. */
async function repassarMensagem(mensagem: WAMessage) {
  if (mensagem.key.fromMe) return;
  const texto =
    mensagem.message?.conversation ?? mensagem.message?.extendedTextMessage?.text ?? null;
  if (!texto) return;

  const waId = mensagem.key.remoteJid?.split("@")[0];
  if (!waId) return;

  await avisarCrm({
    tipo: "mensagem",
    id: mensagem.key.id,
    waId,
    texto,
    timestamp: Number(mensagem.messageTimestamp ?? Math.floor(Date.now() / 1000)),
    nomePerfil: mensagem.pushName ?? null,
  });
}

const app = express();
app.use(express.json());

function autenticarChamadaDoCrm(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.header("x-crm-segredo") !== SERVICO_SEGREDO) {
    res.status(401).json({ erro: "Segredo inválido" });
    return;
  }
  next();
}

app.get("/status", autenticarChamadaDoCrm, (_req, res) => {
  res.json({ status: statusAtual, qrDataUrl: ultimoQrDataUrl });
});

/** POST /enviar — chamado pelo CRM quando o atendente manda mensagem pela tela de Conversas. */
app.post("/enviar", autenticarChamadaDoCrm, async (req, res) => {
  const { waId, texto } = req.body as { waId?: string; texto?: string };
  const socketAtivo = socket;
  if (!socketAtivo || statusAtual !== "conectado") {
    res.status(409).json({ erro: "WhatsApp não está conectado" });
    return;
  }
  if (!waId || !texto) {
    res.status(400).json({ erro: "waId e texto são obrigatórios" });
    return;
  }
  await socketAtivo.sendMessage(`${waId}@s.whatsapp.net`, { text: texto });
  res.json({ ok: true });
});

/** POST /desconectar — encerra a sessão e apaga as credenciais salvas, pra próxima conexão pedir
 * um QR code novo (mesmo efeito de "sair" no WhatsApp Web). */
app.post("/desconectar", autenticarChamadaDoCrm, async (_req, res) => {
  await socket?.logout().catch(() => {});
  socket = null;
  statusAtual = "desconectado";
  ultimoQrDataUrl = null;
  res.json({ ok: true });
  iniciarSessao();
});

app.get("/saude", (_req, res) => res.json({ ok: true, status: statusAtual }));

app.listen(PORTA, () => {
  log.info(`Serviço de WhatsApp (Baileys) ouvindo na porta ${PORTA}`);
  iniciarSessao();
});
