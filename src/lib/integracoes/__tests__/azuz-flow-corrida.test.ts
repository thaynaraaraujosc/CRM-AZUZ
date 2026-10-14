import { beforeEach, describe, expect, it, vi } from "vitest";

import { receberLeadDoFlow, type DependenciasDoFlow, type ResultadoDoLead } from "../azuz-flow-lead";
import { validarPayloadDoFlow, type LeadDoFlow } from "../azuz-flow-payload";

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
      contaOficial: async () => ({ phoneNumberId: "111" }),
      garantirConversa: async () => ({ id: "conv" }),
      temCardNoFunil: async () => false,
      entrarNoFunil: async () => ({ funil: "Comercial", etapa: "Novo" }),
      subirCard: async () => {},
      avisarContatoCriado: () => {},
      dispararAutomacoes: async () => {},
    };
  }

  return { deps, contatosPorNome, entregas, criados };
}

function lead(respostaId: string, dadosDoLead: Record<string, unknown>): LeadDoFlow {
  const r = validarPayloadDoFlow({
    origem: { formularioId: "f1", formularioNome: "Consultoria grátis", respostaId },
    lead: dadosDoLead,
    respostas: [],
    consentimento: { whatsapp: { aceitou: true, texto: null, em: null } },
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
    expect(tentativas).toBe(2);
  });
});
