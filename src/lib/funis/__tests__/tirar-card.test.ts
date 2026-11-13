import { describe, expect, it } from "vitest";

import { tirarCardPorId, tirarCardsDoContato } from "@/lib/funis/tirar-card";
import type { Funil, NegocioCard } from "@/lib/data";

function card(id: string, nome: string): NegocioCard {
  return { id, nome, valor: "R$ 0", origem: "WhatsApp", dias: "1d", data: "" } as NegocioCard;
}

function quadro(): Funil[] {
  return [
    {
      id: "f1",
      nome: "Vendas",
      colunas: [
        { id: "e1", titulo: "Novo", total: 2, cards: [card("c1", "Ana Paula"), card("c2", "Bruno")] },
        { id: "e2", titulo: "Proposta", total: 1, cards: [card("c3", "Ana Paula")] },
      ],
    },
    {
      id: "f2",
      nome: "Pós-venda",
      colunas: [{ id: "e3", titulo: "Entrega", total: 1, cards: [card("c4", "ana  paula")] }],
    },
  ];
}

describe("tirarCardPorId", () => {
  it("tira só aquele card e acerta o total da coluna", () => {
    const depois = tirarCardPorId(quadro(), "c1");
    expect(depois[0]!.colunas[0]!.cards.map((c) => c.id)).toEqual(["c2"]);
    expect(depois[0]!.colunas[0]!.total).toBe(1);
  });

  it("não encosta nas outras colunas nem nos outros funis", () => {
    const antes = quadro();
    const depois = tirarCardPorId(antes, "c1");
    // Mesmo objeto: é o que permite ao React não redesenhar o que não mudou.
    expect(depois[0]!.colunas[1]).toBe(antes[0]!.colunas[1]);
    expect(depois[1]).toBe(antes[1]);
  });

  it("id que não existe devolve o mesmo quadro, sem copiar nada", () => {
    const antes = quadro();
    expect(tirarCardPorId(antes, "c99")).toBe(antes);
    expect(tirarCardPorId(antes, "")).toBe(antes);
  });

  it("não tira card de outra pessoa que esteja na mesma coluna", () => {
    const depois = tirarCardPorId(quadro(), "c2");
    expect(depois[0]!.colunas[0]!.cards.map((c) => c.nome)).toEqual(["Ana Paula"]);
  });

  it("coluna paginada: desconta do total em vez de reescrevê-lo pelo tamanho da lista", () => {
    const antes: Funil[] = [
      {
        id: "f1",
        nome: "Vendas",
        // 40 no banco, 2 carregados na tela: é a coluna que mostra uma página e conta o resto.
        colunas: [{ id: "e1", titulo: "Novo", total: 40, cards: [card("c1", "Ana"), card("c2", "Bruno")] }],
      },
    ];
    const depois = tirarCardPorId(antes, "c1");
    expect(depois[0]!.colunas[0]!.cards).toHaveLength(1);
    expect(depois[0]!.colunas[0]!.total).toBe(39);
  });
});

describe("tirarCardsDoContato", () => {
  it("tira a pessoa de todas as colunas e de todos os funis", () => {
    const depois = tirarCardsDoContato(quadro(), "Ana Paula");
    expect(depois[0]!.colunas[0]!.cards.map((c) => c.id)).toEqual(["c2"]);
    expect(depois[0]!.colunas[1]!.cards).toEqual([]);
    expect(depois[1]!.colunas[0]!.cards).toEqual([]);
  });

  it("casa o nome pela mesma régua do resto do CRM: espaço a mais e caixa não importam", () => {
    // "ana  paula" no funil de pós-venda é a mesma pessoa.
    const depois = tirarCardsDoContato(quadro(), "ANA PAULA");
    expect(depois[1]!.colunas[0]!.cards).toEqual([]);
  });

  it("acerta o total de cada coluna que perdeu card", () => {
    const depois = tirarCardsDoContato(quadro(), "Ana Paula");
    expect(depois[0]!.colunas[0]!.total).toBe(1);
    expect(depois[0]!.colunas[1]!.total).toBe(0);
    expect(depois[1]!.colunas[0]!.total).toBe(0);
  });

  it("nome vazio não apaga nada", () => {
    const antes = quadro();
    expect(tirarCardsDoContato(antes, "")).toBe(antes);
    expect(tirarCardsDoContato(antes, "   ")).toBe(antes);
  });

  it("pessoa que não está no quadro devolve o mesmo quadro", () => {
    const antes = quadro();
    expect(tirarCardsDoContato(antes, "Carlos")).toBe(antes);
  });
});
