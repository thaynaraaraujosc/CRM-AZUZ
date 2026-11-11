import { beforeEach, describe, expect, it, vi } from "vitest";

type Card = { id: string; etapaId: string; ordem: number; workspaceId: string; nome: string; origem: string };

let cards: Card[] = [];
let conversasArquivadas = new Set<string>();
/** Quantas mensagens já existem por `contato|contaCanal`. Ver `entrarNoFunilDoNumero`. */
let mensagensPorNumero = new Map<string, number>();

function duplicada() {
  return Object.assign(new Error("Unique constraint failed on the constraint: PRIMARY"), { code: "P2002" });
}

/**
 * A QUAL FUNIL CADA ETAPA PERTENCE. O dublê precisa saber, porque a regra agora é por funil.
 *
 * `etapa-1` é a primeira etapa do funil padrão (onde o lead novo entra). `etapa-9` é outra etapa
 * do MESMO funil, usada pelo card legado. `etapa-do-outro` é de um segundo funil — o do outro
 * número — e é ela que prova que um card lá não bloqueia a entrada aqui.
 */
/** O `funil-1` do dublê tem número próprio? Ver o `findFirst` de `funil`, abaixo. */
let FUNIL_TEM_NUMERO = false;

const FUNIL_DA_ETAPA: Record<string, string> = {
  "etapa-1": "funil-1",
  "etapa-9": "funil-1",
  "etapa-do-outro": "funil-2",
};

/**
 * Um banco de mentira que impõe a CHAVE PRIMÁRIA e cede o controle em cada `await`.
 *
 * As duas coisas são o teste. A chave primária, porque é ela a correção: sem ela o dublê aceitaria
 * dois cards e o teste passaria com o defeito no lugar. E ceder o controle porque é assim que a
 * corrida acontece de verdade — entre o "tem card?" e o `create` existe um `await`, e é nessa
 * fresta que a outra chamada entra. `Promise.all` com funções `async` reproduz exatamente isso.
 *
 * O filtro `etapa: { funilId }` é RESPEITADO de propósito. Ignorá-lo faria o dublê responder "essa
 * pessoa já tem card" pra card de qualquer funil, que é exatamente o defeito que esta leva de
 * mudanças corrige: a Cássia, chamada pela API oficial, nunca entrava no funil do Lucas porque já
 * tinha card no funil comercial.
 */
