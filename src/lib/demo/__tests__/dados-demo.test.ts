import { describe, expect, it } from "vitest";

import {
  CONTATOS_DEMO,
  CONVERSAS_DEMO,
  EMAIL_DEMO,
  ETAPAS_DEMO,
  FECHADOS_DEMO,
  RESPONSAVEIS_DEMO,
  TAREFAS_DEMO,
  WORKSPACE_DEMO,
  iniciais,
  resumoDaDemo,
  telefoneDemo,
} from "../dados-demo";

/**
 * O que estes testes protegem: a conta de demonstração é o que vai aparecer num vídeo público e
 * numa reunião de venda. Duas coisas podem dar errado, e as duas são caras.
 *
 * A primeira é vazar dado real. Se alguém um dia colar aqui um contato de verdade "só pra testar",
 * o nome e o telefone dessa pessoa vão parar no YouTube.
 *
 * A segunda é a demonstração ficar incoerente: contato cuja etapa não existe no funil, conversa
 * sem contato correspondente, tarefa apontando pra ninguém. Nada disso quebra o sistema, então
 * ninguém descobre por erro: descobre ao vivo, na frente do cliente, com uma tela meio vazia.
 */

describe("dados da demonstração", () => {
  it("toda conversa pertence a um contato que existe", () => {
    const nomes = new Set(CONTATOS_DEMO.map((c) => c.nome));
    for (const nome of Object.keys(CONVERSAS_DEMO)) {
      expect(nomes, `conversa de "${nome}" não tem contato`).toContain(nome);
    }
  });

  it("todo contato tem conversa, pra nenhuma ficar vazia na tela", () => {
    for (const contato of CONTATOS_DEMO) {
      expect(CONVERSAS_DEMO[contato.nome], `"${contato.nome}" sem conversa`).toBeDefined();
    }
  });

  it("toda etapa de contato existe no funil", () => {
    for (const contato of CONTATOS_DEMO) {
      expect(ETAPAS_DEMO as readonly string[], `etapa de "${contato.nome}"`).toContain(contato.etapa);
    }
  });

  it("todo responsável é alguém da equipe da demonstração", () => {
    const equipe = RESPONSAVEIS_DEMO as readonly string[];
    for (const contato of CONTATOS_DEMO) expect(equipe).toContain(contato.responsavel);
    for (const tarefa of TAREFAS_DEMO) expect(equipe).toContain(tarefa.responsavel);
  });

  it("toda tarefa aponta pra um contato que existe", () => {
    const nomes = new Set(CONTATOS_DEMO.map((c) => c.nome));
    for (const tarefa of TAREFAS_DEMO) {
      expect(nomes, `tarefa "${tarefa.titulo}"`).toContain(tarefa.contato);
    }
  });

  // A última mensagem da conversa é o que aparece na lista. Se não bater com o campo `ultima` do
  // contato, a mesma pessoa mostra duas frases diferentes em duas telas, e isso salta aos olhos
  // justamente em quem está avaliando o produto.
  it("a prévia do contato é a última mensagem da conversa", () => {
    for (const contato of CONTATOS_DEMO) {
      const msgs = CONVERSAS_DEMO[contato.nome];
      const ultima = msgs.reduce((a, b) => (b.minutosAtras < a.minutosAtras ? b : a));
      expect(ultima.texto, `prévia de "${contato.nome}"`).toBe(contato.ultima);
    }
  });

  it("tem tarefa atrasada e tarefa concluída, senão a tela não mostra nada", () => {
    expect(TAREFAS_DEMO.some((t) => t.diasAteOVencimento < 0 && !t.concluida)).toBe(true);
    expect(TAREFAS_DEMO.some((t) => t.concluida)).toBe(true);
  });

  it("tem negócio ganho e perdido, pra Motivos de perda não abrir vazia", () => {
    expect(FECHADOS_DEMO.some((f) => f.status === "ganho")).toBe(true);
    expect(FECHADOS_DEMO.filter((f) => f.status === "perdido").length).toBeGreaterThanOrEqual(3);
  });

  it("todo negócio perdido tem motivo", () => {
    for (const f of FECHADOS_DEMO.filter((x) => x.status === "perdido")) {
      expect(f.motivo, `"${f.nome}" perdido sem motivo`).toBeTruthy();
    }
  });

  it("os dois canais aparecem, porque o produto tem os dois", () => {
    const canais = new Set(CONTATOS_DEMO.map((c) => c.canal));
    expect(canais).toContain("WhatsApp");
    expect(canais).toContain("Instagram");
  });

  // O motivo de existir: isto vai para um vídeo público.
  it("nenhum e-mail é de domínio real", () => {
    for (const contato of CONTATOS_DEMO) {
      expect(contato.email, `e-mail de "${contato.nome}"`).toMatch(/@exemplo\.com\.br$/);
    }
    expect(EMAIL_DEMO).toMatch(/@azuzcrm\.com\.br$/);
  });

  it("os telefones seguem o bloco artificial e não se repetem", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < CONTATOS_DEMO.length; i += 1) {
      const tel = telefoneDemo(i);
      expect(tel).toMatch(/^\(11\) 9\d{4}-\d{4}$/);
      expect(vistos.has(tel), `telefone repetido: ${tel}`).toBe(false);
      vistos.add(tel);
    }
  });

  it("o workspace da demonstração tem identificador próprio e fixo", () => {
    // Fixo de propósito: é ele que a rota confere antes de apagar qualquer coisa.
    expect(WORKSPACE_DEMO).toBe("demonstracao");
  });

  it("tem volume suficiente pra demonstração não parecer vazia", () => {
    const resumo = resumoDaDemo();
    expect(resumo.contatos).toBeGreaterThanOrEqual(10);
    expect(resumo.mensagens).toBeGreaterThanOrEqual(25);
  });
});

describe("iniciais", () => {
  it("usa as duas primeiras palavras", () => {
    expect(iniciais("Amanda Ribeiro")).toBe("AR");
  });

  it("aguenta nome de uma palavra só", () => {
    expect(iniciais("Amanda")).toBe("A");
  });

  it("ignora espaço sobrando", () => {
    expect(iniciais("  Bruno   Carvalho ")).toBe("BC");
  });
});
