import { describe, expect, it, vi } from "vitest";

import { receberListaDoFlow, type DependenciasDaLista } from "@/lib/integracoes/azuz-flow-lista";
import type { PayloadDaLista } from "@/lib/integracoes/azuz-flow-lista-payload";

/**
 * A COLUNA DO FLOW ENTRANDO NO CRM, provada sem banco.
 *
 * O que estes testes protegem não é o caminho feliz: é o conjunto de coisas que a rota tem que
 * DEIXAR DE FAZER. Não sobrescrever o que a agência digitou, não mover card que ela não mandou
 * mover, não disparar gatilho pra quem já estava na etapa, não inventar consentimento. Cada uma
 * dessas, errada, é uma mensagem indo pra pessoa errada — e a agência só descobre pelo cliente.
 */

const LEAD = {
  id: "lead-flow-1",
  nome: "Maria Silva",
  email: "maria@exemplo.com",
  whatsapp: "5562996340438",
  empresa: null,
  instagram: null,
  segmento: null,
};

const PAYLOAD: PayloadDaLista = {
  origem: { listaId: "uuid-1", rotulo: "Flow: No show" },
  destino: { funilId: "fun_def", etapaId: "et_9", seJaTemCard: "manter" },
  leads: [LEAD],
};

function deps(sobrescrever: Partial<DependenciasDaLista> = {}): DependenciasDaLista {
  return {
    conferirDestino: vi.fn(async () => ({ ok: true as const })),
    acharContatoPorTelefone: vi.fn(async () => null),
    acharContatoPorEmail: vi.fn(async () => null),
    acharContatoPorNome: vi.fn(async () => null),
    lerContato: vi.fn(async () => null),
    nomeOcupado: vi.fn(async () => false),
    criarContato: vi.fn(async (d) => ({ id: "c1", nome: d.nome })),
    atualizarContato: vi.fn(async () => {}),
    garantirConversa: vi.fn(async () => ({ id: "conv1" })),
    cardNoFunil: vi.fn(async () => null),
    criarCard: vi.fn(async () => ({ id: "card1", etapaId: "et_9" })),
    moverCard: vi.fn(async () => {}),
    dispararGatilhoDaEtapa: vi.fn(async () => {}),
    ...sobrescrever,
  };
}

async function rodar(payload: PayloadDaLista, d: DependenciasDaLista) {
  const r = await receberListaDoFlow({ payload, deps: d });
  if ("erro" in r) throw new Error(r.erro);
  return r;
}

describe("destino", () => {
  it("funil ou etapa de outra empresa recusa a lista INTEIRA, sem escrever nada", () => {
    /*
     * 422, nunca "encontrado". E antes do primeiro lead: recusar no meio deixaria metade da coluna
     * dentro do CRM e a pessoa sem saber quais.
     */
    const d = deps({ conferirDestino: vi.fn(async () => ({ ok: false as const, erro: "Essa etapa não é deste funil." })) });
    return receberListaDoFlow({ payload: PAYLOAD, deps: d }).then((r) => {
      expect(r).toEqual({ erro: "Essa etapa não é deste funil." });
      expect(d.criarContato).not.toHaveBeenCalled();
      expect(d.criarCard).not.toHaveBeenCalled();
    });
  });
});

