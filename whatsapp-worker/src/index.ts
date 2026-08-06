import "dotenv/config";
import express from "express";

import { desconectarSessao, enviarMensagem, iniciarSessao, statusDaSessao } from "./sessoes.js";

const app = express();
app.use(express.json());

const WORKER_SECRET = process.env.WORKER_SECRET;

/** Todas as rotas exigem o mesmo segredo fixo compartilhado com o Next.js — mesmo padrão do
 * `ASAAS_WEBHOOK_TOKEN`/`META_WEBHOOK_VERIFY_TOKEN` já usado no projeto principal. */
app.use((req, res, next) => {
  if (!WORKER_SECRET || req.header("x-worker-secret") !== WORKER_SECRET) {
    res.status(401).json({ erro: "Segredo inválido" });
    return;
  }
  next();
});

app.post("/sessoes/:workspaceId/iniciar", async (req, res) => {
  await iniciarSessao(req.params.workspaceId);
  res.json({ ok: true });
});

app.get("/sessoes/:workspaceId/status", (req, res) => {
  res.json(statusDaSessao(req.params.workspaceId));
});

app.post("/sessoes/:workspaceId/enviar", async (req, res) => {
  const { destinatario, texto } = req.body as { destinatario?: string; texto?: string };
  if (!destinatario || !texto) {
    res.status(400).json({ erro: "destinatario e texto são obrigatórios" });
    return;
  }
  try {
    await enviarMensagem(req.params.workspaceId, destinatario, texto);
    res.json({ ok: true });
  } catch (erro) {
    res.status(409).json({ erro: erro instanceof Error ? erro.message : "Falha ao enviar" });
  }
});

app.post("/sessoes/:workspaceId/desconectar", async (req, res) => {
  await desconectarSessao(req.params.workspaceId);
  res.json({ ok: true });
});

const porta = Number(process.env.PORT ?? 3333);
app.listen(porta, () => {
  console.log(`whatsapp-worker ouvindo na porta ${porta}`);
});
