import { describe, expect, it } from "vitest";

import type { FluxoAutomacao, FlowEdge, FlowNode } from "../types";
import { validarFluxo } from "../validacao";

/**
 * O robô criado por "Automatizar funil" não tem bloco de gatilho no canvas: quem dispara é a etapa
 * do funil. O motor sabe disso desde sempre (`primeiroNoDepoisDoGatilho`, em
 * `src/lib/automacoes/iniciar.ts`: sem bloco de gatilho, começa pelo único nó em que ninguém
 * entra). A validação não sabia, e cobrava um bloco de gatilho que aquele caminho nunca teria.
 *
 * O efeito era que o caminho principal do produto gerava robôs impossíveis de publicar. Estes
 * testes prendem as duas metades: o caso legítimo publica, e o caso que o motor não sabe executar
 * (mais de uma entrada) continua sendo erro.
 */
function no(id: string, category: FlowNode["category"], type: string): FlowNode {
  return { id, type, category, position: { x: 0, y: 0 }, data: {} } as FlowNode;
}

function aresta(source: string, target: string): FlowEdge {
  return { id: `${source}-${target}`, source, target } as FlowEdge;
}

function fluxo(parcial: Partial<FluxoAutomacao>): FluxoAutomacao {
  return { nodes: [], edges: [], ...parcial } as FluxoAutomacao;
}

const erros = (f: FluxoAutomacao, contexto?: Parameters<typeof validarFluxo>[1]) =>
  validarFluxo(f, contexto).filter((p) => p.severidade === "erro");

describe("validação de robô cujo gatilho está na etapa do funil", () => {
  it("publica sem bloco de gatilho quando há uma entrada só", () => {
    const f = fluxo({
      funilId: "funil-principal",
      etapaId: "proposta",
      nodes: [no("a", "mensagem", "mensagem_texto"), no("z", "fim", "encerrar_fluxo")],
      edges: [aresta("a", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    expect(erros(f).map((p) => p.mensagem)).toEqual([]);
  });

  it("recusa quando há mais de um ponto de partida, que é o que o motor não sabe executar", () => {
    const f = fluxo({
      funilId: "funil-principal",
      etapaId: "proposta",
      nodes: [
        no("a", "mensagem", "mensagem_texto"),
        no("b", "mensagem", "mensagem_texto"),
        no("z", "fim", "encerrar_fluxo"),
      ],
      edges: [aresta("a", "z"), aresta("b", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };
    (f.nodes[1] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    expect(erros(f).some((p) => p.mensagem.includes("pontos de partida"))).toBe(true);
  });

  it("continua cobrando bloco de gatilho quando a etapa não dispara o robô", () => {
    const f = fluxo({
      nodes: [no("a", "mensagem", "mensagem_texto"), no("z", "fim", "encerrar_fluxo")],
      edges: [aresta("a", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    expect(erros(f).some((p) => p.mensagem.includes("Nada dispara esta automação"))).toBe(true);
  });

  /*
   * A ETAPA QUE EXECUTA O ROBÔ, VINDA DA TABELA DE GATILHOS.
   *
   * "Tô tentando fazer uma automação simples, que é mandar uma mensagem quando o lead entra na
   * etapa, e tá falando que nada dispara essa automação — sendo que quando eu vou criar o gatilho
   * eu já falo quando que é pra executar."
   *
   * O robô criado pelo funil nasce sem bloco de gatilho E sem `funilId`/`etapaId` preenchidos: a
   * ligação mora só em `GatilhoEtapa.fluxoId`. Com as duas colunas vazias, a validação antiga
   * concluía que nada disparava um robô que estava ligado e configurado.
   */
  it("aceita o robô que uma etapa do funil manda executar, mesmo sem funilId no fluxo", () => {
    const f = fluxo({
      nodes: [no("a", "mensagem", "mensagem_texto"), no("z", "fim", "encerrar_fluxo")],
      edges: [aresta("a", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    expect(erros(f, { gatilhosDeEtapa: 1 }).map((p) => p.mensagem)).toEqual([]);
  });

  it("nenhuma etapa executando: a pendência volta, e diz os dois caminhos", () => {
    const f = fluxo({
      nodes: [no("a", "mensagem", "mensagem_texto"), no("z", "fim", "encerrar_fluxo")],
      edges: [aresta("a", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    const mensagens = erros(f, { gatilhosDeEtapa: 0 }).map((p) => p.mensagem);
    expect(mensagens.some((m) => m.includes("Nada dispara esta automação"))).toBe(true);
    // Diz que dá pra resolver pelo funil, não só adicionando bloco: era o empurrão pro caminho
    // errado que a frase antiga dava.
    expect(mensagens.some((m) => m.includes("Automatizar"))).toBe(true);
  });

  it("sem resposta da busca, a reserva antiga continua valendo", () => {
    const f = fluxo({
      funilId: "funil-principal",
      etapaId: "proposta",
      nodes: [no("a", "mensagem", "mensagem_texto"), no("z", "fim", "encerrar_fluxo")],
      edges: [aresta("a", "z")],
    });
    (f.nodes[0] as FlowNode).data = { canal: "whatsapp", texto: "Oi" };

    // `gatilhosDeEtapa` ausente = ainda não se sabe. Robô antigo, com as colunas preenchidas,
    // não pode passar a acusar pendência só porque a busca não voltou.
    expect(erros(f, {}).map((p) => p.mensagem)).toEqual([]);
    // E zero vindo da busca não apaga a reserva: o robô antigo segue válido.
    expect(erros(f, { gatilhosDeEtapa: 0 }).map((p) => p.mensagem)).toEqual([]);
  });
});
