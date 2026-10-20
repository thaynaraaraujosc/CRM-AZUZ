import { beforeEach, describe, expect, it, vi } from "vitest";

import { receberLeadDoFlow, type DependenciasDoFlow, type ResultadoDoLead } from "../azuz-flow-lead";
import { validarPayloadDoFlow, type LeadDoFlow } from "../azuz-flow-payload";
import { dataIsoEmBrasilia, horaEmBrasilia } from "@/lib/agenda/fuso";
import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { idDeCardSemChave, idDoCard } from "@/lib/funis/id-do-card";
import { ehChaveDuplicada } from "@/lib/prisma-erros";

/**
 * As duas corridas que o teste de ponta a ponta encontrou.
 *
 * Elas não são teóricas: um formulário publicado em dois canais entrega dois leads no mesmo
 * segundo, e o Flow repete a entrega quando a rede oscila. Nos dois casos o banco recusa por chave
 * repetida, e a resposta certa nunca é 500 — 500 faz o Flow repetir uma entrega que já deu certo.
 *
 * O banco de mentira abaixo é o ponto do teste: ele impõe as MESMAS chaves únicas do schema (id do
 * contato derivado do nome, e a entrega por `respostaId`), porque é exatamente delas que a corrida
 * nasce. Um dublê que aceita tudo não reproduziria nada.
 */
function duplicada() {
  return Object.assign(new Error("Unique constraint failed on the constraint: PRIMARY"), { code: "P2002" });
}

function bancoDeMentira() {
  const contatosPorNome = new Map<string, { id: string; nome: string; whatsapp?: string | null; email?: string | null }>();
  const entregas = new Map<string, ResultadoDoLead>();
  const criados: string[] = [];
  // A agenda, com a MESMA chave primária do banco: o id do compromisso sai da entrega.
  const compromissos = new Map<string, { contato: string; dataIso: string; hora: string }>();
  // O funil, idem: o id do card sai do nome. A função de verdade é exercitada em
  // `src/lib/funis/__tests__/corrida-do-card.test.ts`, com o Prisma dublado; aqui o que se mede é
  // se a orquestração chama uma vez por pessoa e se a chave repetida não sobe como 5xx.
  const cards = new Map<string, { nome: string }>();

  function deps(): DependenciasDoFlow {
    return {
      acharEntregaAnterior: async (chave) => entregas.get(chave) ?? null,
      gravarEntrega: async ({ chave, resultado }) => {
        if (entregas.has(chave)) throw duplicada();
        entregas.set(chave, resultado);
      },
      acharContatoPorTelefone: async (telefone) => {
        const achado = [...contatosPorNome.values()].find((c) => c.whatsapp === telefone);
        return achado ? { id: achado.id, nome: achado.nome } : null;
      },
      acharContatoPorEmail: async (email) => {
        const achado = [...contatosPorNome.values()].find((c) => c.email === email);
        return achado ? { id: achado.id, nome: achado.nome } : null;
      },
      nomeOcupado: async (nome) => contatosPorNome.has(nome),
      lerContato: async (nome) => (contatosPorNome.get(nome) as Record<string, unknown>) ?? null,
      criarContato: async (dados) => {
        const nome = dados.nome;
        // A chave única de verdade: o id sai do nome, então dois nomes iguais colidem.
        if (contatosPorNome.has(nome)) throw duplicada();
        const linha = {
          id: `w1-${nome}`,
          nome,
          whatsapp: (dados.whatsapp as string | undefined) ?? null,
          email: (dados.email as string | undefined) ?? null,
        };
        contatosPorNome.set(nome, linha);
        criados.push(nome);
        return { id: linha.id, nome };
      },
      atualizarContato: async () => {},
      anotarNaLinhaDoTempo: async () => {},
      garantirCompromisso: async ({ chaveDaEntrega, contatoNome, reuniao }) => {
        const id = `flow-reuniao-w1-${chaveDaEntrega}`;
        try {
          if (compromissos.has(id)) throw duplicada();
          compromissos.set(id, {
            contato: contatoNome,
            dataIso: dataIsoEmBrasilia(reuniao.inicio),
            hora: horaEmBrasilia(reuniao.inicio),
          });
        } catch (erro) {
          // Igual ao dependenciasReais: chave repetida é "já está gravado", não erro.
          if ((erro as { code?: string }).code !== "P2002") throw erro;
        }
      },
      conexoesDeWhatsapp: async () => ({ oficial: "111", qrcode: null }),
      config: async () => ({ canal: "automatico" as const, confirmacao: { ativa: false, texto: "" } }),
      nomeDaEmpresa: async () => "Azuz Digital",
      enfileirarConfirmacao: async () => ({ situacao: "enfileirada" as const }),
      anotarNaConversa: async () => {},
      conversaDoContato: async () => null,
      garantirConversa: async () => ({ id: "conv" }),
      temCardNoFunil: async (contatoNome) =>
        [...cards.values()].some((c) => chaveDeContato(c.nome) === chaveDeContato(contatoNome)),
      entrarNoFunil: async ({ contatoNome }) => {
        const id = idDoCard("w1", contatoNome) ?? idDeCardSemChave("w1");
        try {
          if (cards.has(id)) throw duplicada();
          cards.set(id, { nome: contatoNome });
        } catch (erro) {
          if (!ehChaveDuplicada(erro)) throw erro;
        }
        return { funil: "Comercial", etapa: "Novo" };
      },
      subirCard: async () => {},
      avisarContatoCriado: () => {},
      dispararAutomacoes: async () => {},
    };
  }

  return { deps, contatosPorNome, entregas, criados, compromissos, cards };
}

