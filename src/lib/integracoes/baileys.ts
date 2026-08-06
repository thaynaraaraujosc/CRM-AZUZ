/**
 * Cliente HTTP pro `whatsapp-worker` (serviço separado, sempre ligado, que mantém as conexões
 * WhatsApp "não oficiais" via QR Code — ver `whatsapp-worker/README.md`). Diferente da integração
 * Meta (OAuth, token guardado no banco), aqui quem guarda o estado real da conexão é o worker; o
 * Next.js só reflete esse estado na linha `Integracao` (`provedor: "whatsapp_baileys"`) pra UI.
 */

export type StatusSessaoBaileys = {
  status: "aguardando_qr" | "conectado" | "desconectado";
  qrDataUrl: string | null;
  numero: string | null;
};

function baseUrl(): string {
  const url = process.env.BAILEYS_WORKER_URL;
  if (!url) throw new Error("BAILEYS_WORKER_URL não configurada.");
  return url.replace(/\/$/, "");
}

function segredo(): string {
  const valor = process.env.WORKER_SECRET;
  if (!valor) throw new Error("WORKER_SECRET não configurada.");
  return valor;
}

async function chamarWorker(caminho: string, init?: RequestInit) {
  const resposta = await fetch(`${baseUrl()}${caminho}`, {
    ...init,
    headers: { "content-type": "application/json", "x-worker-secret": segredo(), ...init?.headers },
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error((corpo as { erro?: string }).erro ?? `Worker respondeu ${resposta.status}`);
  }
  return resposta.json();
}

export async function iniciarSessaoBaileys(workspaceId: string): Promise<void> {
  await chamarWorker(`/sessoes/${workspaceId}/iniciar`, { method: "POST" });
}

export async function statusSessaoBaileys(workspaceId: string): Promise<StatusSessaoBaileys> {
  return chamarWorker(`/sessoes/${workspaceId}/status`) as Promise<StatusSessaoBaileys>;
}

export async function desconectarSessaoBaileys(workspaceId: string): Promise<void> {
  await chamarWorker(`/sessoes/${workspaceId}/desconectar`, { method: "POST" });
}

export async function enviarMensagemBaileys(
  workspaceId: string,
  destinatario: string,
  texto: string,
): Promise<void> {
  await chamarWorker(`/sessoes/${workspaceId}/enviar`, {
    method: "POST",
    body: JSON.stringify({ destinatario, texto }),
  });
}
