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
 * (instância ainda não existe pra esse workspace).
 *
 * `syncFullHistory: true` é campo solto na raiz do corpo (não dentro de `settings`) — pede pro
 * WhatsApp mandar o histórico completo de conversas assim que a sessão conecta, igual o WhatsApp
 * Web faz. Chega em vários pacotes via o evento `MESSAGES_SET` (por isso também nos eventos do
 * webhook abaixo) — o último pacote vem com `isLatest: true`. Sem limite configurável de dias:
 * tudo que o WhatsApp decidir mandar, chega. Tratamento no webhook (ver
 * `src/app/api/webhooks/whatsapp-baileys/route.ts`).
 */
async function criarInstancia(instanceName: string): Promise<void> {
  await chamarEvolution("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      syncFullHistory: true,
      webhook: {
        enabled: true,
        url: urlWebhook(),
        headers: { "x-worker-secret": segredoWebhook() },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_SET"],
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

/**
 * Apaga a instância inteira (não só desloga) — de propósito: `logout` sozinho mantém a instância
 * (e a configuração dela, tipo `syncFullHistory`/webhook) do jeito que estava na criação, então
 * reconectar depois de um logout simples reusa configuração antiga. Apagando, o próximo
 * `iniciarSessaoBaileys` recria do zero, sempre com a configuração mais atual.
 */
export async function desconectarSessaoBaileys(workspaceId: string): Promise<void> {
  await chamarEvolution(`/instance/logout/${workspaceId}`, { method: "DELETE" }).catch(() => {});
  await chamarEvolution(`/instance/delete/${workspaceId}`, { method: "DELETE" }).catch(() => {});
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

/** Cartão de contato (vCard) de verdade via `/message/sendContact` da Evolution API — mesmo
 * endpoint usado pelo envio de texto, troca só o corpo. */
export async function enviarContatoBaileys(
  workspaceId: string,
  destinatario: string,
  contato: { nome: string; whatsapp?: string; telefoneFixo?: string },
): Promise<void> {
  const numero = (contato.whatsapp || contato.telefoneFixo || "").replace(/\D/g, "");
  await chamarEvolution(`/message/sendContact/${workspaceId}`, {
    method: "POST",
    body: JSON.stringify({
      number: destinatario.replace(/\D/g, ""),
      contact: [{ fullName: contato.nome, wuid: numero, phoneNumber: numero ? `+${numero}` : "" }],
    }),
  });
}
