/**
 * Cliente HTTP pra Evolution API (evoapicloud/evolution-api, hospedada no Railway) — mantém as
 * conexões WhatsApp "não oficiais" (via QR Code, protocolo Baileys) vivas num serviço à parte, já
 * que isso não roda em função serverless da Vercel. Substituiu o `whatsapp-worker` próprio: mesmo
 * protocolo por baixo, mas a hospedagem/manutenção da sessão passou a ser da Evolution API.
 *
 * Uma instância da Evolution API por workspace, nomeada com o próprio `workspaceId` — mesmo
 * desenho 1:1 que o worker antigo usava. O Next.js só reflete o estado dela na linha `Integracao`
 * (`provedor: "whatsapp_baileys"`) pra UI.
 */

export type StatusSessaoBaileys = {
  status: "aguardando_qr" | "conectado" | "desconectado";
  qrDataUrl: string | null;
  numero: string | null;
};

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL não configurada.");
  return url.replace(/\/$/, "");
}

function apiKey(): string {
  const valor = process.env.EVOLUTION_API_KEY;
  if (!valor) throw new Error("EVOLUTION_API_KEY não configurada.");
  return valor;
}

function segredoWebhook(): string {
  const valor = process.env.WORKER_SECRET;
  if (!valor) throw new Error("WORKER_SECRET não configurada.");
  return valor;
}

function urlWebhook(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL não configurada.");
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/whatsapp-baileys`;
}

async function chamarEvolution(caminho: string, init?: RequestInit) {
  const resposta = await fetch(`${baseUrl()}${caminho}`, {
    ...init,
    headers: { "content-type": "application/json", apikey: apiKey(), ...init?.headers },
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error((corpo as { message?: string })?.message ?? `Evolution API respondeu ${resposta.status}`);
  }
  return corpo;
}

/** `GET /instance/connect/{instanceName}` devolve formatos diferentes dependendo do estado atual
 * da sessão: já conectada devolve `{instance:{state}}`; desconectada/conectando dispara uma nova
 * tentativa e devolve o QR (`base64`). Ver `src/lib/integracoes/baileys.ts` — mapeado direto do
 * código-fonte da Evolution API (`instance.controller.ts`). */
type RespostaConexao =
  | { instance: { instanceName: string; state: "open" | "connecting" | "close" } }
  | { base64?: string; code?: string; count?: number; pairingCode?: string | null };

/** Cria a instância na Evolution API já pedindo o QR — chamado só quando `GET /connect` falha
 * (instância ainda não existe pra esse workspace). */
async function criarInstancia(instanceName: string): Promise<void> {
  await chamarEvolution("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        enabled: true,
        url: urlWebhook(),
        headers: { "x-worker-secret": segredoWebhook() },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });
}

export async function iniciarSessaoBaileys(workspaceId: string): Promise<void> {
  try {
    await chamarEvolution(`/instance/connect/${workspaceId}`);
  } catch {
    // Instância ainda não existe pra esse workspace — cria na hora, já com webhook configurado.
    await criarInstancia(workspaceId);
  }
}

export async function statusSessaoBaileys(workspaceId: string): Promise<StatusSessaoBaileys> {
  let resposta: RespostaConexao;
  try {
    resposta = (await chamarEvolution(`/instance/connect/${workspaceId}`)) as RespostaConexao;
  } catch {
    return { status: "desconectado", qrDataUrl: null, numero: null };
  }

  if ("instance" in resposta) {
    return resposta.instance.state === "open"
      ? { status: "conectado", qrDataUrl: null, numero: null }
      : { status: "desconectado", qrDataUrl: null, numero: null };
  }
  return { status: "aguardando_qr", qrDataUrl: resposta.base64 ?? null, numero: null };
}

export async function desconectarSessaoBaileys(workspaceId: string): Promise<void> {
  await chamarEvolution(`/instance/logout/${workspaceId}`, { method: "DELETE" }).catch(() => {});
}

export async function enviarMensagemBaileys(
  workspaceId: string,
  destinatario: string,
  texto: string,
): Promise<void> {
  await chamarEvolution(`/message/sendText/${workspaceId}`, {
    method: "POST",
    body: JSON.stringify({ number: destinatario.replace(/\D/g, ""), text: texto }),
  });
}
