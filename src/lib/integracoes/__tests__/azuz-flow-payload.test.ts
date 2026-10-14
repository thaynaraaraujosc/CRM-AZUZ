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
