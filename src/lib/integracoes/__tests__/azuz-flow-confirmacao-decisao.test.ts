import { describe, expect, it } from "vitest";

import { decidirConfirmacao, type ContextoDaConfirmacao } from "../azuz-flow-confirmacao-decisao";

const AGORA = new Date("2026-10-19T12:00:00.000Z");

function ctx(mudancas: Partial<ContextoDaConfirmacao> = {}): ContextoDaConfirmacao {
  return {
    ativa: true,
    inicio: new Date("2026-10-20T17:30:00.000Z"),
    consentiu: true,
    telefone: "5562999990001",
    conversa: { nome: "Ana Souza", canal: "WhatsApp" },
    agora: AGORA,
    ...mudancas,
  };
}

describe("quando a confirmação sai", () => {
  it("com tudo no lugar, vai pra fila", () => {
    expect(decidirConfirmacao(ctx())).toEqual({ acao: "enfileirar" });
  });
});

describe("o silêncio, que não é falha", () => {
  it("lead sem reunião não vira registro nenhum", () => {
    // É a maioria dos leads. Gravar "não enviada" pra todo formulário sem agendamento encheria a
    // tela de não-notícia.
    expect(decidirConfirmacao(ctx({ inicio: null })).acao).toBe("nao_se_aplica");
  });

  it("desligada também é silêncio", () => {
    // A empresa escolheu não mandar. Isso não é uma falha pra reportar em cada lead.
    expect(decidirConfirmacao(ctx({ ativa: false })).acao).toBe("nao_se_aplica");
  });
});

describe("o consentimento, que aqui é estrito", () => {
  it("só `true` libera", () => {
    /*
     * A guarda geral do CRM bloqueia apenas o `false` explícito, e tem que continuar assim — a
     * coluna é opcional e a base antiga toda é `null`. Mas esta mensagem parte do CRM pra quem
     * NUNCA escreveu, por um número que pode ser bloqueado por denúncia: aqui "não se sabe" vale
     * como não.
     */
    for (const recusa of [false, undefined, null]) {
      const r = decidirConfirmacao(ctx({ consentiu: recusa as unknown as boolean }));
      expect(r).toEqual({ acao: "nao_enviar", motivo: "Confirmação não enviada: sem consentimento." });
    }
  });

  it("a frase é a que a Thaynara pediu, em português e pronta pra tela", () => {
    const r = decidirConfirmacao(ctx({ consentiu: false }));
    expect(r.acao === "nao_enviar" && r.motivo).toBe("Confirmação não enviada: sem consentimento.");
  });
});

describe("o que impede o envio, e precisa ser dito", () => {
  it("sem WhatsApp no lead", () => {
    const r = decidirConfirmacao(ctx({ telefone: null }));
    expect(r.acao === "nao_enviar" && r.motivo).toContain("não trouxe um WhatsApp válido");
  });

  it("sem conversa", () => {
    const r = decidirConfirmacao(ctx({ conversa: null }));
    expect(r.acao === "nao_enviar" && r.motivo).toContain("sem conversa");
  });

  it("conversa de outro canal diz QUAL canal", () => {
    // Mandar por WhatsApp criaria uma segunda frente com a mesma pessoa, pelo número que pode ser
    // bloqueado, sem ela ter pedido.
    const r = decidirConfirmacao(ctx({ conversa: { nome: "Ana", canal: "Instagram" } }));
    expect(r.acao === "nao_enviar" && r.motivo).toContain("atendido por Instagram");
  });

  it("reunião que já começou", () => {
    // Entrega repetida pelo Flow horas depois, ou formulário preenchido em cima da hora.
    const r = decidirConfirmacao(ctx({ inicio: new Date("2026-10-19T11:59:00.000Z") }));
    expect(r.acao === "nao_enviar" && r.motivo).toContain("já havia começado");
  });

  it("reunião exatamente agora conta como começada", () => {
    expect(decidirConfirmacao(ctx({ inicio: AGORA })).acao).toBe("nao_enviar");
  });
});

describe("a ordem das recusas", () => {
  it("desligada vence tudo: nem avalia consentimento", () => {
    // Com a chave desligada, nenhum lead pode gerar registro — nem os que dariam recusa.
    expect(decidirConfirmacao(ctx({ ativa: false, consentiu: false, telefone: null })).acao).toBe(
      "nao_se_aplica",
    );
  });

  it("consentimento vem antes de telefone: é a razão mais importante de não ter mandado", () => {
    const r = decidirConfirmacao(ctx({ consentiu: false, telefone: null }));
    expect(r.acao === "nao_enviar" && r.motivo).toContain("sem consentimento");
  });
});
