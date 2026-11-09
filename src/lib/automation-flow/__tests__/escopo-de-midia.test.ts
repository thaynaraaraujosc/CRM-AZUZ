import { describe, expect, it } from "vitest";

import { avaliarGatilho } from "@/lib/automation-flow/avaliacao";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";

/**
 * EM QUAIS PUBLICAÇÕES (E STORIES) A AUTOMAÇÃO VALE.
 *
 * Era uma só ou todas. A tela passou a deixar escolher VÁRIAS e ganhou "Meu próximo post", e os
 * dois casos precisam continuar convivendo com o campo antigo — um fluxo gravado com
 * `publicacaoId` não é migrado, ele simplesmente continua funcionando.
 */
function fluxoDeComentario(data: Record<string, unknown>): FluxoAutomacao {
  return {
    id: "f1",
    nome: "Responde comentário",
    status: "publicado",
    ativa: true,
    versaoAtual: 1,
    nodes: [
      {
        id: "g1",
        type: "comentario_instagram",
        category: "gatilho",
        position: { x: 0, y: 0 },
        data: { canal: "Instagram", palavras: [], ...data },
      },
    ],
    edges: [],
  } as unknown as FluxoAutomacao;
}

const comentarioEm = (publicacaoId?: string) => ({
  tipo: "comentario_instagram" as const,
  contatoNome: "@fulana",
  canal: "instagram",
  mensagem: "quero",
  ...(publicacaoId ? { publicacaoId } : {}),
});

describe("escopo da publicação", () => {
  it("sem nada escolhido, vale pra qualquer publicação", () => {
    const fluxo = fluxoDeComentario({});
    expect(avaliarGatilho(fluxo, comentarioEm("post-1"))).toBe(true);
    expect(avaliarGatilho(fluxo, comentarioEm("post-9"))).toBe(true);
  });

  it("o campo antigo de uma publicação só continua valendo", () => {
    const fluxo = fluxoDeComentario({ publicacaoId: "post-1" });
    expect(avaliarGatilho(fluxo, comentarioEm("post-1"))).toBe(true);
    expect(avaliarGatilho(fluxo, comentarioEm("post-2"))).toBe(false);
  });

  it("vale pras várias publicações escolhidas, e só pra elas", () => {
    const fluxo = fluxoDeComentario({ escopoPublicacao: "especifico", publicacaoIds: ["post-1", "post-3"] });
    expect(avaliarGatilho(fluxo, comentarioEm("post-1"))).toBe(true);
    expect(avaliarGatilho(fluxo, comentarioEm("post-3"))).toBe(true);
    expect(avaliarGatilho(fluxo, comentarioEm("post-2"))).toBe(false);
  });

  it("escolher 'qualquer post' solta de novo, mesmo com ids guardados", () => {
    const fluxo = fluxoDeComentario({ escopoPublicacao: "qualquer", publicacaoIds: ["post-1"] });
    expect(avaliarGatilho(fluxo, comentarioEm("post-2"))).toBe(true);
  });

  it("'meu próximo post' só vale pro que não existia quando foi escolhido", () => {
    const fluxo = fluxoDeComentario({
      escopoPublicacao: "proxima",
      publicacoesConhecidas: ["post-1", "post-2"],
    });
    expect(avaliarGatilho(fluxo, comentarioEm("post-1"))).toBe(false);
    expect(avaliarGatilho(fluxo, comentarioEm("post-2"))).toBe(false);
    expect(avaliarGatilho(fluxo, comentarioEm("post-novo"))).toBe(true);
  });

  it("comentário sem id de publicação não é descartado", () => {
    // A Meta nem sempre manda de qual publicação veio. Tratar a ausência como "não é a minha"
    // faria a automação parar de disparar em silêncio, que é o pior defeito possível aqui.
    const fluxo = fluxoDeComentario({ escopoPublicacao: "especifico", publicacaoIds: ["post-1"] });
    expect(avaliarGatilho(fluxo, comentarioEm())).toBe(true);
  });
});

function fluxoDeStory(data: Record<string, unknown>): FluxoAutomacao {
  return {
    id: "f2",
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
        data: { canal: "Instagram", palavras: [], ...data },
      },
    ],
    edges: [],
  } as unknown as FluxoAutomacao;
}

const respostaA = (storyId?: string) => ({
  tipo: "instagram_story_respondido" as const,
  contatoNome: "@fulana",
  canal: "instagram",
  mensagem: "quero",
  ...(storyId ? { storyId } : {}),
});

describe("escopo do story", () => {
  it("vale pros vários stories escolhidos", () => {
    const fluxo = fluxoDeStory({ storyIds: ["s1", "s2"] });
    expect(avaliarGatilho(fluxo, respostaA("s1"))).toBe(true);
    expect(avaliarGatilho(fluxo, respostaA("s2"))).toBe(true);
    expect(avaliarGatilho(fluxo, respostaA("s3"))).toBe(false);
  });

  it("o campo antigo de um story só continua valendo", () => {
    const fluxo = fluxoDeStory({ storyId: "s1" });
    expect(avaliarGatilho(fluxo, respostaA("s1"))).toBe(true);
    expect(avaliarGatilho(fluxo, respostaA("s2"))).toBe(false);
  });

  it("sem story escolhido, vale pra qualquer um", () => {
    const fluxo = fluxoDeStory({ storyIds: [] });
    expect(avaliarGatilho(fluxo, respostaA("s9"))).toBe(true);
  });
});
