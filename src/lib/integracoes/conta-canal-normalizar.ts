/**
 * A MESMA CONEXÃO, ESCRITA DE DOIS JEITOS.
 *
 * `whatsapp_baileys:` é o nome ANTIGO do canal de QR Code. Ele continua gravado em conversa, em
 * mensagem e em card de antes da renomeação, e o nome novo é `whatsapp_nao_oficial:`. Comparar as
 * duas formas cruas faz um número que conversa há meses parecer um número que nunca falou — e,
 * onde a comparação decide de qual funil é a conversa, faz o lead cair no quadro errado ou em
 * nenhum.
 *
 * Mora num arquivo próprio, minúsculo e sem dependência, porque quem precisa dele está nos dois
 * lados: o servidor (webhook, reconciliação) e o navegador (caixa de entrada, funil). `conta-canal.ts`
 * fala com o banco e não pode ser importado pelo cliente.
 */

const PREFIXO_ANTIGO = "whatsapp_baileys:";
const PREFIXO_NOVO = "whatsapp_nao_oficial:";

/** A forma canônica de um `contaCanal`. Mantém `null`/vazio como estão. */
export function normalizarContaCanal<T extends string | null | undefined>(contaCanal: T): T {
  if (!contaCanal) return contaCanal;
  return (
    contaCanal.startsWith(PREFIXO_ANTIGO)
      ? `${PREFIXO_NOVO}${contaCanal.slice(PREFIXO_ANTIGO.length)}`
      : contaCanal
  ) as T;
}

/** As duas grafias do mesmo `contaCanal`, pra um `where … in`. Sempre sem repetição. */
export function grafiasDoContaCanal(contaCanal: string): string[] {
  const novo = normalizarContaCanal(contaCanal);
  const antigo = novo.startsWith(PREFIXO_NOVO)
    ? `${PREFIXO_ANTIGO}${novo.slice(PREFIXO_NOVO.length)}`
    : null;
  return antigo ? [novo, antigo] : [novo];
}
