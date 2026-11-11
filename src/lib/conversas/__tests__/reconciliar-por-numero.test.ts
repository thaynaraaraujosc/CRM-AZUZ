import { beforeEach, describe, expect, it, vi } from "vitest";

type Conversa = { nome: string; canal: string; contato: string | null; contaCanal: string | null; ehGrupo: boolean; arquivada: boolean; contatoId: string | null };
type Card = { id: string; nome: string; origem: string; contaCanal: string | null; etapa: { funilId: string } | null };
type Funil = { id: string; contaCanal: string | null; etapas: { id: string; funilId: string }[] };

let conversas: Conversa[] = [];
let cards: Card[] = [];
let funis: Funil[] = [];
let criados: { etapaId: string; nome: string; contaCanal: string | null }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversa: { findMany: async () => conversas, create: async () => ({}) },
    negocioCard: {
      findMany: async () => cards,
      aggregate: async () => ({ _min: { ordem: 0 } }),
      createMany: async ({ data }: { data: typeof criados }) => {
        criados.push(...data);
        return { count: data.length };
      },
    },
    contato: { findMany: async () => [] },
    funil: { findMany: async () => funis },
  },
}));

const { reconciliarFunilEConversas } = await import("../reconciliar");

function conversa(nome: string, contaCanal: string | null): Conversa {
  return { nome, canal: "WhatsApp", contato: "5562999990000", contaCanal, ehGrupo: false, arquivada: false, contatoId: null };
}

function funil(id: string, contaCanal: string | null): Funil {
  return { id, contaCanal, etapas: [{ id: `${id}-etapa1`, funilId: id }] };
}

const OFICIAL = "meta_whatsapp:143588938831846";
const QR = "whatsapp_nao_oficial:556296340438";

beforeEach(() => {
  conversas = [];
  cards = [];
  funis = [];
  criados = [];
});

/**
 * "Na hora que eu criar, que eu escolher o número, todas as conversas que tiver lá no chat do
 * WhatsApp daquele número vão vir para o funil que representa aquele número."
 *
 * Era um funil só: `findFirst` pegava o primeiro da empresa e TODA conversa virava card nele.
 * Enquanto havia um quadro, dava no mesmo. Com um funil por número, jogar tudo no primeiro encheria
 * o quadro de um número com os leads do outro — que é o amontoado que separar por número existe
 * pra desfazer.
 */
describe("cada conversa vai pro funil do número dela", () => {
  it("conversa do número oficial entra no funil do oficial", async () => {
    funis = [funil("f-oficial", OFICIAL), funil("f-qr", QR)];
    conversas = [conversa("Cássia", OFICIAL)];

    await reconciliarFunilEConversas("w1");

    expect(criados).toHaveLength(1);
    expect(criados[0].etapaId).toBe("f-oficial-etapa1");
  });

  it("cada uma no seu quadro, na mesma rodada", async () => {
    funis = [funil("f-oficial", OFICIAL), funil("f-qr", QR)];
    conversas = [conversa("Cássia", OFICIAL), conversa("Lucas", QR)];

    await reconciliarFunilEConversas("w1");

    expect(criados.map((c) => [c.nome, c.etapaId]).sort()).toEqual([
      ["Cássia", "f-oficial-etapa1"],
      ["Lucas", "f-qr-etapa1"],
    ]);
  });

  it("o nome antigo do canal de QR Code acha o funil certo", async () => {
    funis = [funil("f-qr", QR)];
    conversas = [conversa("Lucas", "whatsapp_baileys:556296340438")];

    await reconciliarFunilEConversas("w1");

    expect(criados[0]?.etapaId).toBe("f-qr-etapa1");
  });

  it("conversa sem número cai no funil sem número", async () => {
    funis = [funil("f-antigo", null), funil("f-oficial", OFICIAL)];
    conversas = [conversa("Histórico", null)];

    await reconciliarFunilEConversas("w1");

    expect(criados[0]?.etapaId).toBe("f-antigo-etapa1");
  });

  it("sem funil para aquele número, a conversa fica de fora — não vai pro quadro de outro", async () => {
    // Não ter card é um problema menor do que ter o card errado: o lead do número A aparecendo no
    // quadro do número B faz quem atende ligar pra quem não é dele.
    funis = [funil("f-qr", QR)];
    conversas = [conversa("Cássia", OFICIAL)];

    await reconciliarFunilEConversas("w1");

    expect(criados).toEqual([]);
  });

  it("quem já tem card NAQUELE funil não ganha outro", async () => {
    funis = [funil("f-oficial", OFICIAL)];
    conversas = [conversa("Cássia", OFICIAL)];
    cards = [{ id: "c1", nome: "cássia", origem: "WhatsApp", contaCanal: OFICIAL, etapa: { funilId: "f-oficial" } }];

    await reconciliarFunilEConversas("w1");

    expect(criados).toEqual([]);
  });

  it("card no OUTRO funil não impede a entrada neste", async () => {
    // A mesma pessoa pode falar pelos dois números, e aí está nos dois quadros de propósito.
    funis = [funil("f-oficial", OFICIAL), funil("f-qr", QR)];
    conversas = [conversa("Cássia", OFICIAL)];
    cards = [{ id: "c1", nome: "Cássia", origem: "WhatsApp", contaCanal: QR, etapa: { funilId: "f-qr" } }];

    await reconciliarFunilEConversas("w1");

    expect(criados).toHaveLength(1);
    expect(criados[0].etapaId).toBe("f-oficial-etapa1");
  });

  it("grupo e conversa arquivada continuam de fora", async () => {
    funis = [funil("f-oficial", OFICIAL)];
    conversas = [
      { ...conversa("Grupo da obra", OFICIAL), ehGrupo: true },
      { ...conversa("Antiga", OFICIAL), arquivada: true },
    ];

    await reconciliarFunilEConversas("w1");

    expect(criados).toEqual([]);
  });

  it("o card nasce marcado com o número de onde veio", async () => {
    // Sem isso o negócio entraria sem dono e não sumiria ao desconectar o canal de origem.
    funis = [funil("f-oficial", OFICIAL)];
    conversas = [conversa("Cássia", OFICIAL)];

    await reconciliarFunilEConversas("w1");

    expect(criados[0].contaCanal).toBe(OFICIAL);
  });
});
