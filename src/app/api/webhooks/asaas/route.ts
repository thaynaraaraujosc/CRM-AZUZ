import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarTokenWebhookAsaas } from "@/lib/integracoes/asaas";

type PayloadAsaas = {
  event: string;
  payment?: {
    subscription?: string;
    status?: string;
    dueDate?: string;
  };
};

/** Status de cobrança da Asaas que colocam a assinatura em dia (o valor foi confirmado — via
 * cartão aprovado na hora, ou boleto/PIX compensado depois). */
const STATUS_QUE_ATIVAM = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
/** Cobrança vencida sem pagamento — assinatura fica "atrasada" mas continua existindo (diferente
 * de "cancelada", que só acontece por ação explícita do admin ou da Asaas). */
const STATUS_QUE_ATRASAM = new Set(["OVERDUE"]);

/**
 * POST recebe eventos de cobrança da Asaas (`PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`,
 * `PAYMENT_OVERDUE`, etc. — sempre sobre uma cobrança individual, a Asaas não tem webhook
 * dedicado a assinatura). Sem `auth()` de propósito, quem chama é a Asaas; a autenticidade vem do
 * header `asaas-access-token`, configurado no painel da Asaas com o mesmo valor de
 * `ASAAS_WEBHOOK_TOKEN`.
 */
export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!validarTokenWebhookAsaas(token)) {
    return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
  }

  const payload = (await request.json()) as PayloadAsaas;
  const pagamento = payload.payment;
  if (!pagamento?.subscription || !pagamento.status) {
    return NextResponse.json({ ok: true });
  }

  const assinatura = await prisma.assinatura.findFirst({
    where: { asaasSubscriptionId: pagamento.subscription },
  });
  if (!assinatura) return NextResponse.json({ ok: true });

  let novoStatus: string | null = null;
  if (STATUS_QUE_ATIVAM.has(pagamento.status)) novoStatus = "ativa";
  else if (STATUS_QUE_ATRASAM.has(pagamento.status)) novoStatus = "atrasada";

  if (!novoStatus) return NextResponse.json({ ok: true });

  // Aproxima o próximo vencimento em +1 mês a partir do vencimento da cobrança que acabou de ser
  // paga (ciclo é sempre MONTHLY) — evita ter que fazer uma segunda chamada à Asaas só pra buscar
  // a assinatura atualizada.
  const proximoVencimento = pagamento.dueDate
    ? new Date(new Date(pagamento.dueDate).setMonth(new Date(pagamento.dueDate).getMonth() + 1))
    : undefined;

  await prisma.assinatura.update({
    where: { id: assinatura.id },
    data: { status: novoStatus, ...(proximoVencimento ? { proximoVencimento } : {}) },
  });

  return NextResponse.json({ ok: true });
}
