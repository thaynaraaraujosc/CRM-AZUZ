import { describe, expect, it } from "vitest";

import { lerInstanteEmBrasilia, lerLeadDaResposta } from "../lead-da-resposta";

/**
 * O formulário do CRM virando lead atendível.
 *
 * A leitura acontece no SERVIDOR, a partir do mapeamento que já está gravado no formulário — e não
 * no navegador de quem responde, que é como o contato e o card são criados hoje. Quem fecha a aba
 * no meio deixa metade acontecer, e mensagem automática não pode depender disso.
 */

function pagina(perguntas: unknown[]) {
  return [{ perguntas }];
}

describe("o que vira reunião", () => {
  it("só o campo AGENDAR REUNIÃO, nunca um 'data e hora' qualquer", () => {
    /*
     * A distinção que justifica o tipo novo: um "Data e hora" comum pode ser nascimento, prazo ou
     * data da obra. Nenhum deles deve virar compromisso na agenda nem gerar mensagem pra pessoa.
     */
    const paginas = pagina([
      { id: "p1", tipo: "data_hora" },
      { id: "p2", tipo: "agendamento" },
    ]);

    const lead = lerLeadDaResposta(paginas, { p1: "2026-01-02T08:00", p2: "2026-10-23T16:00" });

    expect(lead.reuniao?.toISOString()).toBe("2026-10-23T19:00:00.000Z");
  });

  it("sem o campo, não há reunião", () => {
    const lead = lerLeadDaResposta(pagina([{ id: "p1", tipo: "data_hora" }]), { p1: "2026-10-23T16:00" });
    expect(lead.reuniao).toBeNull();
  });

  it("campo presente e vazio também não é reunião", () => {
    const lead = lerLeadDaResposta(pagina([{ id: "p1", tipo: "agendamento" }]), { p1: "" });
    expect(lead.reuniao).toBeNull();
  });
});

describe("a hora é de Brasília", () => {
  it("16:00 escolhido no formulário é 19:00 UTC", () => {
    // Ler como UTC jogaria toda reunião três horas pra frente: "14:00" viraria 11:00 na agenda.
    expect(lerInstanteEmBrasilia("2026-10-23T16:00")?.toISOString()).toBe("2026-10-23T19:00:00.000Z");
  });

  it("23:30 vira o dia seguinte em UTC, e isso é o certo", () => {
    expect(lerInstanteEmBrasilia("2026-10-23T23:30")?.toISOString()).toBe("2026-10-24T02:30:00.000Z");
  });

  it("o que não tem forma de data e hora não vira nada", () => {
    expect(lerInstanteEmBrasilia("")).toBeNull();
    expect(lerInstanteEmBrasilia("23/10/2026")).toBeNull();
    expect(lerInstanteEmBrasilia("2026-10-23")).toBeNull();
  });
});

describe("o consentimento", () => {
  const comCaixa = (valor: string) =>
    lerLeadDaResposta(pagina([{ id: "c", tipo: "sim_nao", mapeamentoCrm: "consentimentoWhatsApp" }]), { c: valor });

  it("aceita as formas que os campos do formulário gravam", () => {
    for (const sim of ["sim", "Sim", "true", "1", "on", "aceito", "concordo"]) {
      expect(comCaixa(sim).consentiu, sim).toBe(true);
    }
  });

  it("qualquer outra coisa é não", () => {
    for (const nao of ["nao", "não", "false", "0", "talvez", ""]) {
      expect(comCaixa(nao).consentiu, nao).toBe(false);
    }
  });

  it("SEM a pergunta no formulário, é não", () => {
    /*
     * E não "não se sabe". Esta mensagem parte do CRM pra quem NUNCA escreveu, por um número que
     * pode ser bloqueado por denúncia: pra iniciar conversa, a ausência vale como recusa.
     */
    const lead = lerLeadDaResposta(pagina([{ id: "n", tipo: "texto_curto", mapeamentoCrm: "nome" }]), { n: "Ana" });
    expect(lead.consentiu).toBe(false);
  });
});

describe("o telefone", () => {
  const comTelefone = (valor: string) =>
    lerLeadDaResposta(pagina([{ id: "t", tipo: "telefone", mapeamentoCrm: "whatsapp" }]), { t: valor });

  it("sai normalizado, do jeito que o envio precisa", () => {
    expect(comTelefone("(62) 99634-0438").whatsapp).toBe("5562996340438");
  });

  it("o que não vira número utilizável é o mesmo que não ter", () => {
    // Melhor não ter do que tentar mandar mensagem pra uma sequência de dígitos.
    expect(comTelefone("123").whatsapp).toBeNull();
    expect(comTelefone("não tenho").whatsapp).toBeNull();
  });
});

describe("os outros campos", () => {
  it("nome e e-mail saem pelo mapeamento", () => {
    const lead = lerLeadDaResposta(
      pagina([
        { id: "a", tipo: "texto_curto", mapeamentoCrm: "nome" },
        { id: "b", tipo: "email", mapeamentoCrm: "email" },
      ]),
      { a: "  Ana Souza  ", b: "ana@exemplo.com" },
    );

    expect(lead.nome).toBe("Ana Souza");
    expect(lead.email).toBe("ana@exemplo.com");
  });

  it("dois campos no mesmo mapeamento: vale o primeiro", () => {
    // Dois campos apontando pro mesmo lugar é erro de quem montou o formulário. Trocar o valor no
    // meio do caminho esconderia o erro em vez de deixá-lo aparecer.
    const lead = lerLeadDaResposta(
      pagina([
        { id: "a", tipo: "texto_curto", mapeamentoCrm: "nome" },
        { id: "b", tipo: "texto_curto", mapeamentoCrm: "nome" },
      ]),
      { a: "Primeiro", b: "Segundo" },
    );
    expect(lead.nome).toBe("Primeiro");
  });

  it("formulário com formato estranho não derruba nada", () => {
    // O JSON vem do banco e já mudou de formato antes. Na dúvida, um lead vazio.
    expect(lerLeadDaResposta(null, {}).nome).toBeNull();
    expect(lerLeadDaResposta([{ perguntas: "nada disso" }], {}).reuniao).toBeNull();
    expect(lerLeadDaResposta([{}], {}).consentiu).toBe(false);
  });
});
