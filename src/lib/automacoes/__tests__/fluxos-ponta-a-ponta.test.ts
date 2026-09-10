import { describe, expect, it } from "vitest";

import { simularContinuacao, simularInicio, type EstadoSimulacao } from "@/lib/automacoes/simular";
import type { FlowEdge, FlowNode } from "@/lib/automation-flow/types";

/**
 * Automações INTEIRAS, rodando no motor de verdade.
 *
 * Isto não é um teste de unidade de uma função: é o mesmo `rodarExecucao` que roda em produção,
 * com as mesmas decisões, o mesmo avanço de nó e o mesmo tratamento de espera. As duas únicas
 * coisas trocadas são as bordas do sistema, e são trocadas exatamente onde o produto já as
 * separou pro botão "Testar": as AÇÕES viram secas (nada é enviado) e o GRAVADOR vira de memória
 * (nada entra no banco).
 *
 * POR QUE ISTO EXISTE: uma automação de follow-up ("mensagem, esperar, mensagem") não entregou a
 * segunda mensagem em produção, e não havia como saber se o defeito era do motor ou do envio.
 * Sem estes testes, a resposta seria dedução. Com eles, o motor passa a ter prova: o que falha
 * aqui é bug de motor; o que passa aqui e falha lá é bug de borda (canal, janela, credencial).
 */

const CONTATO: Record<string, unknown> = { nome: "Maria", etiquetas: [] as string[], canal: "WhatsApp" };

function no(id: string, type: string, category: string, data: Record<string, unknown> = {}): FlowNode {
  return { id, type, category, position: { x: 0, y: 0 }, data } as unknown as FlowNode;
}

function liga(de: string, para: string, saida?: string): FlowEdge {
  return { id: `${de}->${para}${saida ? `:${saida}` : ""}`, source: de, target: para, ...(saida ? { sourceHandle: saida } : {}) } as unknown as FlowEdge;
}

function rodar(nodes: FlowNode[], edges: FlowEdge[], contato: Record<string, unknown> = CONTATO) {
  return simularInicio({ workspaceId: "w1", fluxoId: "f1", nodes, edges, contato });
}

/** O que o motor DIRIA que faria: a lista de intenções das ações secas. */
function intencoes(estado: EstadoSimulacao): string {
  return estado.intencoes.join(" | ");
}

