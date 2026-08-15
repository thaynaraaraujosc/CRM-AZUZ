import { timingSafeEqual } from "node:crypto";

/**
 * Cliente da API v3 da Asaas — cobrança da assinatura do próprio CRM (mensalidade do workspace),
 * não a integração de pagamento de um cliente do CRM. `ASAAS_ENV` escolhe sandbox ("homologação",
 * chave começa com `$aact_hmlg_`) ou produção (chave começa com `$aact_prod_`); default sandbox
 * pra nunca cobrar de verdade por engano se a env var não for setada.
 */
function baseUrl(): string {
  const ambiente = process.env.ASAAS_ENV ?? "sandbox";
  return ambiente === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

function apiKey(): string {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) throw new Error("ASAAS_API_KEY não configurada.");
  return chave;
}

async function chamarAsaas<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${baseUrl()}${caminho}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      access_token: apiKey(),
      ...init?.headers,
    },
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const mensagem = (corpo as { errors?: { description?: string }[] }).errors?.[0]?.description;
    throw new Error(mensagem ?? `Asaas respondeu ${resposta.status}`);
  }
  return corpo as T;
}

export type AsaasCliente = { id: string };

export async function criarOuBuscarCliente(dados: {
  /** externalReference casa o cliente Asaas com o workspace — evita criar um cliente Asaas
   * duplicado se a chamada de criação for repetida (ex.: usuário atualiza a página no meio do
   * fluxo). */
  workspaceId: string;
  nome: string;
  email: string;
  cpfCnpj: string;
}): Promise<AsaasCliente> {
  const existentes = await chamarAsaas<{ data: AsaasCliente[] }>(
    `/customers?externalReference=${encodeURIComponent(dados.workspaceId)}`,
  );
  if (existentes.data[0]) return existentes.data[0];

  return chamarAsaas<AsaasCliente>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: dados.nome,
      email: dados.email,
      cpfCnpj: dados.cpfCnpj,
      externalReference: dados.workspaceId,
    }),
  });
}

export type FormaPagamentoAsaas = "BOLETO" | "CREDIT_CARD" | "PIX";

export type AsaasAssinatura = {
  id: string;
  status: string;
  nextDueDate: string;
};

export async function criarAssinatura(dados: {
  customerId: string;
  valor: number;
  formaPagamento: FormaPagamentoAsaas;
  descricao: string;
  /** Obrigatório quando formaPagamento é CREDIT_CARD — a Asaas não guarda cartão sem esses dados. */
  cartao?: {
    numero: string;
    nomeImpresso: string;
    validadeMes: string;
    validadeAno: string;
    cvv: string;
    titular: { nome: string; email: string; cpfCnpj: string; cep: string; numeroEndereco: string; telefone: string };
  };
}): Promise<AsaasAssinatura> {
  const hoje = new Date().toISOString().slice(0, 10);

  return chamarAsaas<AsaasAssinatura>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customerId,
      billingType: dados.formaPagamento,
      value: dados.valor,
      nextDueDate: hoje,
      cycle: "MONTHLY",
      description: dados.descricao,
      ...(dados.cartao
        ? {
            creditCard: {
              holderName: dados.cartao.nomeImpresso,
              number: dados.cartao.numero,
              expiryMonth: dados.cartao.validadeMes,
              expiryYear: dados.cartao.validadeAno,
              ccv: dados.cartao.cvv,
            },
            creditCardHolderInfo: {
              name: dados.cartao.titular.nome,
              email: dados.cartao.titular.email,
              cpfCnpj: dados.cartao.titular.cpfCnpj,
              postalCode: dados.cartao.titular.cep,
              addressNumber: dados.cartao.titular.numeroEndereco,
              phone: dados.cartao.titular.telefone,
            },
          }
        : {}),
    }),
  });
}

export async function cancelarAssinatura(assinaturaId: string): Promise<void> {
  await chamarAsaas(`/subscriptions/${assinaturaId}`, { method: "DELETE" });
}

export type AsaasCobranca = {
  id: string;
  value: number;
  status: string; // "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | "REFUNDED" | ...
  dueDate: string;
  paymentDate: string | null;
  invoiceUrl: string;
};

export async function listarCobrancas(assinaturaId: string): Promise<AsaasCobranca[]> {
  const resultado = await chamarAsaas<{ data: AsaasCobranca[] }>(
    `/payments?subscription=${encodeURIComponent(assinaturaId)}&order=desc&sort=dueDate`,
  );
  return resultado.data;
}

/**
 * Valida o header `asaas-access-token` que a Asaas manda em todo POST de webhook — o valor é
 * escolhido por quem configura o webhook no painel da Asaas (Configurações > Integrações >
 * Webhooks) e precisa ser o mesmo salvo em `ASAAS_WEBHOOK_TOKEN`. Diferente da Meta, a Asaas não
 * assina o corpo com HMAC — é comparação direta de token, por isso `timingSafeEqual` (evita side
 * channel de tempo de comparação) em vez de `===`.
 */
export function validarTokenWebhookAsaas(tokenHeader: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !tokenHeader) return false;

  const bufRecebido = Buffer.from(tokenHeader);
  const bufEsperado = Buffer.from(esperado);
  if (bufRecebido.length !== bufEsperado.length) return false;
  return timingSafeEqual(bufRecebido, bufEsperado);
}
