import { beforeEach, describe, expect, it, vi } from "vitest";

import { decidirConsentimento, receberLeadDoFlow, type DependenciasDoFlow, type ResultadoDoLead } from "../azuz-flow-lead";
import { validarPayloadDoFlow, type LeadDoFlow } from "../azuz-flow-payload";

/**
 * As dependências são injetadas, então aqui dá pra exercitar a ORDEM e as decisões sem banco.
 *
 * A ordem é o que mais importa nesta função: a automação que manda o modelo só funciona se a
 * conversa já existir quando ela dispara. Esse defeito não aparece em teste que mocke no nível do
 * Prisma — aparece aqui, olhando a sequência das chamadas.
 */
function fazerDeps(ajustes: Partial<DependenciasDoFlow> = {}) {
  const ordem: string[] = [];
  const entregas = new Map<string, ResultadoDoLead>();

  const deps: DependenciasDoFlow = {
    acharEntregaAnterior: vi.fn(async (chave) => entregas.get(chave) ?? null),
    gravarEntrega: vi.fn(async ({ chave, resultado }) => {
      ordem.push("gravarEntrega");
      entregas.set(chave, resultado);
    }),
    acharContatoPorTelefone: vi.fn(async () => null),
    acharContatoPorEmail: vi.fn(async () => null),
    nomeOcupado: vi.fn(async () => false),
    lerContato: vi.fn(async () => null),
    criarContato: vi.fn(async ({ nome }) => {
      ordem.push("criarContato");
      return { id: `c-${nome}`, nome };
    }),
    atualizarContato: vi.fn(async () => {
      ordem.push("atualizarContato");
    }),
    anotarNaLinhaDoTempo: vi.fn(async () => {
      ordem.push("linhaDoTempo");
    }),
    contaOficial: vi.fn(async () => ({ phoneNumberId: "111" })),
    garantirConversa: vi.fn(async () => {
      ordem.push("garantirConversa");
      return { id: "conv-1" };
    }),
    temCardNoFunil: vi.fn(async () => false),
    entrarNoFunil: vi.fn(async () => {
      ordem.push("entrarNoFunil");
      return { funil: "Comercial", etapa: "Novo" };
    }),
    subirCard: vi.fn(async () => {
      ordem.push("subirCard");
    }),
    avisarContatoCriado: vi.fn(() => {
      ordem.push("avisarContatoCriado");
    }),
    dispararAutomacoes: vi.fn(async () => {
      ordem.push("dispararAutomacoes");
    }),
    ...ajustes,
  };
  return { deps, ordem, entregas };
}

function lead(extra: Record<string, unknown> = {}): LeadDoFlow {
  const r = validarPayloadDoFlow({
    origem: { formularioId: "f1", formularioNome: "Diagnóstico", respostaId: "resp-1" },
    lead: { nome: "Ana", sobrenome: "Souza", email: "ana@exemplo.com", whatsapp: "5562996340438" },
    respostas: [{ pergunta: "Faturamento?", resposta: "50 mil" }],
    consentimento: { whatsapp: { aceitou: true, texto: "Aceito", em: null } },
    ...extra,
  });
  if (!r.ok) throw new Error(`payload do teste inválido: ${r.erro}`);
  return r.lead;
}

beforeEach(() => vi.clearAllMocks());