describe("follow-up: mensagem, esperar, mensagem", () => {
  /*
   * O caso exato que falhou em produção. Se o motor não chegar na segunda mensagem AQUI, o defeito
   * é dele. Se chegar, o defeito está na borda: o canal recusou o envio.
   */
  const nodes = [
    no("g", "lead_entrou_etapa", "gatilho", { canal: "WhatsApp" }),
    no("m1", "mensagem_texto", "mensagem", { texto: "Oi! Vi seu interesse.", canal: "whatsapp" }),
    no("esp", "aguardar", "espera", { modo: "minutos", valor: 5 }),
    no("m2", "mensagem_texto", "mensagem", { texto: "Ainda posso ajudar?", canal: "whatsapp" }),
  ];
  const edges = [liga("g", "m1"), liga("m1", "esp"), liga("esp", "m2")];

  it("manda a primeira mensagem e PARA na espera, sem seguir adiante sozinho", async () => {
    const estado = await rodar(nodes, edges);
    expect(intencoes(estado)).toContain("Oi! Vi seu interesse");
    expect(intencoes(estado)).not.toContain("Ainda posso ajudar");
    expect(estado.situacao).toBe("aguardando_tempo");
  });

  it("a espera guarda ATÉ QUANDO, que é o que o cron usa pra acordar", async () => {
    const estado = await rodar(nodes, edges);
    expect(estado.execucao.aguardandoAte).toBeInstanceOf(Date);
    expect(estado.execucao.aguardandoAte!.getTime()).toBeGreaterThan(Date.now());
    // Cinco minutos, com folga de um minuto pro tempo que o teste leva.
    const minutos = (estado.execucao.aguardandoAte!.getTime() - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(4);
    expect(minutos).toBeLessThan(6);
  });

  it("acordada, entrega a segunda mensagem e conclui", async () => {
    const parada = await rodar(nodes, edges);
    const fim = await simularContinuacao({ estado: parada, nodes, edges });
    expect(intencoes(fim)).toContain("Ainda posso ajudar");
    expect(fim.situacao).toBe("concluida");
  });
});

describe("condição depois da espera: respondeu ou não", () => {
  const nodes = [
    no("g", "lead_entrou_etapa", "gatilho", {}),
    no("m1", "mensagem_texto", "mensagem", { texto: "Bom dia!" }),
    no("esp", "aguardar", "espera", { modo: "minutos", valor: 1 }),
    no("cond", "condicao_grupo", "condicao", {
      grupo: { id: "g1", tipo: "E", regras: [{ id: "r1", campo: "respondeu", operador: "igual", valor: "sim" }], subgrupos: [] },
    }),
    no("sim", "adicionar_etiqueta", "acao", { etiqueta: "respondeu_teste" }),
    no("nao", "mensagem_texto", "mensagem", { texto: "Ainda por aí?" }),
  ];
  const edges = [
    liga("g", "m1"),
    liga("m1", "esp"),
    liga("esp", "cond"),
    liga("cond", "sim", "sim"),
    liga("cond", "nao", "nao"),
  ];

  it("quem NÃO respondeu recebe o follow-up", async () => {
    const parada = await rodar(nodes, edges, { ...CONTATO, ultimaRespostaEm: null });
    const fim = await simularContinuacao({ estado: parada, nodes, edges });
    expect(intencoes(fim)).toContain("Ainda por aí");
  });

  it("quem respondeu é etiquetado em vez de receber cobrança", async () => {
    const parada = await rodar(nodes, edges, { ...CONTATO, ultimaRespostaEm: new Date().toISOString() });
    const fim = await simularContinuacao({ estado: parada, nodes, edges });
    expect(intencoes(fim)).not.toContain("Ainda por aí");
    expect(intencoes(fim).toLowerCase()).toContain("etiqueta");
  });
});

describe("pergunta com opções: cada resposta vai pro seu caminho", () => {
  const nodes = [
    no("g", "mensagem_recebida", "gatilho", {}),
    no("perg", "mensagem_botoes", "mensagem", {
      texto: "Sobre o que quer falar?",
      opcoes: [
        { id: "comprar", rotulo: "Quero comprar" },
        { id: "suporte", rotulo: "Já sou cliente" },
      ],
    }),
    no("v", "mensagem_texto", "mensagem", { texto: "Vou te passar os valores." }),
    no("s", "mensagem_texto", "mensagem", { texto: "Chamando o suporte." }),
  ];
  const edges = [liga("g", "perg"), liga("perg", "v", "comprar"), liga("perg", "s", "suporte")];

  it("para e espera a resposta em vez de seguir os dois caminhos", async () => {
    const estado = await rodar(nodes, edges);
    expect(estado.situacao).toBe("aguardando_evento");
    expect(intencoes(estado)).not.toContain("valores");
    expect(intencoes(estado)).not.toContain("suporte");
  });

  it('"Quero comprar" leva pro caminho de venda, e só ele', async () => {
    const parada = await rodar(nodes, edges);
    const fim = await simularContinuacao({ estado: parada, nodes, edges, resposta: "Quero comprar" });
    expect(intencoes(fim)).toContain("valores");
    expect(intencoes(fim)).not.toContain("Chamando o suporte");
  });

  it('"Já sou cliente" leva pro suporte', async () => {
    const parada = await rodar(nodes, edges);
    const fim = await simularContinuacao({ estado: parada, nodes, edges, resposta: "Já sou cliente" });
    expect(intencoes(fim)).toContain("Chamando o suporte");
  });
});

describe("encerrar fluxo", () => {
  it("o que vem depois do encerramento não roda", async () => {
    const nodes = [
      no("g", "lead_criado", "gatilho", {}),
      no("m1", "mensagem_texto", "mensagem", { texto: "Bem-vindo!" }),
      no("fim", "encerrar_fluxo", "fim", { motivo: "Acabou" }),
      no("m2", "mensagem_texto", "mensagem", { texto: "Isto NÃO deveria sair." }),
    ];
    const edges = [liga("g", "m1"), liga("m1", "fim"), liga("fim", "m2")];
    const estado = await rodar(nodes, edges);
    expect(intencoes(estado)).toContain("Bem-vindo");
    expect(intencoes(estado)).not.toContain("NÃO deveria sair");
    expect(estado.situacao).toBe("concluida");
  });
});

describe("caminhos sem saída", () => {
  it("bloco sem próximo passo conclui em vez de travar", async () => {
    const nodes = [
      no("g", "lead_criado", "gatilho", {}),
      no("m1", "mensagem_texto", "mensagem", { texto: "Só isso." }),
    ];
    const estado = await rodar(nodes, [liga("g", "m1")]);
    expect(estado.situacao).toBe("concluida");
  });

  /*
   * Espera sem número configurado NÃO é erro: `valor ?? 0` faz dela uma espera de zero, que o cron
   * retoma na batida seguinte. Documentado aqui porque é uma decisão silenciosa e alguém vai
   * tropeçar nela: o fluxo não trava e não explode, ele só continua até um minuto depois.
   */
  it("espera sem número configurado vira espera de zero, e o fluxo continua na batida seguinte", async () => {
    const nodes = [
      no("g", "lead_criado", "gatilho", {}),
      no("esp", "aguardar", "espera", { modo: "minutos" }),
      no("m", "mensagem_texto", "mensagem", { texto: "depois" }),
    ];
    const edges = [liga("g", "esp"), liga("esp", "m")];
    const parada = await rodar(nodes, edges);
    expect(parada.situacao).toBe("aguardando_tempo");
    expect(intencoes(parada)).not.toContain("depois");

    const fim = await simularContinuacao({ estado: parada, nodes, edges });
    expect(intencoes(fim)).toContain("depois");
    expect(fim.situacao).toBe("concluida");
  });
});
