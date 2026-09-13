/**
 * Conciliação da assinatura com o que a Asaas realmente diz.
 *
 * O PROBLEMA: o status local só muda por webhook. Webhook é uma promessa de entrega, não uma
 * garantia: ele se perde por instabilidade de rede, por deploy no segundo errado, por token
 * trocado no painel da Asaas, por indisponibilidade dos dois lados. E quando ele se perde, não
 * existe nova tentativa nem aviso. A assinatura fica `pendente` para sempre.
 *
 * E "pendente" aqui não é um detalhe de cadastro: é o paywall. Quer dizer que a pessoa PAGOU, a
 * Asaas registrou o pagamento, e o CRM continua mostrando a ela a tela de cobrança. É a pior falha
 * possível de um produto que se vende por assinatura, porque acontece exatamente no minuto
 * seguinte à decisão de comprar, e quem está do outro lado conclui que o produto não funciona.
 *
 * A SAÍDA: parar de tratar o webhook como a única fonte. A Asaas sabe a verdade e responde quando
 * perguntada; basta perguntar. Esta função é a pergunta, na forma pura: recebe as cobranças como
 * elas voltam da API e devolve o status que a assinatura DEVERIA ter.
 *
 * Pura de propósito. A regra de "quando uma assinatura está paga" é a que decide se alguém entra
 * ou não no produto que pagou, e regra desse peso não pode depender de banco nem de rede para ser
 * verificada.
 */

/** Cobrança paga: o dinheiro entrou (ou foi confirmado pela operadora). */
const STATUS_PAGOS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

/** Cobrança vencida e não paga. */
const STATUS_VENCIDOS = new Set(["OVERDUE"]);

/**
 * Dinheiro que voltou. Estorno e chargeback não podem contar como pagamento: seria acesso
 * liberado sem receita, e o caso do chargeback é justamente aquele em que a pessoa contesta a
 * cobrança e continua usando.
 */
const STATUS_DEVOLVIDOS = new Set([
  "REFUNDED",
  "REFUND_REQUESTED",
  "REFUND_IN_PROGRESS",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
]);

export type CobrancaParaConciliar = {
  status: string;
  dueDate: string;
  paymentDate?: string | null;
};

export type StatusAssinatura = "ativa" | "atrasada" | "pendente";

/**
 * O status que a assinatura deveria ter, olhando só as cobranças.
 *
 * Devolve `null` quando não dá pra afirmar nada (lista vazia, ou só cobranças em aberto que ainda
 * não venceram). `null` significa "não mexe", e não "pendente": sobrescrever um status existente
 * por causa de uma resposta incompleta da Asaas é pior do que não fazer nada, porque tiraria o
 * acesso de alguém que está em dia.
 */
export function statusPelasCobrancas(cobrancas: CobrancaParaConciliar[]): StatusAssinatura | null {
  if (!cobrancas.length) return null;

  // Estorno e chargeback pesam mais que qualquer pagamento anterior: se o dinheiro voltou, o
  // acesso não se sustenta, mesmo que exista uma cobrança paga na lista.
  if (cobrancas.some((c) => STATUS_DEVOLVIDOS.has(c.status))) return "pendente";

  if (cobrancas.some((c) => STATUS_PAGOS.has(c.status))) return "ativa";
  if (cobrancas.some((c) => STATUS_VENCIDOS.has(c.status))) return "atrasada";

  return null;
}

/**
 * Se vale gravar: só quando a Asaas afirma algo E esse algo é diferente do que está guardado.
 *
 * Existe para o caminho normal (tudo em dia) não gerar escrita nenhuma. A conciliação roda em toda
 * abertura da tela de assinatura e a cada rodada do relógio; gravar a cada passagem encheria o log
 * de auditoria de linha sem informação e mexeria no banco à toa.
 */
export function precisaConciliar(
  statusGuardado: string | null,
  statusReal: StatusAssinatura | null,
): statusReal is StatusAssinatura {
  return statusReal !== null && statusReal !== statusGuardado;
}
