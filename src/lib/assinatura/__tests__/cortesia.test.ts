import { describe, expect, it } from "vitest";

import { cortesiaValendo, diasDeCortesia, fimDaCortesia, statusEfetivo } from "../cortesia";

const AGORA = new Date("2026-11-05T12:00:00Z");

describe("conta de cortesia", () => {
  it("enquanto a data não chega, a conta vale como ativa", () => {
    const a = { status: "ativa", cortesiaAte: new Date("2027-05-05T12:00:00Z"), asaasSubscriptionId: "" };
    expect(cortesiaValendo(a, AGORA)).toBe(true);
    expect(statusEfetivo(a, AGORA)).toBe("ativa");
  });

  it("vencida e sem cobrança por trás, a conta cai na tela de pagamento", () => {
    /*
     * ESTA É A REGRA QUE FAZ A CORTESIA TERMINAR DE VERDADE.
     *
     * A coluna continua dizendo "ativa" — foi a cortesia que a deixou assim. Sem esta conversão,
     * a liberação dada por três meses valeria pra sempre, e o jeito de descobrir seria o cliente
     * perguntando por que nunca foi cobrado.
     */
    const a = { status: "ativa", cortesiaAte: new Date("2026-10-05T12:00:00Z"), asaasSubscriptionId: "" };
    expect(cortesiaValendo(a, AGORA)).toBe(false);
    expect(statusEfetivo(a, AGORA)).toBe("pendente");
  });

  it("cortesia que virou conta paga de verdade continua ativa", () => {
    // A pessoa assinou antes de a cortesia vencer: a cobrança existe, e ela manda.
    const a = { status: "ativa", cortesiaAte: new Date("2026-10-05T12:00:00Z"), asaasSubscriptionId: "sub_123" };
    expect(statusEfetivo(a, AGORA)).toBe("ativa");
  });

  it("conta normal não é afetada", () => {
    expect(statusEfetivo({ status: "ativa", asaasSubscriptionId: "sub_1" }, AGORA)).toBe("ativa");
    expect(statusEfetivo({ status: "pendente" }, AGORA)).toBe("pendente");
    expect(statusEfetivo({ status: "cancelada", cortesiaAte: null }, AGORA)).toBe("cancelada");
  });

  it("cancelada à mão durante a cortesia continua valendo como cortesia", () => {
    // É deliberado: cancelar é o botão de encerrar a cortesia ANTES do prazo, e pra isso a data
    // precisa ser limpa junto. Enquanto ela estiver lá, o prazo é o que vale.
    const a = { status: "cancelada", cortesiaAte: new Date("2027-01-05T12:00:00Z") };
    expect(statusEfetivo(a, AGORA)).toBe("ativa");
  });

  it("conta os dias que faltam", () => {
    expect(diasDeCortesia({ status: "ativa", cortesiaAte: new Date("2026-11-15T12:00:00Z") }, AGORA)).toBe(10);
    expect(diasDeCortesia({ status: "ativa", cortesiaAte: new Date("2026-11-01T12:00:00Z") }, AGORA)).toBe(-4);
    expect(diasDeCortesia({ status: "ativa" }, AGORA)).toBeNull();
  });
});

describe("o fim da cortesia, em meses de calendário", () => {
  it("soma meses sem transbordar o fim do mês", () => {
    // `setMonth` sozinho faz 31 de janeiro + 1 mês virar 3 de março, porque fevereiro não tem 31.
    // O dia fica preso ao último do mês de destino.
    expect(fimDaCortesia(1, new Date("2026-01-31T12:00:00")).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(fimDaCortesia(1, new Date("2026-03-31T12:00:00")).toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("os prazos do painel caem onde se espera", () => {
    const inicio = new Date("2026-11-05T12:00:00");
    expect(fimDaCortesia(3, inicio).toISOString().slice(0, 10)).toBe("2027-02-05");
    expect(fimDaCortesia(6, inicio).toISOString().slice(0, 10)).toBe("2027-05-05");
    expect(fimDaCortesia(12, inicio).toISOString().slice(0, 10)).toBe("2027-11-05");
  });
});
