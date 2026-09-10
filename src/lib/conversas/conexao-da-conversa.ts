/**
 * Por qual conexão de WhatsApp uma conversa fala.
 *
 * As duas conexões podem estar ligadas ao mesmo tempo, e isso é normal: a API oficial manda modelo
 * aprovado e reabre conversa fora das 24 horas; o QR Code é o número que o cliente já conhece. O
 * que não é normal é não dar pra saber qual é qual olhando a lista.
 *
 * O identificador da conversa tem o formato "provedor:identificador". `whatsapp_baileys` é o
 * prefixo antigo do QR Code, de antes de o provedor ser renomeado, e continua valendo pra não
 * deixar conversa velha sem etiqueta.
 */
export type ConexaoDaConversa = "oficial" | "qrcode";

export function conexaoDaConversa(contaCanal: string | null | undefined): ConexaoDaConversa | null {
  if (!contaCanal) return null;
  if (contaCanal.startsWith("meta_whatsapp:")) return "oficial";
  if (contaCanal.startsWith("whatsapp_nao_oficial:") || contaCanal.startsWith("whatsapp_baileys:")) {
    return "qrcode";
  }
  return null;
}

export const ROTULO_CONEXAO: Record<ConexaoDaConversa, string> = {
  oficial: "WhatsApp API oficial",
  qrcode: "WhatsApp QR Code",
};

/**
 * Vale a pena etiquetar as conversas desta lista?
 *
 * Só quando as DUAS conexões aparecem nela. Com uma só, a etiqueta repetiria em toda linha a mesma
 * informação e viraria ruído: se tudo é do mesmo lugar, dizer de onde é não informa nada.
 */
export function precisaDistinguirConexao(
  conversas: { contaCanal: string | null }[],
): boolean {
  const tipos = new Set<ConexaoDaConversa>();
  for (const c of conversas) {
    const tipo = conexaoDaConversa(c.contaCanal);
    if (tipo) tipos.add(tipo);
    if (tipos.size > 1) return true;
  }
  return false;
}
