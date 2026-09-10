import { describe, expect, it } from "vitest";

import { avaliarGatilho } from "@/lib/automation-flow/avaliacao";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";

/**
 * A automação de story pode valer pra qualquer story ou só pro que foi escolhido.
 *
 * O caso que exige cuidado é o do meio: a Meta nem sempre manda o id do story respondido. Tratar
 * essa ausência como "não é o meu story" faria a automação parar de disparar em silêncio, que é o
 * pior defeito possível aqui: ninguém percebe até o lead reclamar que não recebeu.
 */
function fluxoDeStory(storyId: string): FluxoAutomacao {
  return {
    id: "f1",
    nome: "Responde story",
    status: "publicado",
    ativa: true,
    versaoAtual: 1,
    nodes: [
      {
        id: "g1",
        type: "instagram_story_respondido",
        category: "gatilho",
        position: { x: 0, y: 0 },
        data: { canal: "Instagram", palavras: [], storyId },
      },
    ],
    edges: [],
  } as unknown as FluxoAutomacao;
}

const evento = (storyId?: string) => ({
  tipo: "instagram_story_respondido" as const,
  contatoNome: "@fulana",
  canal: "instagram",
  mensagem: "quero",
  ...(storyId ? { storyId } : {}),
});

describe("gatilho de resposta a story", () => {
  it("sem story escolhido, vale pra qualquer story", () => {
    const fluxo = fluxoDeStory("");
    expect(avaliarGatilho(fluxo, evento("story-de-hoje"))).toBe(true);
    expect(avaliarGatilho(fluxo, evento("story-de-ontem"))).toBe(true);
    expect(avaliarGatilho(fluxo, evento())).toBe(true);
  });

  it("com story escolhido, só dispara naquele story", () => {
    const fluxo = fluxoDeStory("story-escolhido");
    expect(avaliarGatilho(fluxo, evento("story-escolhido"))).toBe(true);
    expect(avaliarGatilho(fluxo, evento("outro-story"))).toBe(false);
  });

  it("quando a Meta não manda o id do story, a automação roda em vez de morrer calada", () => {
    expect(avaliarGatilho(fluxoDeStory("story-escolhido"), evento())).toBe(true);
  });
});