vi.mock("@/lib/prisma", () => {
  const etapa = { id: "etapa-1", funilId: "funil-1", ordem: 0 };
  type Onde = { workspaceId: string; nome?: string; etapa?: { funilId: string } };
  const casa = (c: Card, where: Onde) =>
    c.workspaceId === where.workspaceId &&
    (!where.nome || c.nome === where.nome) &&
    (!where.etapa || FUNIL_DA_ETAPA[c.etapaId] === where.etapa.funilId);
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
        /*
         * O dublê respeita o `where`, inclusive `contaCanal: null`.
         *
         * `entrarNaPrimeiraEtapaComoNovoLead` procura, nesta ordem: o funil escolhido, o funil SEM
         * número (a rede de segurança) e só então o primeiro da lista. Ignorando o filtro, o dublê
         * responderia "achei" pras três perguntas e o teste passaria com o lead caindo no quadro de
         * outro número.
         */
        findFirst: async ({ where }: { where: { id?: string; contaCanal?: string | null } }) => {
          if (where.id && where.id !== "funil-1") return null;
          if (where.contaCanal === null && FUNIL_TEM_NUMERO) return null;
          return { id: "funil-1", etapas: [{ ...etapa, cards: cards.filter((c) => c.etapaId === etapa.id) }] };
        },
      },
      mensagemExtra: {
        count: async ({ where }: { where: { contato: string; contaCanal: { in: string[] } } }) =>
          where.contaCanal.in.reduce(
            (total, conta) => total + (mensagensPorNumero.get(`${where.contato}|${conta}`) ?? 0),
            0,
          ),
      },
      negocioCard: {
        findFirst: async ({ where }: { where: Onde }) => cards.find((c) => casa(c, where)) ?? null,
        findMany: async ({ where }: { where: Onde }) => cards.filter((c) => casa(c, where)),
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

const { entrarNaPrimeiraEtapaComoNovoLead, entrarNoFunilDoNumero } = await import("../upsert");

function entrar(contatoNome: string, origem = "Formulário") {
  return entrarNaPrimeiraEtapaComoNovoLead({ workspaceId: "w1", contatoNome, origem });
}

beforeEach(() => {
  cards = [];
  conversasArquivadas = new Set();
  mensagensPorNumero = new Map();
  FUNIL_TEM_NUMERO = false;
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

  it("o id do card não depende do milissegundo, e carrega o funil", async () => {
    // O funil entra na chave porque a garantia é "um card por pessoa POR FUNIL": ver `idDoCard`.
    await entrar("Ana Souza");
    expect(cards[0].id).toBe("card-w1-funil-1-ana-souza");
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

  it("quem já tem card NO MESMO FUNIL não ganha outro nem muda de etapa", async () => {
    // `etapa-9` é do `funil-1`, o mesmo em que o lead novo entraria. Dentro de um funil a regra não
    // mudou: mover de etapa continua sendo decisão de quem atende, nunca efeito de mais uma
    // mensagem. Vale pro card legado, que tem id do formato antigo e é achado pelo nome.
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

/**
 * A MESMA PESSOA EM DOIS FUNIS, um por número que fala com ela.
 *
 * "Eu chamei o número da Cássia pelo WhatsApp da versão oficial. Só que ela não foi pro funil do
 * Lucas. (…) Por mais que eu esteja conversando com essa pessoa por 2 WhatsApp, ela tem que estar
 * nos 2 funis e não só em 1."
 *
 * A conferência de "já tem card?" era do workspace inteiro: card em QUALQUER funil respondia "já
 * tem" e o lead não entrava no funil do outro número. Com a API oficial no número principal e o
 * celular do closer no QR Code, isso quer dizer que o segundo funil nunca recebia ninguém que já
 * tivesse falado pelo primeiro.
 */
describe("a mesma pessoa em mais de um funil", () => {
  it("card no OUTRO funil não bloqueia a entrada neste", async () => {
    cards = [
      { id: "card-w1-funil-2-ana-souza", etapaId: "etapa-do-outro", ordem: 0, workspaceId: "w1", nome: "Ana Souza", origem: "WhatsApp" },
    ];
    const r = await entrar("Ana Souza");
    expect(cards).toHaveLength(2);
    expect(r?.etapaId).toBe("etapa-1");
    // Os dois cards coexistem porque o funil entra na chave primária.
    expect(cards.map((c) => c.id).sort()).toEqual([
      "card-w1-funil-1-ana-souza",
      "card-w1-funil-2-ana-souza",
    ]);
  });

  it("card legado no outro funil também não bloqueia", async () => {
    // Card de antes de o funil entrar no id: é achado pelo NOME dentro do funil dele, e o funil
    // dele não é este.
    cards = [
      { id: "legado-123", etapaId: "etapa-do-outro", ordem: 0, workspaceId: "w1", nome: "Ana Souza", origem: "Manual" },
    ];
    await entrar("Ana Souza");
    expect(cards).toHaveLength(2);
  });

  it("entrar duas vezes no mesmo funil continua criando um card só", async () => {
    await entrar("Ana Souza");
    await entrar("Ana Souza");
    expect(cards).toHaveLength(1);
  });
});

/**
 * CLIENTE ANTIGA, NÚMERO NOVO: entra no funil daquele número, e só na primeira vez.
 *
 * O caso da Cássia: cliente de meses, chamada pela primeira vez pela API oficial, que nunca
 * aparecia no quadro daquele número porque "já tinha card".
 *
 * As duas guardas estão aqui, e cada uma protege de um estrago diferente: sem funil próprio nada
 * acontece (senão mensagem nova criaria negócio no quadro padrão), e a partir da segunda mensagem
 * nada acontece (senão um card tirado do quadro de propósito voltaria sozinho).
 */
describe("entrarNoFunilDoNumero", () => {
  const OFICIAL = "meta_whatsapp:143588938831846";

  function porEsteNumero(contato: string, quantas: number, conta = OFICIAL) {
    mensagensPorNumero.set(`${contato}|${conta}`, quantas);
  }

  it("primeira mensagem por este número entra no funil dele", async () => {
    porEsteNumero("Cassia", 1);
    const r = await entrarNoFunilDoNumero({
      workspaceId: "w1",
      contatoNome: "Cassia",
      origem: "WhatsApp",
      contaCanal: OFICIAL,
      funilId: "funil-1",
    });
    expect(r).not.toBeNull();
    expect(cards).toHaveLength(1);
  });

  it("segunda mensagem por este número não cria nada", async () => {
    porEsteNumero("Cassia", 2);
    expect(
      await entrarNoFunilDoNumero({
        workspaceId: "w1",
        contatoNome: "Cassia",
        origem: "WhatsApp",
        contaCanal: OFICIAL,
        funilId: "funil-1",
      }),
    ).toBeNull();
    expect(cards).toHaveLength(0);
  });

  it("card tirado do quadro de propósito não volta na mensagem seguinte", async () => {
    // É o motivo da guarda da contagem. A pessoa apaga o negócio (gesto deliberado, com
    // confirmação) e segue conversando: o quadro tem que continuar sem ele.
    porEsteNumero("Cassia", 7);
    await entrarNoFunilDoNumero({
      workspaceId: "w1",
      contatoNome: "Cassia",
      origem: "WhatsApp",
      contaCanal: OFICIAL,
      funilId: "funil-1",
    });
    expect(cards).toHaveLength(0);
  });

  it("sem funil próprio, não cria nada nem no quadro padrão", async () => {
    porEsteNumero("Cassia", 1);
    expect(
      await entrarNoFunilDoNumero({
        workspaceId: "w1",
        contatoNome: "Cassia",
        origem: "WhatsApp",
        contaCanal: OFICIAL,
        funilId: null,
      }),
    ).toBeNull();
    expect(cards).toHaveLength(0);
  });

  it("grupo nunca entra", async () => {
    porEsteNumero("Grupo da obra", 1);
    expect(
      await entrarNoFunilDoNumero({
        workspaceId: "w1",
        contatoNome: "Grupo da obra",
        ehGrupo: true,
        origem: "WhatsApp",
        contaCanal: OFICIAL,
        funilId: "funil-1",
      }),
    ).toBeNull();
    expect(cards).toHaveLength(0);
  });

  it("conta a grafia antiga do QR Code junto com a nova", async () => {
    // `whatsapp_baileys:` é o nome antigo do canal, ainda gravado em mensagem de antes da
    // renomeação. Sem somar as duas, um número que conversa há meses daria zero e o card entraria
    // como se fosse a primeira vez.
    porEsteNumero("Cassia", 40, "whatsapp_baileys:556296340438");
    expect(
      await entrarNoFunilDoNumero({
        workspaceId: "w1",
        contatoNome: "Cassia",
        origem: "WhatsApp",
        contaCanal: "whatsapp_nao_oficial:556296340438",
        funilId: "funil-1",
      }),
    ).toBeNull();
    expect(cards).toHaveLength(0);
  });

  it("não ganha um segundo card se já estiver nesse funil", async () => {
    porEsteNumero("Cassia", 1);
    cards = [
      { id: "ja-existe", etapaId: "etapa-9", ordem: 0, workspaceId: "w1", nome: "Cassia", origem: "Manual" },
    ];
    await entrarNoFunilDoNumero({
      workspaceId: "w1",
      contatoNome: "Cassia",
      origem: "WhatsApp",
      contaCanal: OFICIAL,
      funilId: "funil-1",
    });
    expect(cards).toHaveLength(1);
  });
});

/**
 * O LEAD DE UM NÚMERO SEM QUADRO PRÓPRIO NÃO PODE CAIR NO QUADRO DE OUTRO NÚMERO.
 *
 * O destino era "o primeiro funil do workspace". Com um funil por número — "nenhum funil pode ter
 * mais do que um número; não pode receber mensagens de WhatsApps diferentes" —, isso punha o lead
 * de um número no quadro de outro, e quem atende por aquele número liga pra quem não é dele.
 *
 * A rede de segurança passou a ser o funil SEM número, que é justamente o que existe pra receber o
 * que não tem quadro próprio.
 */
describe("onde o lead cai quando o número dele não tem funil", () => {
  it("sem funil sem número, o lead não entra num quadro de outro número", async () => {
    FUNIL_TEM_NUMERO = true;
    expect(await entrar("Ana Souza")).toBeNull();
    expect(cards).toEqual([]);
  });

  it("havendo funil sem número, é nele que o lead entra", async () => {
    FUNIL_TEM_NUMERO = false;
    expect(await entrar("Ana Souza")).not.toBeNull();
    expect(cards).toHaveLength(1);
  });
});
