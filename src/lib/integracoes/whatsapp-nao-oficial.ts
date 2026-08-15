import { timingSafeEqual } from "node:crypto";

/**
 * Segredo compartilhado entre o CRM e o whatsapp-service (processo Baileys separado, ver
 * whatsapp-service/README.md) — mais simples que o HMAC usado com a Meta porque os dois lados são
 * serviços nossos, não uma plataforma externa: só precisa bater um valor fixo nos dois `.env`.
 */
function segredo(): string {
  const valor = process.env.WHATSAPP_SERVICO_SEGREDO;
  if (!valor) throw new Error("WHATSAPP_SERVICO_SEGREDO não configurado.");
  return valor;
}

export function validarSegredoDoServico(headerRecebido: string | null): boolean {
  if (!headerRecebido) return false;
  const bufRecebido = Buffer.from(headerRecebido);
  const bufEsperado = Buffer.from(segredo());
  if (bufRecebido.length !== bufEsperado.length) return false;
  return timingSafeEqual(bufRecebido, bufEsperado);
}

function urlDoServico(): string {
  const valor = process.env.WHATSAPP_SERVICO_URL;
  if (!valor) throw new Error("WHATSAPP_SERVICO_URL não configurado.");
  return valor;
}

async function chamarServico(caminho: string, corpo?: Record<string, unknown>) {
  const resposta = await fetch(`${urlDoServico()}${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-crm-segredo": segredo() },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!resposta.ok) {
    throw new Error(`whatsapp-service respondeu ${resposta.status} em ${caminho}`);
  }
  return resposta.json();
}

/** Pede pro whatsapp-service encerrar a sessão atual (equivalente a "sair" no WhatsApp Web) — ele
 * mesmo já inicia uma sessão nova em seguida, gerando um QR code novo. */
export function desconectarWhatsAppNaoOficial() {
  return chamarServico("/desconectar");
}

/** Manda uma mensagem de texto pelo número conectado — usado quando o atendente responde pela
 * tela de Conversas num contato que chegou pelo WhatsApp não oficial. */
export function enviarMensagemWhatsAppNaoOficial(waId: string, texto: string) {
  return chamarServico("/enviar", { waId, texto });
}
