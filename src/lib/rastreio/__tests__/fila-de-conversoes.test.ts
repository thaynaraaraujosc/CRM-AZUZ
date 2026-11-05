import { describe, expect, it } from "vitest";

import {
  MAXIMO_DE_TENTATIVAS,
  chaveDeIdempotencia,
  mascarar,
  motivoParaPular,
  podeReprocessar,
  proximaTentativaEm,
  resumirPedido,
} from "../eventos-de-conversao";

const semIdentificador = {};

describe("a chave que impede a mesma conversão de ir duas vezes", () => {
  it("muda com o resultado, e não com a hora", () => {
    /*
     * MANDAR DUAS VEZES É PIOR QUE NÃO MANDAR: cada upload vira uma conversão nova no relatório
     * da plataforma, e o algoritmo passa a achar que a campanha rende o dobro do que rende.
     * Reprocessar a MESMA venda tem que achar a linha existente; uma venda nova do mesmo lead é
     * outra conversão, legítima.
     */
    const base = { workspaceId: "w1", contatoId: "c1", plataforma: "google", evento: "purchase" };
    expect(chaveDeIdempotencia({ ...base, resultadoId: "neg-1" })).toBe(
      chaveDeIdempotencia({ ...base, resultadoId: "neg-1" }),
    );
    expect(chaveDeIdempotencia({ ...base, resultadoId: "neg-1" })).not.toBe(
      chaveDeIdempotencia({ ...base, resultadoId: "neg-2" }),
    );
  });

  it("separa workspaces, plataformas e eventos", () => {
    const base = { workspaceId: "w1", contatoId: "c1", plataforma: "google", evento: "purchase", resultadoId: "n1" };
    expect(chaveDeIdempotencia(base)).not.toBe(chaveDeIdempotencia({ ...base, workspaceId: "w2" }));
    expect(chaveDeIdempotencia(base)).not.toBe(chaveDeIdempotencia({ ...base, plataforma: "meta" }));
    expect(chaveDeIdempotencia(base)).not.toBe(chaveDeIdempotencia({ ...base, evento: "lead_created" }));
  });

  it("sem resultado, o lead tem uma conversão daquele evento — não uma por clique", () => {
    const base = { workspaceId: "w1", contatoId: "c1", plataforma: "meta", evento: "lead_created" };
    expect(chaveDeIdempotencia(base)).toBe(chaveDeIdempotencia({ ...base, resultadoId: "" }));
  });
});

describe("o que não pode ser mandado, e por quê", () => {
  it("compra sem valor é bloqueada", () => {
    // Uma venda enviada com valor zero ensina o algoritmo que aquela campanha produz vendas que
    // não valem nada. É pior do que não mandar.
    const r = motivoParaPular({
      evento: "purchase",
      valor: 0,
      moeda: "BRL",
      plataforma: "google",
      identificadores: { gclid: "abc" },
    });
    expect(r.pular).toBe(true);
    expect(r.pular && r.motivo).toContain("valor");
  });

  it("compra sem moeda é bloqueada", () => {
    const r = motivoParaPular({
      evento: "purchase",
      valor: 100,
      moeda: "",
      plataforma: "google",
      identificadores: { gclid: "abc" },
    });
    expect(r.pular).toBe(true);
    expect(r.pular && r.motivo).toContain("moeda");
  });

  it("lead sem identificador nenhum é pulado com o motivo escrito", () => {
    const r = motivoParaPular({ evento: "lead_created", plataforma: "google", identificadores: semIdentificador });
    expect(r.pular).toBe(true);
    expect(r.pular && r.motivo).toContain("gclid");
  });

  it("o GA4 não aceita e-mail no lugar do identificador do navegador", () => {
    // Mandar sem `client_id` faz o GA4 aceitar o evento e inventar um usuário novo a cada envio:
    // estraga o relatório em vez de preenchê-lo.
    const r = motivoParaPular({
      evento: "lead_created",
      plataforma: "ga4",
      identificadores: { email: "ana@exemplo.com", telefone: "5562999990000" },
    });
    expect(r.pular).toBe(true);
    expect(r.pular && r.motivo).toContain("gclientid");
  });

  it("e-mail ou telefone bastam pro Google e pra Meta, sem código de clique", () => {
    // É exatamente o caso que as Conversões Aprimoradas existem pra cobrir, e ele cresce a cada
    // ano com as restrições de privacidade.
    expect(motivoParaPular({ evento: "lead_created", plataforma: "google", identificadores: { email: "a@b.com" } }).pular).toBe(false);
    expect(motivoParaPular({ evento: "lead_created", plataforma: "meta", identificadores: { telefone: "5562999990000" } }).pular).toBe(false);
    expect(motivoParaPular({ evento: "purchase", valor: 4800, moeda: "BRL", plataforma: "meta", identificadores: { ctwaClid: "x" } }).pular).toBe(false);
  });
});

describe("quando tentar de novo", () => {
  it("a espera cresce: 5min, 20min, 1h20, 5h20", () => {
    const agora = new Date("2026-11-05T12:00:00Z");
    const minutos = (d: Date | null) => (d ? Math.round((d.getTime() - agora.getTime()) / 60000) : null);
    expect(minutos(proximaTentativaEm(1, agora))).toBe(5);
    expect(minutos(proximaTentativaEm(2, agora))).toBe(20);
    expect(minutos(proximaTentativaEm(3, agora))).toBe(80);
    expect(minutos(proximaTentativaEm(4, agora))).toBe(320);
  });

  it("esgotadas as tentativas, a fila para e espera alguém", () => {
    expect(proximaTentativaEm(MAXIMO_DE_TENTATIVAS, new Date())).toBeNull();
  });
});

describe("reprocessar", () => {
  it("o que já foi enviado NÃO volta pra fila", () => {
    // Reenviar o que já chegou produziria a venda em dobro no relatório da plataforma.
    expect(podeReprocessar("enviado")).toBe(false);
    expect(podeReprocessar("estornado")).toBe(false);
    expect(podeReprocessar("falhou")).toBe(true);
    expect(podeReprocessar("pulado")).toBe(true);
  });
});

describe("o que fica gravado no histórico", () => {
  it("o resumo diz QUAIS identificadores foram usados, nunca os valores", () => {
    const resumo = resumirPedido({
      plataforma: "google",
      evento: "purchase",
      valor: 4800,
      moeda: "BRL",
      identificadores: { gclid: "EAIaCj0", email: "ana@exemplo.com", telefone: null },
    });
    expect(resumo).toContain("gclid, email");
    expect(resumo).toContain("BRL 4800.00");
    expect(resumo).not.toContain("ana@exemplo.com");
    expect(resumo).not.toContain("EAIaCj0");
  });

  it("mascarar mostra o bastante pra reconhecer e pouco pra reconstruir", () => {
    expect(mascarar("ana@exemplo.com")).toBe("an••••••••om");
    expect(mascarar("")).toBe("—");
    expect(mascarar("abc")).toBe("•••");
  });
});
