import { beforeEach, describe, expect, it, vi } from "vitest";

type Card = { id: string; nome: string; etapa: { funilId: string } | null };
type Conversa = { nome: string; contato: string | null };

let cards: Card[] = [];
let conversas: Conversa[] = [];
let renomeados: { id: string; nome: string }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    negocioCard: {
      findMany: async () => cards,
      update: async ({ where, data }: { where: { id: string }; data: { nome: string } }) => {
        renomeados.push({ id: where.id, nome: data.nome });
        const card = cards.find((c) => c.id === where.id);
        if (card) card.nome = data.nome;
        return card;
      },
    },
    conversa: { findMany: async () => conversas },
  },
}));

const { batizarCardsPeloTelefone } = await import("../consolidar");

beforeEach(() => {
  cards = [];
  conversas = [];
  renomeados = [];
});

/**
 * O CASO DA GABRIELA, consertado no banco e não só na tela.
 *
 * O card nasce com o nome que havia quando o lead entrou — e quando a primeira mensagem não traz o
 * nome de perfil, esse nome é o telefone. A conversa é batizada depois, e se o card não foi junto,
 * os dois lados do CRM ficam falando de pessoas diferentes pra sempre.
 *
 * `padronizarNomes` não alcança este caso: ela junta quem já tem a MESMA chave de nome, e aqui as
 * chaves são diferentes por definição. A ponte é o telefone.
 */
describe("batizarCardsPeloTelefone", () => {
  it("o card chamado pelo número ganha o nome da conversa", async () => {
    cards = [{ id: "c1", nome: "556384544268", etapa: { funilId: "f1" } }];
    conversas = [{ nome: "GABRIELA KTM", contato: "556384544268" }];

    expect(await batizarCardsPeloTelefone("w1")).toBe(1);
    expect(renomeados).toEqual([{ id: "c1", nome: "GABRIELA KTM" }]);
  });

  it("acha mesmo com o telefone escrito de outro jeito", async () => {
    cards = [{ id: "c1", nome: "6384544268", etapa: { funilId: "f1" } }];
    conversas = [{ nome: "GABRIELA KTM", contato: "+55 63 8454-4268" }];

    expect(await batizarCardsPeloTelefone("w1")).toBe(1);
  });

  it("NÃO troca nome de verdade por outro nome", async () => {
    // Quem renomeou um card à mão escolheu aquele nome.
    cards = [{ id: "c1", nome: "Gabriela da KTM", etapa: { funilId: "f1" } }];
    conversas = [{ nome: "GABRIELA KTM", contato: "556384544268" }];

    expect(await batizarCardsPeloTelefone("w1")).toBe(0);
    expect(renomeados).toEqual([]);
  });

  it("não batiza quando a conversa também se chama pelo número", async () => {
    cards = [{ id: "c1", nome: "556384544268", etapa: { funilId: "f1" } }];
    conversas = [{ nome: "556384544268", contato: "556384544268" }];

    expect(await batizarCardsPeloTelefone("w1")).toBe(0);
  });

  it("não cria duplicado: nome já ocupado no MESMO funil fica como está", async () => {
    // Renomear aqui produziria o duplicado que o botão "Juntar repetidos" existe pra desfazer — e
    // criar sozinho o que só se desfaz com confirmação é trocar um problema visível por um escondido.
    cards = [
      { id: "c1", nome: "556384544268", etapa: { funilId: "f1" } },
      { id: "c2", nome: "GABRIELA KTM", etapa: { funilId: "f1" } },
    ];
    conversas = [{ nome: "GABRIELA KTM", contato: "556384544268" }];

    expect(await batizarCardsPeloTelefone("w1")).toBe(0);
  });

  it("nome ocupado em OUTRO funil não impede: a mesma pessoa pode estar nos dois", async () => {
    cards = [
      { id: "c1", nome: "556384544268", etapa: { funilId: "f1" } },
      { id: "c2", nome: "GABRIELA KTM", etapa: { funilId: "f2" } },
    ];
    conversas = [{ nome: "GABRIELA KTM", contato: "556384544268" }];

    expect(await batizarCardsPeloTelefone("w1")).toBe(1);
  });

  it("dois cards do mesmo número em funis diferentes ganham nome os dois", async () => {
    cards = [
      { id: "c1", nome: "556384544268", etapa: { funilId: "f1" } },
      { id: "c2", nome: "556384544268", etapa: { funilId: "f2" } },
    ];
    conversas = [{ nome: "GABRIELA KTM", contato: "556384544268" }];

    expect(await batizarCardsPeloTelefone("w1")).toBe(2);
  });

  it("sem card chamado por número, nem lê as conversas à toa", async () => {
    cards = [{ id: "c1", nome: "Ana Souza", etapa: { funilId: "f1" } }];
    expect(await batizarCardsPeloTelefone("w1")).toBe(0);
  });

  it("card sem conversa correspondente fica como está", async () => {
    cards = [{ id: "c1", nome: "5511000000000", etapa: { funilId: "f1" } }];
    conversas = [{ nome: "GABRIELA KTM", contato: "556384544268" }];
    expect(await batizarCardsPeloTelefone("w1")).toBe(0);
  });
});
