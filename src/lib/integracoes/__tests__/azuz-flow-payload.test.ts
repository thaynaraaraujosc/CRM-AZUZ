import { describe, expect, it } from "vitest";

import { LIMITES, validarPayloadDoFlow } from "../azuz-flow-payload";

/** O mínimo que o contrato exige, pra cada teste mexer só no que interessa a ele. */
function payload(extra: Record<string, unknown> = {}) {
  return {
    versao: 1,
    origem: {
      produto: "azuz-flow",
      formularioId: "form-1",
      formularioNome: "Diagnóstico gratuito",
      respostaId: "resp-1",
      recebidaEm: "2026-10-14T13:00:00.000Z",
    },
    lead: { nome: "Ana", sobrenome: "Souza", email: "ANA@Exemplo.com", whatsapp: "5562996340438" },
    respostas: [{ pergunta: "Qual seu faturamento?", resposta: "Até 50 mil" }],
    consentimento: { whatsapp: { aceitou: true, texto: "Aceito receber mensagens", em: null } },
    ...extra,
  };
}

describe("validarPayloadDoFlow", () => {
  it("aceita o payload do contrato e normaliza o que precisa", () => {
    const r = validarPayloadDoFlow(payload());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.nomeDoContato).toBe("Ana Souza");
    // E-mail em minúsculas: é por ele que o contato é reencontrado, e "ANA@" e "ana@" são a mesma
    // pessoa.
    expect(r.lead.email).toBe("ana@exemplo.com");
    expect(r.lead.whatsapp).toBe("5562996340438");
    expect(r.lead.consentimentoWhatsApp).toBe(true);
    expect(r.lead.avisos).toEqual([]);
  });

  it("recusa o lead que não traz nome, e-mail nem WhatsApp", () => {
    const r = validarPayloadDoFlow(payload({ lead: { nome: null, email: null, whatsapp: null } }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("não traz nome");
  });

  it("exige o consentimento como booleano, porque gravar o que a pessoa não disse é pior que recusar", () => {
    expect(validarPayloadDoFlow(payload({ consentimento: {} })).ok).toBe(false);
    // String "false" é erro de quem integra. Aceitar como verdadeiro gravaria consentimento falso.
    const comString = validarPayloadDoFlow(payload({ consentimento: { whatsapp: { aceitou: "false" } } }));
    expect(comString.ok).toBe(false);
  });

  it("número inválido não recusa o lead: vira 'sem WhatsApp' com aviso", () => {
    const r = validarPayloadDoFlow(payload({ lead: { nome: "Ana", whatsapp: "123" } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.whatsapp).toBeNull();
    expect(r.lead.avisos.join(" ")).toContain("não parece um número válido");
  });

  it("corta texto comprido em vez de recusar: o lead chega uma vez só", () => {
    const r = validarPayloadDoFlow(
      payload({ lead: { nome: "A".repeat(500), cargo: "C".repeat(500) } }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.nome).toHaveLength(LIMITES.nome);
    expect(r.lead.cargo).toHaveLength(LIMITES.campo);
  });

  it("tira caractere de controle, que quebra comparação em banco e vira linha fantasma na bolha", () => {
    const r = validarPayloadDoFlow(payload({ lead: { nome: "Ana\u0000\r\nSouza" } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.nome).toBe("Ana Souza");
  });

  it("guarda só as primeiras respostas e avisa quando sobrou", () => {
    const muitas = Array.from({ length: LIMITES.respostas + 5 }, (_, i) => ({
      pergunta: `P${i}`,
      resposta: `R${i}`,
    }));
    const r = validarPayloadDoFlow(payload({ respostas: muitas }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.respostas).toHaveLength(LIMITES.respostas);
    expect(r.lead.avisos.join(" ")).toContain("guardamos as");
  });

  it("monta o nome pelo e-mail e, na falta dele, pelos 4 últimos dígitos", () => {
    const porEmail = validarPayloadDoFlow(payload({ lead: { email: "joao.silva@exemplo.com" } }));
    expect(porEmail.ok && porEmail.lead.nomeDoContato).toBe("joao.silva");

    const porTelefone = validarPayloadDoFlow(payload({ lead: { whatsapp: "5562996340438" } }));
    expect(porTelefone.ok && porTelefone.lead.nomeDoContato).toBe("Lead 0438");
  });

  it("recusa corpo que não é objeto e entrega sem identificador", () => {
    expect(validarPayloadDoFlow(null).ok).toBe(false);
    expect(validarPayloadDoFlow([]).ok).toBe(false);
    expect(validarPayloadDoFlow(payload({ origem: { formularioNome: "X" } })).ok).toBe(false);
  });
});

/**
 * O campo `reuniao` é opcional, e o que não dá pra ler dele NÃO custa o lead.
 *
 * Um lead chega uma vez. Recusar a entrega inteira porque o horário veio num formato estranho perde
 * o nome e o WhatsApp de uma pessoa de verdade por causa de um campo que o vendedor consegue
 * preencher na mão depois.
 */
describe("a reunião no pedido", () => {
  const base = {
    origem: { formularioId: "f1", formularioNome: "Diagnóstico", respostaId: "resp-1" },
    lead: { nome: "Ana", whatsapp: "5562996340438" },
    respostas: [],
    consentimento: { whatsapp: { aceitou: true, texto: null, em: null } },
  };

  function validar(reuniao: unknown) {
    const r = validarPayloadDoFlow({ ...base, reuniao });
    if (!r.ok) throw new Error(`esperava lead válido, veio: ${r.erro}`);
    return r.lead;
  }

  it("lê início, fim e link", () => {
    const lead = validar({
      inicio: "2026-10-20T17:00:00.000Z",
      fim: "2026-10-20T17:30:00.000Z",
      link: "https://meet.google.com/abc-defg-hij",
    });
    expect(lead.reuniao?.inicio.toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(lead.reuniao?.fim?.toISOString()).toBe("2026-10-20T17:30:00.000Z");
    expect(lead.reuniao?.link).toBe("https://meet.google.com/abc-defg-hij");
    expect(lead.avisos).toEqual([]);
  });

  it("sem o campo, o lead entra sem reunião e sem aviso", () => {
    const r = validarPayloadDoFlow(base);
    expect(r.ok && r.lead.reuniao).toBeNull();
    expect(r.ok && r.lead.avisos).toEqual([]);
  });

  it("fim e link podem vir nulos", () => {
    const lead = validar({ inicio: "2026-10-20T17:00:00.000Z", fim: null, link: null });
    expect(lead.reuniao?.fim).toBeNull();
    expect(lead.reuniao?.link).toBeNull();
    expect(lead.avisos).toEqual([]);
  });

  it("data ilegível não derruba o lead: vira aviso", () => {
    const lead = validar({ inicio: "amanhã às 14h" });
    expect(lead.reuniao).toBeNull();
    expect(lead.nomeDoContato).toBe("Ana");
    expect(lead.avisos.join(" ")).toContain("não pôde ser lida");
  });

  it("link que não é http(s) é descartado, e a reunião fica", () => {
    // Aceitar `javascript:` aqui plantaria, pelo que um formulário de fora manda, um link que o
    // navegador executa — e o `local` do compromisso aparece na tela.
    const lead = validar({ inicio: "2026-10-20T17:00:00.000Z", link: "javascript:alert(1)" });
    expect(lead.reuniao?.link).toBeNull();
    expect(lead.reuniao?.inicio).toBeInstanceOf(Date);
    expect(lead.avisos.join(" ")).toContain("http(s)");
  });

  it("fim antes do início perde só o fim", () => {
    const lead = validar({ inicio: "2026-10-20T17:00:00.000Z", fim: "2026-10-20T16:00:00.000Z" });
    expect(lead.reuniao?.fim).toBeNull();
    expect(lead.reuniao?.inicio).toBeInstanceOf(Date);
    expect(lead.avisos.join(" ")).toContain("término");
  });

  it("campo que não é objeto vira aviso", () => {
    const lead = validar("2026-10-20T17:00:00.000Z");
    expect(lead.reuniao).toBeNull();
    expect(lead.avisos.join(" ")).toContain("não era um objeto");
  });
});
