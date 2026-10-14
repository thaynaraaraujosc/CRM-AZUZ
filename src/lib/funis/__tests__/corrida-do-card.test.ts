import { beforeEach, describe, expect, it, vi } from "vitest";

type Card = { id: string; etapaId: string; ordem: number; workspaceId: string; nome: string; origem: string };

let cards: Card[] = [];
let conversasArquivadas = new Set<string>();

function duplicada() {
  return Object.assign(new Error("Unique constraint failed on the constraint: PRIMARY"), { code: "P2002" });
}

/**
 * Um banco de mentira que impõe a CHAVE PRIMÁRIA e cede o controle em cada `await`.
 *
 * As duas coisas são o teste. A chave primária, porque é ela a correção: sem ela o dublê aceitaria
 * dois cards e o teste passaria com o defeito no lugar. E ceder o controle porque é assim que a
 * corrida acontece de verdade — entre o "tem card?" e o `create` existe um `await`, e é nessa
 * fresta que a outra chamada entra. `Promise.all` com funções `async` reproduz exatamente isso.
 */
vi.mock("@/lib/prisma", () => {
  const etapa = { id: "etapa-1", ordem: 0 };
  return {
    prisma: {
      conversa: {
        findUnique: async ({ where }: { where: { workspaceId_nome: { nome: string } } }) =>
          conversasArquivadas.has(where.workspaceId_nome.nome) ? { arquivada: true } : null,
      },
      funilEtapa: {
        findFirst: async () => ({ ...etapa, cards: cards.filter((c) => c.etapaId === etapa.id) }),
      },
      funil: {
        findFirst: async () => ({
          id: "funil-1",
          etapas: [{ ...etapa, cards: cards.filter((c) => c.etapaId === etapa.id) }],
        }),
      },
      negocioCard: {
        findFirst: async ({ where }: { where: { workspaceId: string; nome?: string } }) =>
          cards.find((c) => c.workspaceId === where.workspaceId && (!where.nome || c.nome === where.nome)) ?? null,
        findMany: async ({ where }: { where: { workspaceId: string } }) =>
          cards.filter((c) => c.workspaceId === where.workspaceId),
        findUnique: async ({ where }: { where: { id: string } }) => cards.find((c) => c.id === where.id) ?? null,
        create: async ({ data }: { data: Card }) => {
          if (cards.some((c) => c.id === data.id)) throw duplicada();
          cards.push(data);
          return data;
        },
      },
    },
  };
});

const { entrarNaPrimeiraEtapaComoNovoLead } = await import("../upsert");

function entrar(contatoNome: string, origem = "Formulário") {
  return entrarNaPrimeiraEtapaComoNovoLead({ workspaceId: "w1", contatoNome, origem });
}

beforeEach(() => {
  cards = [];
  conversasArquivadas = new Set();
});

/**
 * O defeito que o teste com banco de verdade encontrou em 14/10/2026.
 *
 * Com 3 chamadas simultâneas, 16 de 25 rodadas deixavam a pessoa com DOIS cards no funil. E o pior
 * do caso: a chamada devolvia 200, então o Flow não repetia e nada corrigia depois — ficava assim.
 */
describe("card duplicado com chamadas simultâneas", () => {
  for (const n of [2, 3, 8]) {
    it(`${n} chamadas ao mesmo tempo criam UM card só, sem erro`, async () => {
      const resultados = await Promise.all(Array.from({ length: n }, () => entrar("Ana Souza")));
      expect(cards).toHaveLength(1);
      // Todas devolvem o MESMO card: a perdedora da corrida devolve o da vencedora, que é o que o
      // caminho sequencial devolveria. Devolver erro viraria 500 numa entrega que deu certo.
      expect(new Set(resultados.map((r) => r?.id)).size).toBe(1);
      expect(resultados.every((r) => r !== null)).toBe(true);
    });
  }

  it("aguenta 20 rodadas de 8 chamadas sem nunca duplicar", async () => {
    for (let rodada = 0; rodada < 20; rodada++) {
      cards = [];
      await Promise.all(Array.from({ length: 8 }, () => entrar(`Pessoa ${rodada}`)));
      expect(cards, `rodada ${rodada}`).toHaveLength(1);
    }
  });

  it("grafias diferentes do mesmo nome não viram dois cards", async () => {
    // Foi assim que a conta real chegou a 69 negócios pra 35 conversas: "Thais " com espaço no fim
    // e "LUCAS ARANTES" em maiúsculas nasciam como pessoas diferentes.
    await Promise.all([entrar("Thais "), entrar("thais"), entrar("THAIS")]);
    expect(cards).toHaveLength(1);
  });

  it("pessoas diferentes continuam ganhando cards diferentes", async () => {
    await Promise.all([entrar("Ana Souza"), entrar("Bruno Lima"), entrar("Carla Dias")]);
    expect(cards).toHaveLength(3);
  });

  it("o id do card não depende do milissegundo", async () => {
    await entrar("Ana Souza");
    expect(cards[0].id).toBe("card-w1-ana-souza");
  });

  it("nome sem letra nem número ainda entra, com id único", async () => {
    // Sem chave dedutível não há o que deduplicar, e perder o lead seria pior: entra com id único.
    const r = await entrar("🙂");
    expect(r).not.toBeNull();
    expect(cards).toHaveLength(1);
    expect(cards[0].id).not.toBe("card-w1-");
  });

  it("conversa arquivada continua fora do funil", async () => {
    conversasArquivadas.add("Ana Souza");
    expect(await entrar("Ana Souza")).toBeNull();
    expect(cards).toHaveLength(0);
  });

  it("quem já tem card não ganha outro nem muda de etapa", async () => {
    cards = [{ id: "legado-123", etapaId: "etapa-9", ordem: 5, workspaceId: "w1", nome: "Ana Souza", origem: "Manual" }];
    const r = await entrar("Ana Souza");
    expect(r?.id).toBe("legado-123");
    expect(r?.etapaId).toBe("etapa-9");
    expect(cards).toHaveLength(1);
  });

  it("erro que não é chave repetida continua subindo", async () => {
    const prisma = (await import("@/lib/prisma")).prisma as unknown as {
      negocioCard: { create: (a: unknown) => Promise<unknown> };
    };
    const original = prisma.negocioCard.create;
    prisma.negocioCard.create = async () => {
      throw new Error("banco fora do ar");
    };
    await expect(entrar("Ana Souza")).rejects.toThrow("banco fora do ar");
    prisma.negocioCard.create = original;
  });
});
