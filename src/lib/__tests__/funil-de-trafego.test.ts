import { describe, expect, it } from "vitest";

import type { Funil, NegocioCard, Origem } from "@/lib/data";
import { calcularValorVendido, funilDeTrafego, negociosDasOrigens } from "@/lib/metrics";

/**
 * O FUNIL DE TRÁFEGO CONTA TRÁFEGO.
 *
 * "Qual que é a lógica desse funil de tráfego? Por exemplo, o novo, dois novos. Aonde foi esses
 * dois novos? Da onde que ele está pegando essas informações?"
 *
 * O defeito que estes testes trancam: a tela usava `funis[0].colunas[i].cards.length` — o primeiro
 * funil da conta, contagem crua, sem olhar origem nenhuma. Lead de indicação entrava no mesmo
 * número que lead de anúncio, e o custo por lead da tela saía mais barato do que é.
 */

const ORIGENS_PAGAS = ["Meta Ads", "Google Ads", "TikTok"] as const;

let proximo = 0;
function card(origem: Origem, extra: Partial<NegocioCard> = {}): NegocioCard {
  proximo += 1;
  return {
    id: `c${proximo}`,
    nome: `Negócio ${proximo}`,
    valor: "R$ 1.000",
    origem,
    dias: "1d",
    data: "2026-11-01",
    ...extra,
  };
}

function funil(id: string, colunas: { titulo: string; cards: NegocioCard[] }[]): Funil {
  return {
    id,
    nome: `Funil ${id}`,
    colunas: colunas.map((c, i) => ({
      id: `${id}-${i}`,
      titulo: c.titulo,
      total: c.cards.length,
      cards: c.cards,
    })),
  };
}

describe("funilDeTrafego", () => {
  it("conta só negócio com origem de anúncio pago", () => {
    const etapas = funilDeTrafego(
      [
        funil("a", [
          { titulo: "Novo", cards: [card("Meta Ads"), card("Indicação"), card("Google Ads")] },
          { titulo: "Proposta", cards: [card("WhatsApp")] },
        ]),
      ],
      ORIGENS_PAGAS,
    );

    // "Novo" tinha 3 cards; só 2 vieram de anúncio.
    expect(etapas.map((e) => [e.label, e.quantidade])).toEqual([
      ["Novo", 2],
      ["Proposta", 0],
    ]);
  });

  it("soma TODOS os funis, e não só o primeiro", () => {
    /*
     * Este é o teste da pergunta "é de um WhatsApp ou de dois": cada funil é de um número
     * (`Funil.contaCanal`), e a tela pegava `funis[0]`. Com dois números, metade da operação
     * sumia da tela sem nada avisando.
     */
    const etapas = funilDeTrafego(
      [
        funil("comercial", [{ titulo: "Novo", cards: [card("Meta Ads")] }]),
        funil("suporte", [{ titulo: "Novo", cards: [card("Meta Ads"), card("Meta Ads")] }]),
      ],
      ORIGENS_PAGAS,
    );

    expect(etapas).toHaveLength(1);
    expect(etapas[0]).toMatchObject({ label: "Novo", quantidade: 3 });
  });

  it("etapas com o mesmo nome somam numa barra só, na ordem da primeira aparição", () => {
    const etapas = funilDeTrafego(
      [
        funil("a", [
          { titulo: "Novo", cards: [card("Meta Ads")] },
          { titulo: "Fechado", cards: [card("Meta Ads")] },
        ]),
        funil("b", [
          { titulo: "Fechado", cards: [card("Google Ads")] },
          { titulo: "Qualificado", cards: [card("Google Ads")] },
        ]),
      ],
      ORIGENS_PAGAS,
    );

    expect(etapas.map((e) => e.label)).toEqual(["Novo", "Fechado", "Qualificado"]);
    expect(etapas.find((e) => e.label === "Fechado")?.quantidade).toBe(2);
  });

  it("etapa sem negócio pago vira barra zerada, não desaparece", () => {
    // Pular a etapa quebraria a leitura do funil: a queda de uma etapa pra outra é justamente o
    // que o desenho mostra, e ela some se um degrau não existir.
    const etapas = funilDeTrafego(
      [
        funil("a", [
          { titulo: "Novo", cards: [card("Meta Ads")] },
          { titulo: "Proposta", cards: [card("Indicação")] },
          { titulo: "Fechado", cards: [card("Meta Ads")] },
        ]),
      ],
      ORIGENS_PAGAS,
    );

    expect(etapas.map((e) => e.quantidade)).toEqual([1, 0, 1]);
  });

  it("filtrando por uma plataforma, conta só ela", () => {
    const etapas = funilDeTrafego(
      [funil("a", [{ titulo: "Novo", cards: [card("Meta Ads"), card("Google Ads")] }])],
      ["Meta Ads"],
    );

    expect(etapas[0].quantidade).toBe(1);
  });

  it("conta de verdade: sem funil nenhum, nenhuma etapa", () => {
    expect(funilDeTrafego([], ORIGENS_PAGAS)).toEqual([]);
  });
});

describe("negociosDasOrigens", () => {
  it("a receita da tela é só a dos negócios pagos ganhos", () => {
    /*
     * O rótulo de valor na última etapa mostrava `calcularValorVendido(todosOsCards(funis))`: a
     * receita de TODOS os negócios ganhos da conta, orgânicos incluídos, pendurada num funil que
     * dizia ser de tráfego. O mesmo valia pro KPI "Vendas", e com ele pro custo por venda — que
     * ficava mais barato quanto mais a empresa vendesse por indicação.
     */
    const funis = [
      funil("a", [
        {
          titulo: "Fechado",
          cards: [
            card("Meta Ads", { valor: "R$ 1.000", statusFechamento: "ganho" }),
            card("Indicação", { valor: "R$ 9.000", statusFechamento: "ganho" }),
            card("Meta Ads", { valor: "R$ 500", statusFechamento: "perdido" }),
          ],
        },
      ]),
    ];

    const pagos = negociosDasOrigens(funis, ORIGENS_PAGAS);
    expect(pagos).toHaveLength(2);

    expect(calcularValorVendido(pagos).valor).toBe(1000);
    // A conta inteira daria 10.000: o orgânico de R$ 9.000 entrava na receita atribuída ao tráfego.
    expect(calcularValorVendido(funis.flatMap((f) => f.colunas.flatMap((c) => c.cards))).valor).toBe(10000);
  });
});
