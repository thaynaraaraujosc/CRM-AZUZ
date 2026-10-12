import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { semearDemo } from "../semear";
import { limparConteudoDaDemo } from "../limpar";
import { CONTATOS_DEMO, WORKSPACE_DEMO } from "../dados-demo";

/**
 * `limparConteudoDaDemo` contra um banco de verdade.
 *
 * O QUE ESTE TESTE PROTEGE: a função apaga, e a promessa que ela faz é cirúrgica — tira o cenário
 * semeado e deixa o que chegou de verdade. Essa promessa é a diferença entre limpar a tela pra
 * gravar um vídeo e perder a conversa de um cliente. Promessa de apagar não se confere lendo o
 * código; se confere criando a linha que NÃO pode sumir e olhando se ela continua lá depois.
 *
 * Pula sozinho sem banco, igual ao teste de `semear`. Como preparar, ver `src/lib/demo/README.md`.
 */

const URL_TESTE =
  process.env.TESTE_BANCO_URL ?? "mariadb://azuzd:azuzd123@127.0.0.1:3306/azuz_demo?connectionLimit=3";

let prisma: PrismaClient;
let temBanco = false;

try {
  prisma = new PrismaClient({ adapter: new PrismaMariaDb(URL_TESTE) });
  await prisma.workspace.count();
  temBanco = true;
} catch {
  temBanco = false;
}

const conditional = temBanco ? describe : describe.skip;

/** Uma conversa como as que o webhook grava: id `conversa-<workspace>-<slug>`, nada de `demo-`. */
const ID_CONVERSA_REAL = `conversa-${WORKSPACE_DEMO}-pessoa-de-verdade`;
const ID_CONTATO_REAL = `contato-${WORKSPACE_DEMO}-pessoa-de-verdade`;

afterAll(async () => {
  if (temBanco) {
    await prisma.conversa.deleteMany({ where: { id: ID_CONVERSA_REAL } }).catch(() => {});
    await prisma.contato.deleteMany({ where: { id: ID_CONTATO_REAL } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
});

conditional("limparConteudoDaDemo", () => {
  beforeAll(async () => {
    await semearDemo(prisma, "$2a$10$hashfalsoparaoteste000000000000000000000000000000000000");

    // Um contato e uma conversa que NÃO vieram do seed, como se tivessem chegado por webhook.
    await prisma.contato.create({
      data: {
        id: ID_CONTATO_REAL,
        workspaceId: WORKSPACE_DEMO,
        initials: "PV",
        nome: "Pessoa De Verdade",
        origem: "Direto",
        etapa: "Novo lead",
        responsavel: "Paula Mendes",
        ultima: "agora",
        valor: "R$ 0,00",
        whatsapp: "+55 62 99999-0000",
      },
    });
    await prisma.conversa.create({
      data: {
        id: ID_CONVERSA_REAL,
        workspaceId: WORKSPACE_DEMO,
        contatoId: ID_CONTATO_REAL,
        nome: "Pessoa De Verdade",
        initials: "PV",
        canal: "WhatsApp",
        contato: "+55 62 99999-0000",
        origem: "Direto",
      },
    });

    await limparConteudoDaDemo(prisma);
  });

  it("apaga os contatos semeados", async () => {
    const sobraram = await prisma.contato.count({
      where: { workspaceId: WORKSPACE_DEMO, id: { startsWith: "demo-" } },
    });
    expect(sobraram).toBe(0);
    expect(CONTATOS_DEMO.length).toBeGreaterThan(0);
  });

  it("apaga as conversas, mensagens, cards e tarefas semeados", async () => {
    const semeado = { workspaceId: WORKSPACE_DEMO, id: { startsWith: "demo-" } };
    expect(await prisma.conversa.count({ where: semeado })).toBe(0);
    expect(await prisma.mensagemExtra.count({ where: semeado })).toBe(0);
    expect(await prisma.negocioCard.count({ where: semeado })).toBe(0);
    expect(await prisma.tarefaCard.count({ where: semeado })).toBe(0);
  });

  // O ponto do teste inteiro.
  it("NÃO toca no que chegou de verdade", async () => {
    const contato = await prisma.contato.findUnique({ where: { id: ID_CONTATO_REAL } });
    const conversa = await prisma.conversa.findUnique({ where: { id: ID_CONVERSA_REAL } });
    expect(contato?.nome).toBe("Pessoa De Verdade");
    expect(conversa?.nome).toBe("Pessoa De Verdade");
  });

  // O funil é a estrutura da tela, não conteúdo de exemplo: esvaziá-lo deixaria o quadro sem
  // colunas, e quem limpou pra gravar acharia que quebrou alguma coisa.
  it("preserva o funil e suas etapas", async () => {
    expect(await prisma.funil.count({ where: { workspaceId: WORKSPACE_DEMO } })).toBeGreaterThan(0);
    expect(await prisma.funilEtapa.count({ where: { workspaceId: WORKSPACE_DEMO } })).toBeGreaterThan(0);
  });

  // Apagar o membro `demo-demonstracao` tiraria o acesso à própria conta de demonstração — e o id
  // dele começa com `demo-`, então é exatamente o tipo de linha que um filtro desatento levaria.
  it("preserva o acesso à conta de demonstração", async () => {
    const membros = await prisma.membro.count({ where: { workspaceId: WORKSPACE_DEMO } });
    expect(membros).toBeGreaterThan(0);
  });
});
