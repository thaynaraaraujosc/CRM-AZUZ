import { describe, expect, it } from "vitest";

import { RITMO, intervaloEntreEnvios, preverDuracao } from "../ritmo";

/**
 * O que estes testes protegem não é aritmética — é decisão de segurança operacional.
 *
 * Os números de ritmo são o que separa uma campanha de um disparo em massa que derruba o número do
 * cliente. Um ajuste distraído aqui não quebra nenhuma tela, não falha no build e só aparece quando
 * alguém já perdeu a conta do WhatsApp. Os testes existem pra que essa mudança precise ser
 * deliberada.
 */
describe("ritmo por canal", () => {
  it("mantém o não oficial muito mais lento que o oficial", () => {
    // O não oficial é WhatsApp Web automatizado: não há API declarada, e volume é o motivo mais
    // comum de bloqueio. Se um dia ele ficar tão rápido quanto o oficial, é erro.
    expect(RITMO.whatsapp_nao_oficial.porMinuto).toBeLessThan(RITMO.whatsapp_oficial.porMinuto);
    expect(RITMO.whatsapp_nao_oficial.porDia).not.toBeNull();
  });

  it("só o não oficial varia o intervalo", () => {
    // Intervalo exato e repetido é a assinatura de robô que os sistemas antifraude procuram — e só
    // faz sentido disfarçar onde não há API declarada.
    expect(RITMO.whatsapp_nao_oficial.variacao).toBeGreaterThan(0);
    expect(RITMO.whatsapp_oficial.variacao).toBe(0);
    expect(RITMO.email.variacao).toBe(0);
  });

  it("não deixa o teto diário do WhatsApp oficial ser chutado no código", () => {
    // Tem que continuar nulo: quem sabe o limite é a conta da Meta, lido dela. Um número fixo aqui
    // ou seguraria uma conta que já pode mais, ou passaria do que ela aceita.
    expect(RITMO.whatsapp_oficial.porDia).toBeNull();
  });

  it("calcula o intervalo a partir do ritmo", () => {
    // 20 por minuto = uma a cada 3 segundos.
    expect(intervaloEntreEnvios("whatsapp_oficial")).toBe(3000);
  });

  it("mantém o intervalo variável dentro da faixa configurada", () => {
    const base = 60_000 / RITMO.whatsapp_nao_oficial.porMinuto;
    const desvio = base * RITMO.whatsapp_nao_oficial.variacao;
    for (let i = 0; i < 200; i++) {
      const valor = intervaloEntreEnvios("whatsapp_nao_oficial");
      expect(valor).toBeGreaterThanOrEqual(Math.round(base - desvio) - 1);
      expect(valor).toBeLessThanOrEqual(Math.round(base + desvio) + 1);
    }
  });
});

describe("previsão de duração", () => {
  it("avisa quando a lista não cabe na cota de 24h", () => {
    // O caso real: cinco mil contatos numa conta que entrega mil por dia. Sem este aviso, quem
    // monta a campanha acha que dispara hoje e descobre dias depois.
    const p = preverDuracao("whatsapp_oficial", 5000, 1000);
    expect(p.limitadoPorCota).toBe(true);
    expect(p.dias).toBe(5);
  });

  it("não fala em dias quando a lista cabe na cota", () => {
    const p = preverDuracao("whatsapp_oficial", 200, 1000);
    expect(p.limitadoPorCota).toBe(false);
    expect(p.dias).toBe(0);
  });

  it("estima e-mail em minutos, não em dias", () => {
    // 5.000 a 100 por minuto = 50 minutos. É o canal que aguenta a lista inteira de uma vez.
    const p = preverDuracao("email", 5000);
    expect(p.dias).toBe(0);
    expect(p.minutos).toBe(50);
  });

  it("usa o teto do canal quando a conta não informa um", () => {
    // Não oficial tem teto próprio (200/dia): mil contatos viram cinco dias.
    const p = preverDuracao("whatsapp_nao_oficial", 1000);
    expect(p.limitadoPorCota).toBe(true);
    expect(p.dias).toBe(5);
  });
});
