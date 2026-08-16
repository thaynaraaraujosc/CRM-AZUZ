import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente da Evolution API (servidor próprio, fora da Vercel, que fala com o WhatsApp via Baileys
 * por trás de uma API REST) — substitui o whatsapp-service customizado deste repo como forma de
 * conectar o WhatsApp "não oficial" (QR Code). Uma instância da Evolution = um número de WhatsApp;
 * este CRM cria uma instância por workspace, nomeada `crm-<workspaceId>`, então um servidor
 * Evolution só atende vários workspaces ao mesmo tempo sem misturar conexões.
 */

function baseUrl(): string {
  const valor = process.env.EVOLUTION_API_URL;
  if (!valor) throw new Error("EVOLUTION_API_URL não configurado.");
  return valor.replace(/\/+$/, "");
}

function apiKey(): string {
  const valor = process.env.EVOLUTION_API_KEY;
  if (!valor) throw new Error("EVOLUTION_API_KEY não configurado.");
  return valor;
}

export function nomeInstancia(workspaceId: string): string {
  return `crm-${workspaceId}`;
}

/** Extrai o workspaceId de volta do nome da instância que a Evolution manda nos eventos de
 * webhook — `null` se não bater com o padrão que este CRM usa (evento de instância de outro uso
 * do mesmo servidor, por exemplo). */
export function workspaceIdDaInstancia(instancia: string): string | null {
  return instancia.startsWith("crm-") ? instancia.slice(4) : null;
}

async function chamarEvolution(caminho: string, method: "GET" | "POST" | "DELETE", corpo?: Record<string, unknown>) {
  const resposta = await fetch(`${baseUrl()}${caminho}`, {
    method,
    headers: { "content-type": "application/json", apikey: apiKey() },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const mensagem = (dados && (dados.message ?? dados.error ?? dados.response?.message)) || resposta.statusText;
    throw new Error(`Evolution API respondeu ${resposta.status} em ${caminho}: ${JSON.stringify(mensagem)}`);
  }
  return dados;
}

function webhookUrl(): string {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (!appUrl) throw new Error("APP_URL não configurado.");
  return `${appUrl}/api/webhooks/evolution?token=${assinarWebhook()}`;
}

/** Token fixo que autentica as chamadas da Evolution pro nosso webhook — deriva da própria
 * EVOLUTION_API_KEY (HMAC), sem precisar de mais uma variável de ambiente só pra isso. Não
 * autoriza um workspace específico (isso vem do nome da instância no payload, conferido contra o
 * banco); só garante que a chamada veio de quem conhece a chave da nossa Evolution. */
function assinarWebhook(): string {
  return createHmac("sha256", apiKey()).update("evolution-webhook").digest("hex");
}

export function validarTokenWebhook(tokenRecebido: string | null): boolean {
  if (!tokenRecebido) return false;
  const bufRecebido = Buffer.from(tokenRecebido);
  const bufEsperado = Buffer.from(assinarWebhook());
  if (bufRecebido.length !== bufEsperado.length) return false;
  return timingSafeEqual(bufRecebido, bufEsperado);
}

type RespostaQrCode = { qrDataUrl: string | null };

/** Garante que a instância do workspace existe na Evolution (cria na primeira vez) e devolve o QR
 * Code atual pra escanear. Instância que já existe e já está conectada não tem QR novo — o status
 * `conectado` é o que importa nesse caso, não o QR. */
export async function conectarWhatsAppNaoOficial(workspaceId: string): Promise<RespostaQrCode> {
  const instancia = nomeInstancia(workspaceId);

  const estadoAtual = await chamarEvolution(`/instance/connectionState/${instancia}`, "GET").catch(() => null);

  if (!estadoAtual) {
    // Instância ainda não existe nesse servidor Evolution — cria já configurando o webhook de
    // eventos pra esse workspace específico.
    const criada = await chamarEvolution("/instance/create", "POST", {
      instanceName: instancia,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: webhookUrl(),
        byEvents: false,
        base64: true,
        events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"],
      },
    });
    const base64 = criada?.qrcode?.base64 ?? null;
    return { qrDataUrl: base64 };
  }

  if (estadoAtual?.instance?.state === "open") {
    return { qrDataUrl: null };
  }

  // Instância existe mas não está conectada — pede um QR novo (também reabre a conexão se tiver
  // caído).
  const conexao = await chamarEvolution(`/instance/connect/${instancia}`, "GET");
  const base64 = conexao?.base64 ?? conexao?.qrcode?.base64 ?? null;
  return { qrDataUrl: base64 };
}

/** Pede pra Evolution encerrar a sessão desse workspace (equivalente a "sair" no WhatsApp Web) —
 * a instância continua existindo, só desconectada; conectar de novo gera um QR novo. */
export function desconectarWhatsAppNaoOficial(workspaceId: string) {
  return chamarEvolution(`/instance/logout/${nomeInstancia(workspaceId)}`, "DELETE");
}

/** Manda uma mensagem de texto pelo número conectado desse workspace — usado quando o atendente
 * responde pela tela de Conversas num contato que chegou pelo WhatsApp não oficial. */
export function enviarMensagemWhatsAppNaoOficial(workspaceId: string, numero: string, texto: string) {
  return chamarEvolution(`/message/sendText/${nomeInstancia(workspaceId)}`, "POST", { number: numero, text: texto });
}

/** Busca o número (JID) do WhatsApp conectado numa instância — a Evolution não manda isso direto
 * no evento `connection.update`, só no cadastro da instância em si. Chamado pelo webhook assim que
 * o estado vira `open`, pra guardar o número junto do status `conectado`. */
export async function buscarNumeroConectado(workspaceId: string): Promise<string | null> {
  const instancia = nomeInstancia(workspaceId);
  const dados = await chamarEvolution(`/instance/fetchInstances?instanceName=${instancia}`, "GET").catch(() => null);
  const item = Array.isArray(dados) ? dados[0] : dados;
  const owner: string | undefined = item?.instance?.owner ?? item?.ownerJid ?? item?.owner;
  if (!owner) return null;
  return owner.split("@")[0] ?? null;
}
