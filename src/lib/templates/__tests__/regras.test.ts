import { describe, expect, it } from "vitest";

import { mapearVariaveis } from "@/lib/campanhas/variaveis";
import { LIMITES, montarComponentesMeta, normalizarNomeMeta, statusDaMeta, validarTemplate } from "../regras";

/**
 * Estes limites são da Meta, não nossos. Se alguém "afrouxar" pra caber um quarto botão, a tela
 * deixa salvar e a Meta recusa o modelo. E a pessoa não vai entender o erro. Os testes fixam
 * os números e o formato que a Graph API espera.
 */
describe("limites por canal", () => {
  it("WhatsApp oficial: 3 botões de 25 caracteres, corpo de 1024, categoria e idioma obrigatórios", () => {
    expect(LIMITES.whatsapp_oficial).toMatchObject({ botoesMaximo: 3, botaoMaximo: 25, corpoMaximo: 1024, exigeCategoria: true, exigeIdioma: true, temAnalise: true });
  });

  it("QR Code e e-mail não têm botão nem análise", () => {
    expect(LIMITES.whatsapp_nao_oficial.botoesMaximo).toBe(0);
    expect(LIMITES.email.botoesMaximo).toBe(0);
    expect(LIMITES.whatsapp_nao_oficial.temAnalise).toBe(false);
    expect(LIMITES.email.exigeAssunto).toBe(true);
  });
});

describe("validação", () => {
  const base = { nome: "Retomar", canal: "whatsapp_oficial" as const, categoria: "MARKETING", idioma: "pt_BR" };

  it("aceita um template completo", () => {
    const corpo = "Olá {{nome}}, podemos continuar seu atendimento?";
    expect(validarTemplate({ ...base, corpo, variaveis: mapearVariaveis(corpo), botoes: [{ texto: "Sim" }, { texto: "Agora não" }] })).toEqual([]);
  });

  it("recusa o quarto botão, botão longo e botões repetidos", () => {
    const problemas = validarTemplate({
      ...base,
      corpo: "Oi",
      botoes: [{ texto: "A" }, { texto: "B" }, { texto: "C" }, { texto: "Um texto que passa de vinte e cinco" }, { texto: "a" }],
    });
    expect(problemas.some((p) => p.includes("máximo 3"))).toBe(true);
    expect(problemas.some((p) => p.includes("passa de 25"))).toBe(true);
    expect(problemas.some((p) => p.includes("mesmo texto"))).toBe(true);
  });

  it("recusa variável não configurada e mensagem que começa com variável no oficial", () => {
    const problemas = validarTemplate({ ...base, corpo: "{{nome}}, oi", variaveis: [] });
    expect(problemas.some((p) => p.includes("{{nome}}"))).toBe(true);
    expect(problemas.some((p) => p.includes("começar nem terminar"))).toBe(true);
  });

  it("no e-mail exige assunto e ignora categoria", () => {
    expect(validarTemplate({ nome: "x", canal: "email", corpo: "Oi" })).toEqual(["E-mail precisa de assunto."]);
  });
});

describe("formato da Meta", () => {
  it("monta BODY numerado com exemplos e BUTTONS de resposta rápida", () => {
    const corpo = "Olá {{nome}}, sobre {{produto}}";
    const variaveis = mapearVariaveis(corpo).map((v) => (v.chave === "produto" ? { ...v, valor: "Plano X" } : v));
    const componentes = montarComponentesMeta({ nome: "x", canal: "whatsapp_oficial", corpo, variaveis, botoes: [{ texto: "Sim" }] });
    expect(componentes[0]).toEqual({ type: "BODY", text: "Olá {{1}}, sobre {{2}}", example: { body_text: [["Maria", "Plano X"]] } });
    expect(componentes[1]).toEqual({ type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Sim" }] });
  });

  it("nome vira o formato da Meta e status volta no vocabulário do CRM", () => {
    expect(normalizarNomeMeta("Retomar Atendimento: Março!")).toBe("retomar_atendimento_marco");
    expect(statusDaMeta("APPROVED")).toBe("aprovado");
    expect(statusDaMeta("REJECTED")).toBe("rejeitado");
    expect(statusDaMeta("PENDING")).toBe("em_analise");
  });
});
