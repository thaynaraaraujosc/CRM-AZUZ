import { describe, expect, it } from "vitest";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import {
  comoFunciona,
  etapaDeConfiguracao,
  gatilhosDaArea,
  perguntaDaResposta,
  temEtapaDePalavras,
} from "@/lib/automation-flow/gaveta-de-gatilhos";

describe("gatilhosDaArea", () => {
  it("não oferece gatilho de Instagram no comercial, nem o contrário", () => {
    const comercial = gatilhosDaArea("comercial");
    const todosComerciais = [...comercial.principais, ...comercial.avancados];
    expect(todosComerciais.some((b) => b.grupo === "instagram")).toBe(false);

    const social = gatilhosDaArea("social");
    const todosSociais = [...social.principais, ...social.avancados];
    expect(todosSociais.every((b) => b.grupo === "instagram")).toBe(true);
  });

  it("os principais vêm na ordem escrita, e não repetem no avançado", () => {
    const { principais, avancados } = gatilhosDaArea("comercial");
    expect(principais.map((b) => b.tipo)).toEqual([
      "lead_entrou_etapa",
      "lead_criado",
      "mensagem_recebida",
      "palavra_chave",
      "lead_nao_respondeu",
    ]);
    expect(avancados.some((b) => principais.some((p) => p.tipo === b.tipo))).toBe(false);
  });

  it("todo gatilho da área aparece em algum dos dois lados", () => {
    for (const area of ["comercial", "social"] as const) {
      const { principais, avancados } = gatilhosDaArea(area);
      expect(principais.length + avancados.length).toBeGreaterThan(0);
      // Nenhum some: o avançado é o resto, não um recorte.
      const vistos = new Set([...principais, ...avancados].map((b) => b.tipo));
      expect(vistos.size).toBe(principais.length + avancados.length);
    }
  });
});

describe("etapaDeConfiguracao", () => {
  it("gatilho sem campo nenhum não ganha etapa", () => {
    // `lead_criado` e `instagram_direct_recebido` não escolhem nada: uma etapa pra eles seria
    // uma tela em branco com um botão "Continuar".
    expect(etapaDeConfiguracao("lead_criado")).toBeNull();
    expect(etapaDeConfiguracao("instagram_direct_recebido")).toBeNull();
    expect(etapaDeConfiguracao("lead_respondeu")).toBeNull();
  });

  it("gatilho com campo ganha a etapa do formulário do próprio bloco", () => {
    const etapa = etapaDeConfiguracao("lead_entrou_etapa");
    expect(etapa?.tipo).toBe("formulario");
    expect(etapa?.pergunta).toContain("etapa");
  });

  it("os dois do Instagram que escolhem mídia ganham a etapa de alcance", () => {
    expect(etapaDeConfiguracao("comentario_instagram")?.tipo).toBe("alcance");
    expect(etapaDeConfiguracao("instagram_story_respondido")?.tipo).toBe("alcance");
  });

  /*
   * A REGRA É DERIVADA DO BLOCO, não de uma lista à mão — e este teste é o que prende isso.
   *
   * Uma lista à mão envelhece calada: o gatilho que ganhar um campo amanhã passaria direto pela
   * gaveta, e o campo faltando só apareceria quando o robô não disparasse.
   */
  it("todo gatilho comercial com campo padrão tem etapa, e os sem campo não têm", () => {
    const { principais, avancados } = gatilhosDaArea("comercial");
    for (const bloco of [...principais, ...avancados]) {
      const temCampo = Object.keys((bloco.dataPadrao?.() ?? {}) as object).length > 0;
      expect(Boolean(etapaDeConfiguracao(bloco.tipo))).toBe(temCampo);
    }
  });
});

describe("textos da gaveta", () => {
  it("todo gatilho oferecido tem a frase do 'como funciona'", () => {
    for (const area of ["comercial", "social"] as const) {
      const { principais, avancados } = gatilhosDaArea(area);
      for (const bloco of [...principais, ...avancados]) {
        expect(comoFunciona(bloco.tipo), `faltou a frase de ${bloco.tipo}`).toBeTruthy();
      }
    }
  });

  it("a frase do 'como funciona' mostra o par: o que acontece e o que o robô faz", () => {
    expect(comoFunciona("lead_entrou_etapa")).toContain("→");
  });

  it("a pergunta da resposta segue o primeiro marcado que tenha uma", () => {
    expect(perguntaDaResposta(["lead_entrou_etapa"])).toContain("entrar na etapa");
    // Sem frase própria, cai na genérica em vez de mentir sobre quem é a pessoa.
    expect(perguntaDaResposta(["consulta_cancelada"])).toBe("O que o robô responde");
    // O primeiro da lista manda.
    expect(perguntaDaResposta(["consulta_cancelada", "lead_criado"])).toContain("lead novo");
  });

  it("palavras-chave é etapa do Instagram; no comercial a palavra é um gatilho com campo próprio", () => {
    expect(temEtapaDePalavras("social")).toBe(true);
    expect(temEtapaDePalavras("comercial")).toBe(false);
    expect(etapaDeConfiguracao("palavra_chave")?.tipo).toBe("formulario");
  });

  it("os tipos escritos aqui existem mesmo na biblioteca de blocos", () => {
    // Prende erro de digitação: um tipo que não existe sumiria da lista sem avisar.
    const { principais } = gatilhosDaArea("comercial");
    expect(principais).toHaveLength(5);
    for (const b of principais) {
      expect(BLOCOS_DISPONIVEIS.some((x) => x.tipo === b.tipo)).toBe(true);
    }
  });
});