describe("receberLeadDoFlow", () => {
  it("cria contato, conversa e card, e só então dispara a automação", async () => {
    const { deps, ordem } = fazerDeps();
    const r = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });

    expect(r.criado).toBe(true);
    expect(r.conversaId).toBe("conv-1");
    expect(r.etapa).toEqual({ funil: "Comercial", etapa: "Novo" });

    // A GARANTIA CENTRAL: conversa e card existem ANTES da automação. Sem isso o bloco "Enviar
    // modelo do WhatsApp" falha com "conversa sem destinatário" e o lead nunca recebe nada.
    expect(ordem.indexOf("garantirConversa")).toBeLessThan(ordem.indexOf("dispararAutomacoes"));
    expect(ordem.indexOf("entrarNoFunil")).toBeLessThan(ordem.indexOf("dispararAutomacoes"));
    // E a entrega fica registrada antes da automação: morrer no meio não pode gerar lead dobrado.
    expect(ordem.indexOf("gravarEntrega")).toBeLessThan(ordem.indexOf("dispararAutomacoes"));
  });

  it("entrega repetida devolve o mesmo resultado e não cria nada de novo", async () => {
    const { deps, ordem } = fazerDeps();
    const primeira = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });
    ordem.length = 0;

    const segunda = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });
    expect(segunda.duplicado).toBe(true);
    expect(segunda.contatoId).toBe(primeira.contatoId);
    // Nada aconteceu na segunda vez: nem contato, nem card, nem automação.
    expect(ordem).toEqual([]);
    expect(deps.criarContato).toHaveBeenCalledTimes(1);
    expect(deps.dispararAutomacoes).toHaveBeenCalledTimes(1);
  });

  it("nome igual e telefone diferente são DUAS pessoas, não uma", async () => {
    const { deps } = fazerDeps({ nomeOcupado: vi.fn(async (nome) => nome === "Ana Souza") });
    const r = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });

    // Fundir seria irreversível: o histórico de uma passaria a ser o da outra.
    expect(deps.criarContato).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Ana Souza (Diagnóstico)" }),
    );
    expect(r.avisos.join(" ")).toContain("Já havia outro contato");
  });

  it("contato achado pelo telefone só tem campo VAZIO completado, e não muda de etapa", async () => {
    const { deps } = fazerDeps({
      acharContatoPorTelefone: vi.fn(async () => ({ id: "c-9", nome: "Ana Souza" })),
      lerContato: vi.fn(async () => ({ email: "outro@exemplo.com", empresa: null, etiquetas: ["VIP"] })),
      temCardNoFunil: vi.fn(async () => true),
    });
    const r = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });

    expect(r.criado).toBe(false);
    const dados = (deps.atualizarContato as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    // O e-mail que a equipe já tinha confirmado não é trocado por um formulário preenchido às pressas.
    expect(dados.email).toBeUndefined();
    // A etiqueta que já existia continua.
    expect(dados.etiquetas).toContain("VIP");
    expect(dados.etiquetas).toContain("Flow: Diagnóstico");
    // Já estava no funil: sobe, não volta pro começo.
    expect(deps.subirCard).toHaveBeenCalled();
    expect(deps.entrarNoFunil).not.toHaveBeenCalled();
  });

  it("acha pelo e-mail quando não veio telefone", async () => {
    const { deps } = fazerDeps({ acharContatoPorEmail: vi.fn(async () => ({ id: "c-7", nome: "Ana Souza" })) });
    const r = await receberLeadDoFlow({
      workspaceId: "w1",
      lead: lead({ lead: { nome: "Ana", email: "ana@exemplo.com" } }),
      deps,
    });
    expect(r.criado).toBe(false);
    expect(r.contatoId).toBe("c-7");
  });

  it("sem WhatsApp oficial conectado o lead entra do mesmo jeito, sem conversa", async () => {
    const { deps } = fazerDeps({ contaOficial: vi.fn(async () => null) });
    const r = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });

    expect(r.whatsappOficialConectado).toBe(false);
    expect(r.conversaId).toBeNull();
    expect(deps.garantirConversa).not.toHaveBeenCalled();
    expect(r.avisos.join(" ")).toContain("não está conectado");
    // O que importa: o lead não se perde por causa de um canal desligado.
    expect(deps.criarContato).toHaveBeenCalled();
  });

  it("empresa sem funil recebe o contato mesmo assim", async () => {
    const { deps } = fazerDeps({ entrarNoFunil: vi.fn(async () => null) });
    const r = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });
    expect(r.etapa).toBeNull();
    expect(r.contatoId).toBeTruthy();
  });

  it("a empresa vem da chave, e nada que venha no corpo muda isso", async () => {
    const { deps } = fazerDeps();
    // O payload do contrato não tem campo de empresa, e nem um campo extra inventado por quem
    // chama pode virar um. Isolamento entre clientes é o que não se pode errar nunca.
    const comIntruso = lead({ workspaceId: "w2", lead: { nome: "Ana", empresa: "w2" } });
    await receberLeadDoFlow({ workspaceId: "w1", lead: comIntruso, deps });

    const criado = (deps.criarContato as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(criado.workspaceId).toBeUndefined();
    expect(Object.keys(comIntruso)).not.toContain("workspaceId");
  });

  it("automação que falha não derruba a entrega: o lead já está gravado", async () => {
    const { deps } = fazerDeps({
      dispararAutomacoes: vi.fn(async () => {
        throw new Error("fluxo quebrado");
      }),
    });
    const r = await receberLeadDoFlow({ workspaceId: "w1", lead: lead(), deps });
    // Devolver erro faria o Flow repetir uma entrega que deu certo, e aí seriam dois leads.
    expect(r.ok).toBe(true);
    expect(r.contatoId).toBeTruthy();
  });
});

describe("decidirConsentimento", () => {
  const base = { texto: "Aceito", em: new Date("2026-10-14T13:00:00Z"), origem: "azuz-flow:X" };

  it("grava true quando a pessoa marcou", () => {
    const r = decidirConsentimento({ ...base, novo: true, jaGravado: null, aceitou: true });
    expect(r.consentimentoWhatsApp).toBe(true);
  });

  it("grava false quando não havia nada gravado", () => {
    const r = decidirConsentimento({ ...base, novo: true, jaGravado: null, aceitou: false });
    expect(r.consentimentoWhatsApp).toBe(false);
  });

  it("NÃO revoga um consentimento anterior", () => {
    // A ausência de uma caixa marcada num formulário qualquer não é a pessoa pedindo pra parar.
    const r = decidirConsentimento({ ...base, novo: false, jaGravado: true, aceitou: false });
    expect(r).toEqual({});
  });
});
