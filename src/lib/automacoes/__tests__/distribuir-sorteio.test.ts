import { describe, expect, it } from "vitest";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { saidasDoNo } from "@/lib/automation-flow/resumo";
import { blocoApareceNaArea } from "@/lib/canais/capacidades";
import type { DistribuirSorteioData, FlowNode } from "@/lib/automation-flow/types";

/**
 * O BLOCO DISTRIBUIR.
 *
 * Ele sorteia, então não dá pra afirmar "cai na opção 1". O que dá pra afirmar — e é o que importa
 * — é que cada opção vira uma saída com a porcentagem no rótulo, que o bloco está disponível no
 * Instagram, e que a conta de "distribuir igualmente" fecha 100 exato mesmo quando 100 não divide
 * pelo número de opções (3 opções: 34/33/33, e não 33/33/33, que somaria 99).
 */
function no(opcoes: DistribuirSorteioData["opcoes"]): FlowNode {
  return {
    id: "d1",
    type: "distribuir_sorteio",
    category: "condicao",
    position: { x: 0, y: 0 },
    data: { opcoes },
  } as FlowNode;
}

describe("o bloco Distribuir", () => {
  it("existe e aparece no construtor do Instagram", () => {
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === "distribuir_sorteio");
    expect(bloco, "o bloco Distribuir sumiu da biblioteca").toBeDefined();
    expect(blocoApareceNaArea(bloco!, "social")).toBe(true);
  });

  it("nasce com duas opções de 50%, que somam 100", () => {
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === "distribuir_sorteio")!;
    const padrao = bloco.dataPadrao?.() as DistribuirSorteioData;
    expect(padrao.opcoes).toHaveLength(2);
    expect(padrao.opcoes.reduce((t, o) => t + o.porcentagem, 0)).toBe(100);
  });

  it("vira uma saída por opção, com a porcentagem no rótulo", () => {
    const saidas = saidasDoNo(
      no([
        { id: "a", rotulo: "Mensagem curta", porcentagem: 70 },
        { id: "b", rotulo: "Mensagem longa", porcentagem: 30 },
      ]),
    );
    expect(saidas.map((s) => s.handleId)).toEqual(["a", "b"]);
    expect(saidas[0].label).toBe("Mensagem curta - 70%");
    expect(saidas[1].label).toBe("Mensagem longa - 30%");
  });

  it("a divisão igual fecha 100 exato quando 100 não divide pelo número de opções", () => {
    // É a conta que o botão "Distribuir igualmente" faz: base pra todas, e a sobra na primeira.
    const dividir = (n: number) => {
      const base = Math.floor(100 / n);
      const sobra = 100 - base * n;
      return Array.from({ length: n }, (_, i) => base + (i === 0 ? sobra : 0));
    };
    for (const n of [2, 3, 6, 7, 20]) {
      const partes = dividir(n);
      expect(partes.reduce((t, p) => t + p, 0), `${n} opções não fecharam 100`).toBe(100);
    }
    expect(dividir(3)).toEqual([34, 33, 33]);
  });
});