describe("o contato", () => {
  it("não existia: cria, carimba a etiqueta e abre o card", async () => {
    const d = deps();
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados).toEqual([{ id: "lead-flow-1", contato: "criado", card: "criado", aviso: null }]);
    expect(d.criarContato).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Maria Silva", whatsapp: "5562996340438", origem: "AZUZ Flow" }),
    );
    expect(d.atualizarContato).toHaveBeenCalledWith("Maria Silva", { etiquetas: ["Flow: No show"] });
  });

  it("acha pelo WhatsApp antes do e-mail e do nome", async () => {
    // A ordem vai do mais identificador pro menos: telefone é único por pessoa, nome é o mais
    // fraco dos três. Inverter funde pessoas diferentes num contato só — o único erro daqui que
    // não dá pra desfazer depois.
    const d = deps({
      acharContatoPorTelefone: vi.fn(async () => ({ id: "c9", nome: "Maria (cliente)" })),
      acharContatoPorEmail: vi.fn(async () => ({ id: "cX", nome: "errada" })),
    });
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados[0].contato).toBe("existente");
    expect(d.acharContatoPorEmail).not.toHaveBeenCalled();
    expect(d.criarContato).not.toHaveBeenCalled();
  });

  it("acha pelo e-mail quando o telefone não achou", async () => {
    const d = deps({ acharContatoPorEmail: vi.fn(async () => ({ id: "c9", nome: "Maria" })) });
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados[0].contato).toBe("existente");
  });

  it("acha pelo NOME em último caso", async () => {
    const d = deps({ acharContatoPorNome: vi.fn(async () => ({ id: "c9", nome: "Maria Silva" })) });
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados[0].contato).toBe("existente");
    expect(d.acharContatoPorNome).toHaveBeenCalledWith("Maria Silva");
  });

  it("NÃO sobrescreve campo que a agência já preencheu", async () => {
    /*
     * O dado do Flow é de um formulário respondido por um desconhecido; o do CRM foi digitado por
     * quem falou com a pessoa. Discordando, quem está certo é o segundo — e descobrir isso por
     * cima de um telefone trocado custa uma ligação pra quem não é mais cliente.
     */
    const d = deps({
      acharContatoPorTelefone: vi.fn(async () => ({ id: "c9", nome: "Maria" })),
      lerContato: vi.fn(async () => ({ whatsapp: "5562999990000", email: null, etiquetas: [] })),
    });
    await rodar(PAYLOAD, d);
    const gravado = (d.atualizarContato as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(gravado).not.toHaveProperty("whatsapp");
    expect(gravado.email).toBe("maria@exemplo.com");
  });

  it("homônimo entra com sufixo, e a resposta avisa", async () => {
    const d = deps({ nomeOcupado: vi.fn(async () => true) });
    const r = await rodar(PAYLOAD, d);
    expect(d.criarContato).toHaveBeenCalledWith(expect.objectContaining({ nome: "Maria Silva (flow-1)" }));
    expect(r.resultados[0].aviso).toMatch(/Já havia outro contato/);
  });

  it("a etiqueta não é regravada quando já está lá", async () => {
    // Ela é carimbo do envio, não espelho da coluna do Flow: regravar à toa só gera escrita.
    const d = deps({
      acharContatoPorTelefone: vi.fn(async () => ({ id: "c9", nome: "Maria" })),
      lerContato: vi.fn(async () => ({ etiquetas: ["Flow: No show"], whatsapp: "5562996340438", email: "maria@exemplo.com" })),
    });
    await rodar(PAYLOAD, d);
    expect(d.atualizarContato).not.toHaveBeenCalled();
  });
});

describe("o card e o gatilho da etapa", () => {
  it("card novo dispara o gatilho `criado` UMA vez", async () => {
    const d = deps();
    await rodar(PAYLOAD, d);
    expect(d.dispararGatilhoDaEtapa).toHaveBeenCalledTimes(1);
    expect(d.dispararGatilhoDaEtapa).toHaveBeenCalledWith({
      etapaId: "et_9",
      contatoNome: "Maria Silva",
      evento: "criado",
    });
  });

  it("já tinha card NA MESMA etapa: não move e NÃO dispara", async () => {
    /*
     * Ele não ENTROU na etapa agora. Disparar aqui faria o reenvio da mesma coluna mandar a
     * sequência de mensagens de novo pra quem já recebeu — que é a forma mais rápida de a agência
     * queimar o número dela.
     */
    const d = deps({ cardNoFunil: vi.fn(async () => ({ id: "card1", etapaId: "et_9" })) });
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados[0].card).toBe("ja_estava");
    expect(d.dispararGatilhoDaEtapa).not.toHaveBeenCalled();
    expect(d.moverCard).not.toHaveBeenCalled();
  });

  it("com \"manter\", card em outra etapa fica onde está e o aviso explica", async () => {
    const d = deps({ cardNoFunil: vi.fn(async () => ({ id: "card1", etapaId: "et_outra" })) });
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados[0].card).toBe("ja_estava");
    expect(r.resultados[0].aviso).toMatch(/mantido onde estava/i);
    expect(d.moverCard).not.toHaveBeenCalled();
    expect(d.dispararGatilhoDaEtapa).not.toHaveBeenCalled();
  });

  it("com \"mover\", card em outra etapa vai pro destino e dispara `movido`", async () => {
    const d = deps({ cardNoFunil: vi.fn(async () => ({ id: "card1", etapaId: "et_outra" })) });
    const r = await rodar({ ...PAYLOAD, destino: { ...PAYLOAD.destino, seJaTemCard: "mover" } }, d);
    expect(r.resultados[0].card).toBe("movido");
    expect(d.moverCard).toHaveBeenCalledWith({ cardId: "card1", etapaId: "et_9" });
    expect(d.dispararGatilhoDaEtapa).toHaveBeenCalledWith({
      etapaId: "et_9",
      contatoNome: "Maria Silva",
      evento: "movido",
    });
  });

  it("com \"mover\" e já na etapa certa, continua sem disparar", async () => {
    const d = deps({ cardNoFunil: vi.fn(async () => ({ id: "card1", etapaId: "et_9" })) });
    const r = await rodar({ ...PAYLOAD, destino: { ...PAYLOAD.destino, seJaTemCard: "mover" } }, d);
    expect(r.resultados[0].card).toBe("ja_estava");
    expect(d.dispararGatilhoDaEtapa).not.toHaveBeenCalled();
  });

  it("conversa arquivada ou grupo: contato entra, card não, e o aviso diz por quê", async () => {
    // São regras do CRM, e elas valem aqui também: arquivar é "isso não está em atendimento", e um
    // envio de lista não pode desfazer isso por fora.
    const d = deps({ criarCard: vi.fn(async () => null) });
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados[0]).toMatchObject({ contato: "criado", card: "sem_card" });
    expect(r.resultados[0].aviso).toMatch(/arquivada ou é um grupo/i);
    expect(d.dispararGatilhoDaEtapa).not.toHaveBeenCalled();
  });
});

