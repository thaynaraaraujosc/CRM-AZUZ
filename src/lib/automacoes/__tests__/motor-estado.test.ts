import { describe, expect, it } from "vitest";

import type { AguardarData, FlowEdge, MensagemBotoesData } from "@/lib/automation-flow/types";
import { rotuloCurto, textoNumerado } from "@/lib/conversas/enviar-pergunta";
import { categoriaEscolhida, conversaEmTexto } from "../ia";
import { calcularEspera, calcularTempoMaximo, preencher, proximaAresta, saidaDaResposta } from "../motor-estado";

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
    expect(textoNumerado(data.texto, data.opcoes)).toBe("Como posso ajudar?\n\n1 - Quero saber valores\n2 - Falar com atendente");
  });

  it("sem opções, é só o texto", () => {
    expect(textoNumerado(data.texto, [])).toBe("Como posso ajudar?");
  });

  it("entende o rótulo encurtado — é o que o botão do WhatsApp leva", () => {
    // "Quero saber valores" tem 19 caracteres; um rótulo maior é cortado em 20 pela Meta, e o
    // clique volta com o texto cortado. Sem isso, o clique não bateria com nenhuma opção.
    const longa: MensagemBotoesData = {
      ...data,
      opcoes: [{ id: "o1", rotulo: "Quero falar sobre o orçamento agora" }],
    };
    const enviado = rotuloCurto(longa.opcoes[0].rotulo);
    expect(enviado).toBe("Quero falar sobre o…");
    expect(saidaDaResposta(longa, enviado)).toBe("o1");
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

describe("variáveis no texto", () => {
  const contato = {
    nome: "Maria Clara Souza",
    origem: "Instagram",
    camposPersonalizados: { cidade: "Recife" },
  };

  it("troca a variável pelo valor do contato", () => {
    expect(preencher("Oi {{nome}}, tudo bem?", contato)).toBe("Oi Maria Clara Souza, tudo bem?");
  });

  it("entende primeiro_nome", () => {
    expect(preencher("Oi {{primeiro_nome}}!", contato)).toBe("Oi Maria!");
  });

  it("procura também nos campos personalizados", () => {
    expect(preencher("Atendemos {{cidade}}", contato)).toBe("Atendemos Recife");
  });

  it("aceita espaço dentro das chaves", () => {
    expect(preencher("Oi {{ nome }}", contato)).toBe("Oi Maria Clara Souza");
  });

  it("variável sem valor vira vazio — melhor um buraco do que {{chave}} na cara do cliente", () => {
    expect(preencher("Oi {{apelido}}, tudo bem?", contato)).toBe("Oi , tudo bem?");
  });

  it("texto sem variável passa intacto", () => {
    expect(preencher("Bom dia!", contato)).toBe("Bom dia!");
  });
});

describe("categoria escolhida pela IA", () => {
  const categorias = ["dúvida", "orçamento", "reclamação"];

  it("aceita a resposta exata", () => {
    expect(categoriaEscolhida("orçamento", categorias)).toBe("orçamento");
    expect(categoriaEscolhida("  Reclamação \n", categorias)).toBe("reclamação");
  });

  it("aceita a categoria dentro de uma frase — modelo nem sempre responde só a palavra", () => {
    expect(categoriaEscolhida("Parece ser uma dúvida sobre o produto", categorias)).toBe("dúvida");
  });

  it("devolve nada quando não encaixa — o fluxo segue por 'não classificado' em vez de chutar", () => {
    expect(categoriaEscolhida("nenhuma", categorias)).toBeNull();
    expect(categoriaEscolhida("", categorias)).toBeNull();
  });
});

describe("conversa em texto pra IA", () => {
  it("marca quem falou o quê", () => {
    expect(
      conversaEmTexto([
        { tipo: "in", texto: "Quanto custa?" },
        { tipo: "out", texto: "Depende do modelo." },
      ]),
    ).toBe("Cliente: Quanto custa?\nNós: Depende do modelo.");
  });

  it("corta nas últimas trocas — histórico demais só aumenta o custo por mensagem", () => {
    const muitas = Array.from({ length: 30 }, (_, i) => ({ tipo: "in", texto: `msg ${i}` }));
    expect(conversaEmTexto(muitas, 3).split("\n")).toHaveLength(3);
    expect(conversaEmTexto(muitas, 3)).toContain("msg 29");
  });
});

describe("espera em dias úteis", () => {
  // 2026-03-13 é uma sexta-feira.
  const sexta = new Date("2026-03-13T10:00:00.000Z");

  it("dois dias corridos a partir de sexta caem no domingo", () => {
    const r = calcularEspera({ modo: "dias", valor: 2 } as AguardarData, sexta);
    expect(r?.getDay()).toBe(0);
  });

  it("dois dias ÚTEIS a partir de sexta caem na terça — não é o mesmo que empurrar o domingo", () => {
    const r = calcularEspera({ modo: "dias", valor: 2, apenasDiasUteis: true } as AguardarData, sexta);
    expect(r?.getDay()).toBe(2);
  });

  it("com 'não cair em fim de semana', o domingo vira segunda", () => {
    const r = calcularEspera({ modo: "dias", valor: 2, pularFinaisDeSemana: true } as AguardarData, sexta);
    expect(r?.getDay()).toBe(1);
  });

  it("hora e minuto não são afetados pelo fim de semana", () => {
    const r = calcularEspera({ modo: "horas", valor: 3 } as AguardarData, sexta);
    expect(r?.toISOString()).toBe("2026-03-13T13:00:00.000Z");
  });
});
