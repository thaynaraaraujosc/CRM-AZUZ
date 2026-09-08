import { describe, expect, it } from "vitest";

import type { AguardarData, FlowEdge, MensagemBotoesData } from "@/lib/automation-flow/types";
import { calcularEspera, calcularTempoMaximo, montarPergunta, proximaAresta, saidaDaResposta } from "../motor-estado";

const aresta = (id: string, source: string, target: string, sourceHandle?: string): FlowEdge =>
  ({ id, source, target, ...(sourceHandle ? { sourceHandle } : {}) }) as FlowEdge;

describe("escolha da saída", () => {
  it("com uma saída só, é ela", () => {
    const edges = [aresta("e1", "a", "b")];
    expect(proximaAresta(edges, "a")?.target).toBe("b");
  });

  it("segue o ramo pedido quando o nó tem vários", () => {
    const edges = [aresta("e1", "a", "sim", "sim"), aresta("e2", "a", "nao", "nao")];
    expect(proximaAresta(edges, "a", "sim")?.target).toBe("sim");
    expect(proximaAresta(edges, "a", "nao")?.target).toBe("nao");
  });

  it("não escolhe nada quando o ramo pedido não existe — mandar a pessoa pro lado errado é pior que parar", () => {
    const edges = [aresta("e1", "a", "sim", "sim")];
    expect(proximaAresta(edges, "a", "nao")).toBeUndefined();
  });

  it("sem saída nenhuma devolve nada (fim natural do caminho)", () => {
    expect(proximaAresta([aresta("e1", "outro", "b")], "a")).toBeUndefined();
  });
});

describe("cálculo da espera", () => {
  const agora = new Date("2026-03-10T12:00:00.000Z");

  it("converte minutos, horas e dias", () => {
    expect(calcularEspera({ modo: "minutos", valor: 30 } as AguardarData, agora)?.toISOString()).toBe("2026-03-10T12:30:00.000Z");
    expect(calcularEspera({ modo: "horas", valor: 2 } as AguardarData, agora)?.toISOString()).toBe("2026-03-10T14:00:00.000Z");
    expect(calcularEspera({ modo: "dias", valor: 1 } as AguardarData, agora)?.toISOString()).toBe("2026-03-11T12:00:00.000Z");
  });

  it("devolve nada nos modos que não são duração — quem chama trata como configuração faltando", () => {
    expect(calcularEspera({ modo: "ate_resposta" } as AguardarData, agora)).toBeNull();
    expect(calcularEspera({ modo: "ate_data" } as AguardarData, agora)).toBeNull();
  });

  it("o prazo máximo só existe quando foi configurado", () => {
    expect(calcularTempoMaximo({ modo: "ate_resposta" } as AguardarData, agora)).toBeNull();
    const com = { modo: "ate_resposta", tempoMaximo: { valor: 2, unidade: "horas" } } as AguardarData;
    expect(calcularTempoMaximo(com, agora)?.toISOString()).toBe("2026-03-10T14:00:00.000Z");
  });
});

describe("pergunta com opções", () => {
  const data: MensagemBotoesData = {
    canal: "whatsapp" as MensagemBotoesData["canal"],
    texto: "Como posso ajudar?",
    opcoes: [
      { id: "o1", rotulo: "Quero saber valores", respostasAlternativas: ["orçamento", "preço"] },
      { id: "o2", rotulo: "Falar com atendente" },
    ],
  };

  it("numera as opções pro canal que não tem botão", () => {
    expect(montarPergunta(data)).toBe("Como posso ajudar?\n\n1 - Quero saber valores\n2 - Falar com atendente");
  });

  it("sem opções, é só o texto", () => {
    expect(montarPergunta({ ...data, opcoes: [] })).toBe("Como posso ajudar?");
  });

  it("entende o número", () => {
    expect(saidaDaResposta(data, "2")).toBe("o2");
    expect(saidaDaResposta(data, " 1 ")).toBe("o1");
  });

  it("entende o texto do botão — é assim que o clique chega", () => {
    expect(saidaDaResposta(data, "Falar com atendente")).toBe("o2");
    expect(saidaDaResposta(data, "quero saber valores")).toBe("o1");
  });

  it("entende as respostas alternativas que o fluxo listou", () => {
    expect(saidaDaResposta(data, "Orçamento")).toBe("o1");
  });

  it("entende a frase que contém a opção", () => {
    expect(saidaDaResposta(data, "acho que quero saber valores mesmo")).toBe("o1");
  });

  it("número fora da lista não vira opção", () => {
    expect(saidaDaResposta(data, "7")).toBeNull();
  });

  it("resposta que não bate com nada devolve nada — quem chama decide se espera mais", () => {
    expect(saidaDaResposta(data, "bom dia")).toBeNull();
    expect(saidaDaResposta(data, "   ")).toBeNull();
  });
});
