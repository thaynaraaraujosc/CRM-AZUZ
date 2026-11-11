import { beforeEach, describe, expect, it, vi } from "vitest";

type Card = {
  id: string;
  nome: string;
  valor: string;
  responsavel: string | null;
  statusFechamento: string | null;
  etapa: { titulo: string; ordem: number; funilId: string } | null;
};

let cards: Card[] = [];
let removidos: string[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    negocioCard: {
      findMany: async () => cards,
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        removidos = where.id.in;
        cards = cards.filter((c) => !removidos.includes(c.id));
        return { count: removidos.length };
      },
    },
  },
}));

const { juntarCardsDuplicados, planejarJuncaoDeCards } = await import("../consolidar");

function card(id: string, nome: string, funilId: string, ordem = 0): Card {
  return { id, nome, valor: "-", responsavel: null, statusFechamento: null, etapa: { titulo: `Etapa ${ordem}`, ordem, funilId } };
}

beforeEach(() => {
  cards = [];
  removidos = [];
});

/**
 * JUNTAR DUPLICADO APAGA LINHA, e é por isso que esta regra precisa de teste próprio.
 *
 * O botão "Juntar repetidos" existe pra consertar o estrago da grafia diferente do nome ("Thais "
 * com espaço, "LUCAS ARANTES" em maiúsculas), que dava um card novo a cada variação — 69 negócios
 * pra 35 conversas na conta real.
 *
 * Desde que a mesma pessoa pode estar em dois funis de propósito (um por número que fala com ela),
 * agrupar por nome no workspace inteiro passaria a APAGAR o card do segundo número. Sem volta, e
 * justamente o arranjo que a pessoa acabou de montar.
 */
describe("junção de negócios duplicados", () => {
  it("junta duas grafias do mesmo nome no MESMO funil", async () => {
    cards = [card("a", "Thais ", "funil-1", 0), card("b", "thais", "funil-1", 2)];
    const plano = await planejarJuncaoDeCards("w1");
    expect(plano).toHaveLength(1);
    // Fica o que está mais à frente no funil: é ele que carrega o trabalho feito.
    expect(plano[0].fica.id).toBe("b");
    expect(plano[0].saem.map((c) => c.id)).toEqual(["a"]);
  });

  it("NÃO junta a mesma pessoa em funis diferentes", async () => {
    cards = [card("a", "Cassia", "funil-comercial"), card("b", "Cassia", "funil-lucas")];
    expect(await planejarJuncaoDeCards("w1")).toEqual([]);
  });

  it("e não apaga nada nesse caso", async () => {
    cards = [card("a", "Cassia", "funil-comercial"), card("b", "Cassia", "funil-lucas")];
    const r = await juntarCardsDuplicados("w1");
    expect(r.cardsRemovidos).toBe(0);
    expect(removidos).toEqual([]);
    expect(cards).toHaveLength(2);
  });

  it("junta dentro de cada funil sem misturar os dois", async () => {
    cards = [
      card("a1", "Cassia", "funil-comercial", 0),
      card("a2", "CASSIA", "funil-comercial", 3),
      card("b1", "Cassia", "funil-lucas", 1),
      card("b2", "cassia ", "funil-lucas", 0),
    ];
    const plano = await planejarJuncaoDeCards("w1");
    expect(plano).toHaveLength(2);
    expect(plano.flatMap((g) => g.saem.map((c) => c.id)).sort()).toEqual(["a1", "b2"]);
  });

  it("card com etapa apagada fica num grupo só dele, longe de quem tem funil", async () => {
    const orfao = { ...card("x", "Cassia", "funil-1"), etapa: null };
    cards = [orfao, card("y", "Cassia", "funil-1")];
    expect(await planejarJuncaoDeCards("w1")).toEqual([]);
  });

  it("card sem nome não entra em grupo nenhum", async () => {
    // `chaveDeContato("")` é vazia, e vazia não identifica ninguém: juntar por ela colocaria
    // pessoas diferentes no mesmo grupo e apagaria card de quem não tem nada a ver.
    cards = [card("a", "  ", "funil-1"), card("b", "", "funil-1")];
    expect(await planejarJuncaoDeCards("w1")).toEqual([]);
  });
});