describe("a conversa", () => {
  it("é criada pra quem tem WhatsApp — é ela que deixa a automação falar", async () => {
    const d = deps();
    await rodar(PAYLOAD, d);
    expect(d.garantirConversa).toHaveBeenCalledWith({
      nome: "Maria Silva",
      telefone: "5562996340438",
      contatoId: "c1",
    });
  });

  it("lead só com e-mail entra no funil do mesmo jeito, sem conversa", async () => {
    const d = deps();
    const r = await rodar({ ...PAYLOAD, leads: [{ ...LEAD, whatsapp: null }] }, d);
    expect(d.garantirConversa).not.toHaveBeenCalled();
    expect(r.resultados[0].card).toBe("criado");
  });

  it("canal indisponível não derruba o card: o aviso diz que a mensagem pode não sair", async () => {
    const d = deps({
      garantirConversa: vi.fn(async () => ({ erro: "Nenhum WhatsApp conectado: a mensagem pode não sair." })),
    });
    const r = await rodar(PAYLOAD, d);
    expect(r.resultados[0].card).toBe("criado");
    expect(r.resultados[0].aviso).toMatch(/pode não sair/i);
  });
});

describe("o lote", () => {
  it("um lead que estoura não derruba os outros", async () => {
    /*
     * Derrubar o lote inteiro é o que faz a agência clicar de novo e de novo — e cada clique é
     * uma coluna inteira reentrando no CRM.
     */
    let chamada = 0;
    const d = deps({
      criarContato: vi.fn(async (dados) => {
        chamada += 1;
        if (chamada === 1) throw new Error("banco fora");
        return { id: "c2", nome: dados.nome };
      }),
    });
    const r = await rodar({ ...PAYLOAD, leads: [LEAD, { ...LEAD, id: "lead-flow-2", nome: "João" }] }, d);
    expect(r.resultados[0]).toMatchObject({ id: "lead-flow-1", contato: "ignorado" });
    expect(r.resultados[1]).toMatchObject({ id: "lead-flow-2", contato: "criado", card: "criado" });
  });

  it("os resultados saem na MESMA ordem e pelo id do Flow", async () => {
    const d = deps();
    const leads = [LEAD, { ...LEAD, id: "b" }, { ...LEAD, id: "c" }];
    const r = await rodar({ ...PAYLOAD, leads }, d);
    expect(r.resultados.map((x) => x.id)).toEqual(["lead-flow-1", "b", "c"]);
  });
});

describe("o que esta rota NÃO faz", () => {
  it("não existe caminho pra formulário nem pra confirmação de reunião", () => {
    /*
     * Prova estrutural, e é a mais forte que cabe aqui: a lista de dependências é a superfície
     * inteira que o miolo pode tocar. Não havendo nela nada de formulário ou de confirmação, não
     * há como disparar um sem alguém ACRESCENTAR a dependência — que é uma mudança visível na
     * revisão, não um efeito colateral.
     */
    const nomes = Object.keys(deps());
    expect(nomes.join(" ")).not.toMatch(/formulario|confirmacao|reuniao/i);
    expect(nomes).toContain("dispararGatilhoDaEtapa");
  });

  it("não grava consentimento: nem true, nem false", async () => {
    // O lead do Flow não carrega essa informação. `true` inventa permissão; `false` bloqueia
    // modelo pra quem talvez possa receber. A guarda do CRM (`=== false`) segue valendo sozinha.
    const d = deps();
    await rodar(PAYLOAD, d);
    const criado = (d.criarContato as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(criado).not.toHaveProperty("consentimentoWhatsApp");
  });
});
