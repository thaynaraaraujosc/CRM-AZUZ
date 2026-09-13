import { describe, expect, it } from "vitest";

import { precisaConciliar, statusPelasCobrancas, type CobrancaParaConciliar } from "../conciliar";

/**
 * A falha que estes testes prendem: "paguei e o CRM não me deixa entrar".
 *
 * O status da assinatura só mudava por webhook, e webhook é promessa de entrega, não garantia. Ele
 * se perde por instabilidade de rede, por deploy no segundo errado, por token trocado no painel da
 * Asaas. Quando se perde, não há nova tentativa: a assinatura fica `pendente` para sempre, e
 * `pendente` é o paywall. A pessoa pagou, a Asaas registrou, e o CRM segue mostrando a tela de
 * cobrança pra ela.
 *
 * É a pior falha possível num produto vendido por assinatura, porque acontece no minuto seguinte à
 * decisão de comprar, que é quando a confiança é menor.
 */
function cobranca(status: string, extra: Partial<CobrancaParaConciliar> = {}): CobrancaParaConciliar {
  return { status, dueDate: "2026-09-10", paymentDate: null, ...extra };
}

describe("statusPelasCobrancas", () => {
  // O caso que motivou tudo: a Asaas diz que recebeu, e o CRM precisa concordar.
  it("cobrança recebida libera o acesso", () => {
    expect(statusPelasCobrancas([cobranca("RECEIVED")])).toBe("ativa");
  });

  it("aceita as três formas de pagamento confirmado da Asaas", () => {
    for (const status of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]) {
      expect(statusPelasCobrancas([cobranca(status)]), status).toBe("ativa");
    }
  });

  it("cobrança vencida deixa a assinatura atrasada", () => {
    expect(statusPelasCobrancas([cobranca("OVERDUE")])).toBe("atrasada");
  });

  // Uma paga e uma vencida acontece o tempo todo: quem pagou o mês passado e não pagou este. O que
  // vale é ter pagamento reconhecido; a régua de corte de quem atrasou é do webhook e do relógio.
  it("pagamento vale mais que vencimento na mesma lista", () => {
    expect(statusPelasCobrancas([cobranca("OVERDUE"), cobranca("RECEIVED")])).toBe("ativa");
  });

  /**
   * Dinheiro que voltou não é dinheiro que entrou. O caso perigoso é o chargeback: a pessoa
   * contesta a cobrança e continua usando o produto. Sem esta regra, a lista teria um `RECEIVED`
   * antigo e o acesso seguiria liberado.
   */
  it("estorno e chargeback derrubam o acesso, mesmo com pagamento na lista", () => {
    for (const status of [
      "REFUNDED",
      "REFUND_REQUESTED",
      "REFUND_IN_PROGRESS",
      "CHARGEBACK_REQUESTED",
      "CHARGEBACK_DISPUTE",
      "AWAITING_CHARGEBACK_REVERSAL",
    ]) {
      expect(statusPelasCobrancas([cobranca("RECEIVED"), cobranca(status)]), status).toBe("pendente");
    }
  });

  /**
   * `null` quer dizer "não mexe", e é diferente de "pendente". Sobrescrever um status bom por
   * causa de uma resposta incompleta da Asaas tiraria o acesso de quem está em dia, que é
   * exatamente o problema que esta conciliação veio resolver, só que ao contrário.
   */
  it("não afirma nada com lista vazia", () => {
    expect(statusPelasCobrancas([])).toBeNull();
  });

  it("não afirma nada com cobrança só em aberto", () => {
    expect(statusPelasCobrancas([cobranca("PENDING")])).toBeNull();
    expect(statusPelasCobrancas([cobranca("AWAITING_RISK_ANALYSIS")])).toBeNull();
  });

  it("status desconhecido da Asaas não derruba ninguém", () => {
    // A Asaas pode criar status novo sem avisar. O certo é ignorar, não deduzir.
    expect(statusPelasCobrancas([cobranca("ALGO_QUE_NAO_EXISTIA_ANTES")])).toBeNull();
  });
});

describe("precisaConciliar", () => {
  it("grava quando a Asaas discorda do que está guardado", () => {
    expect(precisaConciliar("pendente", "ativa")).toBe(true);
  });

  // O caminho normal, que é a maioria esmagadora das passagens: tudo em dia, nada a fazer.
  it("não grava quando já bate", () => {
    expect(precisaConciliar("ativa", "ativa")).toBe(false);
  });

  it("não grava quando a Asaas não afirmou nada", () => {
    expect(precisaConciliar("pendente", null)).toBe(false);
    expect(precisaConciliar(null, null)).toBe(false);
  });

  it("grava quando não havia status nenhum e a Asaas afirma um", () => {
    expect(precisaConciliar(null, "ativa")).toBe(true);
  });
});