function lead(respostaId: string, dadosDoLead: Record<string, unknown>, extra: Record<string, unknown> = {}): LeadDoFlow {
  const r = validarPayloadDoFlow({
    origem: { formularioId: "f1", formularioNome: "Consultoria grátis", respostaId },
    lead: dadosDoLead,
    respostas: [],
    consentimento: { whatsapp: { aceitou: true, texto: null, em: null } },
    ...extra,
  });
  if (!r.ok) throw new Error(r.erro);
  return r.lead;
}

beforeEach(() => vi.clearAllMocks());

describe("dois leads com o MESMO NOME chegando juntos", () => {
  it("mesmo telefone vira UM contato, e as duas respostas dão certo", async () => {
    const banco = bancoDeMentira();
    const mesmo = { nome: "Marina", sobrenome: "Alves", whatsapp: "5562996340438" };

    const [a, b] = await Promise.all([
      receberLeadDoFlow({ workspaceId: "w1", lead: lead("r-1", mesmo), deps: banco.deps() }),
      receberLeadDoFlow({ workspaceId: "w1", lead: lead("r-2", mesmo), deps: banco.deps() }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // É a mesma pessoa: um contato só, sem sufixo nenhum.
    expect(banco.criados).toEqual(["Marina Alves"]);
    expect(a.contatoId).toBe(b.contatoId);
    // E isto PROVA que a repetição rodou: uma das duas bateu na chave duplicada, refez a decisão e
    // caiu no caminho de completar. Sem a correção, essa aqui teria estourado.
    expect([a.criado, b.criado].filter(Boolean)).toHaveLength(1);
  });

  it("telefones diferentes viram DUAS pessoas, a segunda com sufixo", async () => {
    const banco = bancoDeMentira();

    const [a, b] = await Promise.all([
      receberLeadDoFlow({
        workspaceId: "w1",
        lead: lead("r-1", { nome: "Marina", sobrenome: "Alves", whatsapp: "5562996340438" }),
        deps: banco.deps(),
      }),
      receberLeadDoFlow({
        workspaceId: "w1",
        lead: lead("r-2", { nome: "Marina", sobrenome: "Alves", whatsapp: "5511987654321" }),
        deps: banco.deps(),
      }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.contatoId).not.toBe(b.contatoId);
    // Fundir seria irreversível: o histórico de uma viraria o da outra.
    expect(banco.criados).toHaveLength(2);
    expect(banco.criados).toContain("Marina Alves");
    expect(banco.criados.some((n) => n.startsWith("Marina Alves ("))).toBe(true);
  });

  it("sem telefone nenhum ainda assim não funde as duas", async () => {
    const banco = bancoDeMentira();
    const [a, b] = await Promise.all([
      receberLeadDoFlow({ workspaceId: "w1", lead: lead("r-1", { nome: "Marina Alves" }), deps: banco.deps() }),
      receberLeadDoFlow({ workspaceId: "w1", lead: lead("r-2", { nome: "Marina Alves" }), deps: banco.deps() }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(banco.criados).toHaveLength(2);
  });
});

describe("duas chamadas com a MESMA entrega", () => {
  it("uma cria e a outra devolve duplicado, nenhuma estoura", async () => {
    const banco = bancoDeMentira();
    const mesmo = lead("r-igual", { nome: "Ana", sobrenome: "Souza", whatsapp: "5562996340438" });

    const [a, b] = await Promise.all([
      receberLeadDoFlow({ workspaceId: "w1", lead: mesmo, deps: banco.deps() }),
      receberLeadDoFlow({ workspaceId: "w1", lead: mesmo, deps: banco.deps() }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Uma delas tem que ser a repetição, e as duas apontam pro mesmo contato.
    expect([a.duplicado, b.duplicado].filter(Boolean)).toHaveLength(1);
    expect(a.contatoId).toBe(b.contatoId);
    expect(banco.criados).toEqual(["Ana Souza"]);
    expect(banco.entregas.size).toBe(1);
  });
});

describe("erro que não é corrida", () => {
  it("continua subindo, em vez de virar uma repetição infinita", async () => {
    const banco = bancoDeMentira();
    const deps = banco.deps();
    deps.criarContato = async () => {
      throw new Error("banco fora do ar");
    };
    await expect(
      receberLeadDoFlow({ workspaceId: "w1", lead: lead("r-1", { nome: "Ana" }), deps }),
    ).rejects.toThrow("banco fora do ar");
  });

  it("repete a decisão UMA vez só: chave duplicada sem fim vira erro, não laço", async () => {
    const banco = bancoDeMentira();
    const deps = banco.deps();
    let tentativas = 0;
    deps.criarContato = async () => {
      tentativas++;
      throw duplicada();
    };
    await expect(
      receberLeadDoFlow({ workspaceId: "w1", lead: lead("r-1", { nome: "Ana" }), deps }),
    ).rejects.toMatchObject({ code: "P2002" });
    // Três passadas, e para. O limite é o que separa "refazer a decisão" de um laço que esconderia
    // um defeito de verdade (banco com o id errado, por exemplo) repetindo pra sempre.
    expect(tentativas).toBe(3);
  });
});

describe("a mesma entrega com reunião, duas vezes ao mesmo tempo", () => {
  it("marca UM compromisso só", async () => {
    // A corrida de verdade: as duas chamadas passam pela conferência de idempotência antes de
    // qualquer uma gravar. Quem resolve é a chave primária do compromisso, derivada da entrega.
    const banco = bancoDeMentira();
    const mesmo = lead(
      "r-reuniao",
      { nome: "Ana", sobrenome: "Souza", whatsapp: "5562996340438" },
      { reuniao: { inicio: "2026-10-21T02:30:00.000Z", fim: null, link: null } },
    );

    const [a, b] = await Promise.all([
      receberLeadDoFlow({ workspaceId: "w1", lead: mesmo, deps: banco.deps() }),
      receberLeadDoFlow({ workspaceId: "w1", lead: mesmo, deps: banco.deps() }),
    ]);

    expect(a.ok && b.ok).toBe(true);
    expect(banco.compromissos.size).toBe(1);
    // E com o dia de BRASÍLIA: 02h30 de 21/10 em UTC é 23h30 de 20/10 aqui.
    expect([...banco.compromissos.values()][0]).toMatchObject({ dataIso: "2026-10-20", hora: "23:30" });
  });
});

/**
 * A matriz que o teste com banco de verdade mediu em 14/10/2026, agora como regressão.
 *
 * Os números de antes, com N chamadas simultâneas e 25 rodadas por célula:
 *
 *   pessoas diferentes, mesmo nome ...... N=2: 25/25 limpas  ·  N=3: 0/25 (500 na chave primária)
 *   mesma pessoa, entregas diferentes ... N=2: 22/25         ·  N=3: 9/25  (card duplicado)
 *   mesma entrega (mesma chave) ......... N=2: 24/25         ·  N=3: 5/25  (card duplicado)
 *
 * O esperado agora, pra qualquer N: nenhuma exceção, um contato por pessoa, um card por pessoa e
 * um registro de entrega por chave de idempotência.
 */
describe("a matriz de corrida, com 2, 3 e 8 chamadas", () => {
  const RODADAS = 20;
  const PARALELAS = [2, 3, 8];

  for (const n of PARALELAS) {
    it(`${n} pessoas DIFERENTES com o mesmo nome: ${n} contatos, ${n} cards, nenhum erro`, async () => {
      for (let rodada = 0; rodada < RODADAS; rodada++) {
        const banco = bancoDeMentira();
        const chamadas = Array.from({ length: n }, (_, i) =>
          receberLeadDoFlow({
            workspaceId: "w1",
            // Telefones diferentes: são pessoas diferentes, e fundi-las é irreversível.
            lead: lead(`r${rodada}-${i}`, { nome: "Marina", sobrenome: "Alves", whatsapp: `556299634000${i}` }),
            deps: banco.deps(),
          }),
        );
        const r = await Promise.all(chamadas);
        expect(r.every((x) => x.ok), `rodada ${rodada}`).toBe(true);
        expect(banco.criados, `rodada ${rodada}`).toHaveLength(n);
        expect(banco.cards.size, `rodada ${rodada}`).toBe(n);
        expect(banco.entregas.size, `rodada ${rodada}`).toBe(n);
      }
    });

    it(`${n} entregas DIFERENTES da mesma pessoa: 1 contato, 1 card, nenhum erro`, async () => {
      for (let rodada = 0; rodada < RODADAS; rodada++) {
        const banco = bancoDeMentira();
        const mesma = { nome: "Ana", sobrenome: "Souza", whatsapp: "5562996340438" };
        const r = await Promise.all(
          Array.from({ length: n }, (_, i) =>
            receberLeadDoFlow({ workspaceId: "w1", lead: lead(`r${rodada}-${i}`, mesma), deps: banco.deps() }),
          ),
        );
        expect(r.every((x) => x.ok), `rodada ${rodada}`).toBe(true);
        expect(banco.criados, `rodada ${rodada}`).toEqual(["Ana Souza"]);
        // O que NÃO se curava sozinho: a resposta era 200, então o Flow não repetia e os dois cards
        // ficavam. Agora é um.
        expect(banco.cards.size, `rodada ${rodada}`).toBe(1);
        expect(banco.entregas.size, `rodada ${rodada}`).toBe(n);
        expect(new Set(r.map((x) => x.contatoId)).size, `rodada ${rodada}`).toBe(1);
      }
    });

    it(`${n} chamadas da MESMA entrega: 1 contato, 1 card, 1 registro`, async () => {
      for (let rodada = 0; rodada < RODADAS; rodada++) {
        const banco = bancoDeMentira();
        const mesma = lead(`r${rodada}`, { nome: "Ana", sobrenome: "Souza", whatsapp: "5562996340438" });
        const r = await Promise.all(
          Array.from({ length: n }, () => receberLeadDoFlow({ workspaceId: "w1", lead: mesma, deps: banco.deps() })),
        );
        expect(r.every((x) => x.ok), `rodada ${rodada}`).toBe(true);
        expect(banco.criados, `rodada ${rodada}`).toEqual(["Ana Souza"]);
        expect(banco.cards.size, `rodada ${rodada}`).toBe(1);
        expect(banco.entregas.size, `rodada ${rodada}`).toBe(1);
        // Uma vence e grava a entrega; as outras devolvem o resultado dela.
        expect(r.filter((x) => x.duplicado).length, `rodada ${rodada}`).toBe(n - 1);
      }
    });
  }
});

/**
 * As três passadas, exercitadas onde elas são o que salva.
 *
 * A matriz acima passa até com duas passadas, porque a regra "na última passada usa o id da
 * entrega" já cobre o caso em que a leitura seguinte vê o nome ocupado. O que exige a terceira é a
 * leitura DESATUALIZADA: conexões vêm de um pool, e uma delas pode responder "esse nome está
 * livre" para um nome que outra chamada acabou de gravar. Aí a passada 1 volta a disputar o mesmo
 * nome e colide de novo — e sem a passada 2 isso é um 500.
 *
 * É o cenário que o teste com banco de verdade mediu como 0 de 25 rodadas limpas com N=3.
 */
describe("leitura desatualizada do nome ocupado", () => {
  function depsComLeituraAtrasada(banco: ReturnType<typeof bancoDeMentira>, mentirasSeguidas: number) {
    const deps = banco.deps();
    const nomeOcupadoDeVerdade = deps.nomeOcupado;
    let restantes = mentirasSeguidas;
    deps.nomeOcupado = async (nome) => {
      // Finge que está livre nas primeiras vezes: é o que uma réplica atrasada responderia.
      if (restantes > 0) {
        restantes--;
        return false;
      }
      return nomeOcupadoDeVerdade(nome);
    };
    return deps;
  }

  it("colidir duas vezes no mesmo nome ainda não vira 500", async () => {
    const banco = bancoDeMentira();
    // O concorrente já gravou o nome base e o nome com o formulário.
    await receberLeadDoFlow({
      workspaceId: "w1",
      lead: lead("r-dono", { nome: "Marina", sobrenome: "Alves", whatsapp: "5562990000001" }),
      deps: banco.deps(),
    });
    await receberLeadDoFlow({
      workspaceId: "w1",
      lead: lead("r-dono-2", { nome: "Marina", sobrenome: "Alves", whatsapp: "5562990000002" }),
      deps: banco.deps(),
    });

    const r = await receberLeadDoFlow({
      workspaceId: "w1",
      lead: lead("r-ultimo", { nome: "Marina", sobrenome: "Alves", whatsapp: "5562990000003" }),
      // Mente nas duas primeiras conferências: as passadas 0 e 1 colidem de verdade.
      deps: depsComLeituraAtrasada(banco, 2),
    });

    expect(r.ok).toBe(true);
    expect(r.criado).toBe(true);
    // Entrou com o nome desempatado pelo id da entrega, que é único por definição.
    expect(banco.criados).toHaveLength(3);
    expect(banco.criados[2]).toContain("ultimo");
    expect(banco.cards.size).toBe(3);
  });

  it("colidir três vezes continua subindo o erro, em vez de virar laço", async () => {
    const banco = bancoDeMentira();
    const deps = banco.deps();
    deps.nomeOcupado = async () => false;
    const criarDeVerdade = deps.criarContato;
    deps.criarContato = async (dados) => {
      await criarDeVerdade({ ...dados, nome: `ocupa-${Math.random()}` });
      throw duplicada();
    };
    await expect(
      receberLeadDoFlow({ workspaceId: "w1", lead: lead("r-1", { nome: "Ana" }), deps }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
