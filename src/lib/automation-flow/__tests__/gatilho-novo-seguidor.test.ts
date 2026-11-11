import { describe, expect, it } from "vitest";

import { avaliarGatilho } from "@/lib/automation-flow/avaliacao";
import { gatilhoTemTexto } from "@/lib/automation-flow/gatilhos-do-fluxo";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";

/**
 * "SE COMEÇOU A SEGUIR, NÃO PRECISA TER PALAVRA-CHAVE."
 *
 * Seguir não é escrever: o evento não traz texto nenhum. Rodar o filtro de palavra mesmo assim
 * compararia a palavra com uma string vazia e nunca casaria — e o gatilho ficaria eternamente
 * parado numa automação que tem palavras configuradas pros OUTROS gatilhos. Sem erro, sem aviso,
 * sem nada que explicasse.
 */
function fluxoDeSeguidor(data: Record<string, unknown>): FluxoAutomacao {
  return {
    id: "f1",
    nome: "Boas-vindas",
    status: "publicado",
    ativa: true,
    versaoAtual: 1,
    nodes: [
      {
        id: "g1",
        type: "instagram_novo_seguidor",
        category: "gatilho",
        position: { x: 0, y: 0 },
        data: { canal: "Instagram", ...data },
      },
    ],
    edges: [],
  } as unknown as FluxoAutomacao;
}

const seguiu = {
  tipo: "instagram_novo_seguidor" as const,
  contatoNome: "@fulana",
  canal: "instagram",
  mensagem: "",
};

describe("gatilhoTemTexto", () => {
  it("comentário e Direct trazem texto", () => {
    expect(gatilhoTemTexto("comentario_instagram")).toBe(true);
    expect(gatilhoTemTexto("instagram_direct_recebido")).toBe(true);
  });

  it("novo seguidor não traz", () => {
    expect(gatilhoTemTexto("instagram_novo_seguidor")).toBe(false);
  });
});

describe("novo seguidor dispara sem depender de palavra", () => {
  it("sem palavra configurada, dispara", () => {
    expect(avaliarGatilho(fluxoDeSeguidor({ palavras: [] }), seguiu)).toBe(true);
  });

  /* O caso que importa: a automação tem palavras pros outros gatilhos, e o de seguidor não pode
     ser calado por elas. */
  it("COM palavra configurada, continua disparando", () => {
    expect(avaliarGatilho(fluxoDeSeguidor({ palavras: ["AZUZ"], modoPalavra: "exata" }), seguiu)).toBe(true);
  });

  /* E a palavra continua valendo onde há texto: o comentário segue filtrado como sempre. */
  it("no comentário a palavra continua filtrando", () => {
    const fluxo = {
      ...fluxoDeSeguidor({}),
      nodes: [
        {
          id: "g1",
          type: "comentario_instagram",
          category: "gatilho",
          position: { x: 0, y: 0 },
          data: { canal: "Instagram", palavras: ["AZUZ"], modoPalavra: "exata" },
        },
      ],
    } as unknown as FluxoAutomacao;
    const comentario = { tipo: "comentario_instagram" as const, contatoNome: "@f", canal: "instagram", mensagem: "azuz" };
    expect(avaliarGatilho(fluxo, comentario)).toBe(true);
    expect(avaliarGatilho(fluxo, { ...comentario, mensagem: "quero azuz" })).toBe(false);
  });
});
