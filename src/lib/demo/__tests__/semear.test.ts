import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { semearDemo } from "../semear";
import {
  CONTATOS_DEMO,
  EMAIL_DEMO,
  ETAPAS_DEMO,
  FECHADOS_DEMO,
  TAREFAS_DEMO,
  WORKSPACE_DEMO,
  resumoDaDemo,
} from "../dados-demo";

/**
 * `semearDemo` rodando contra um banco de verdade.
 *
 * POR QUE ISTO EXISTE: em 13/09/2026 o CRM caiu duas vezes, nas duas por mudança que tinha teste
 * de unidade verde e nunca tinha tocado num banco. Teste de unidade confere o que o autor do teste
 * imaginou; banco confere o que o banco aceita. São coisas diferentes, e a diferença entre elas
 * derrubou produção duas vezes no mesmo dia.
 *
 * `semearDemo` APAGA e recria um workspace inteiro, dentro de uma transação com dezenas de
 * `create` encadeados. Coluna obrigatória faltando, chave estrangeira fora de ordem, transação
 * estourando o tempo: nada disso aparece em teste de unidade, e tudo isso aparece aqui.
 *
 * Pula sozinho quando não há banco, pra `npx vitest run` continuar funcionando sem preparar nada.
 * Como preparar, ver `src/lib/demo/README.md`.
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

afterAll(async () => {
  if (temBanco) await prisma.$disconnect().catch(() => {});
});

conditional("semearDemo num banco de verdade", () => {
  beforeAll(async () => {
    await semearDemo(prisma, "$2a$10$hashfalsoparaoteste000000000000000000000000000000000000");
  });

  it("cria o workspace da demonstração", async () => {
    const ws = await prisma.workspace.findUnique({ where: { id: WORKSPACE_DEMO } });
    expect(ws?.nome).toBe("Clínica Aurora");
  });

  // Sem assinatura ativa o paywall manda a demonstração pra tela de pagamento, que é o pior
  // primeiro quadro possível num vídeo de apresentação.
  it("deixa a assinatura ativa, pra demonstração não cair no paywall", async () => {
    const assinatura = await prisma.assinatura.findUnique({ where: { workspaceId: WORKSPACE_DEMO } });
    expect(assinatura?.status).toBe("ativa");
  });

  it("cria o acesso da demonstração já liberado", async () => {
    const membro = await prisma.membro.findUnique({ where: { email: EMAIL_DEMO } });
    expect(membro?.ativo).toBe(true);
    expect(membro?.convitePendente).toBe(false);
    expect(membro?.workspaceId).toBe(WORKSPACE_DEMO);
  });

  it("grava todos os contatos", async () => {
    const total = await prisma.contato.count({ where: { workspaceId: WORKSPACE_DEMO } });
    expect(total).toBe(CONTATOS_DEMO.length);
  });

  it("grava todas as conversas e mensagens", async () => {
    const conversas = await prisma.conversa.count({ where: { workspaceId: WORKSPACE_DEMO } });
    const mensagens = await prisma.mensagemExtra.count({ where: { workspaceId: WORKSPACE_DEMO } });
    expect(conversas).toBe(resumoDaDemo().conversas);
    expect(mensagens).toBe(resumoDaDemo().mensagens);
  });

  it("monta o funil com todas as etapas", async () => {
    const etapas = await prisma.funilEtapa.findMany({
      where: { workspaceId: WORKSPACE_DEMO },
      orderBy: { ordem: "asc" },
    });
    expect(etapas.map((e) => e.titulo)).toEqual([...ETAPAS_DEMO]);
  });

  // A tela de Funil é a que mais aparece numa demonstração. Etapa vazia no meio do quadro entrega
  // que os dados são de enfeite.
  it("põe negócio em todas as etapas do funil", async () => {
    const etapas = await prisma.funilEtapa.findMany({
      where: { workspaceId: WORKSPACE_DEMO },
      select: { id: true, titulo: true },
    });
    for (const etapa of etapas) {
      const cards = await prisma.negocioCard.count({ where: { etapaId: etapa.id } });
      expect(cards, `etapa "${etapa.titulo}" vazia`).toBeGreaterThan(0);
    }
  });

  it("grava os negócios encerrados com motivo de perda", async () => {
    const perdidos = await prisma.negocioCard.findMany({
      where: { workspaceId: WORKSPACE_DEMO, statusFechamento: "perdido" },
      select: { motivoPerda: true },
    });
    expect(perdidos.length).toBe(FECHADOS_DEMO.filter((f) => f.status === "perdido").length);
    for (const p of perdidos) expect(p.motivoPerda).toBeTruthy();
  });

  it("grava as tarefas, com a atrasada marcada", async () => {
    const tarefas = await prisma.tarefaCard.findMany({ where: { workspaceId: WORKSPACE_DEMO } });
    expect(tarefas.length).toBe(TAREFAS_DEMO.length);
    expect(tarefas.some((t) => t.atrasada)).toBe(true);
    expect(tarefas.some((t) => t.concluida)).toBe(true);
  });

  it("as conversas apontam pro contato certo", async () => {
    const conversas = await prisma.conversa.findMany({
      where: { workspaceId: WORKSPACE_DEMO },
      select: { nome: true, contatoId: true },
    });
    for (const conversa of conversas) {
      expect(conversa.contatoId, `conversa de "${conversa.nome}" sem contato`).toBeTruthy();
    }
  });

  /**
   * O defeito que a Thaynara pegou usando a demonstração: sem conexão semeada, a caixa de entrada
   * ESCONDE toda conversa de WhatsApp, porque a tela só mostra conversa de canal conectado. A
   * demonstração abria vazia, com aviso de "conecte um canal", justamente na tela que mais aparece
   * numa venda e no vídeo.
   */
  it("deixa os dois canais conectados, senão a caixa de entrada abre vazia", async () => {
    const integracoes = await prisma.integracao.findMany({
      where: { workspaceId: WORKSPACE_DEMO, status: "conectado" },
      select: { provedor: true, accessTokenCriptografado: true },
    });
    const provedores = integracoes.map((i) => i.provedor).sort();
    expect(provedores).toEqual(["meta_instagram", "meta_whatsapp"]);

    // O que torna a conexão fictícia segura: sem token, todo trabalho automático que fala com a
    // Meta pula esta conexão. A demonstração nunca dispara chamada de verdade.
    for (const i of integracoes) expect(i.accessTokenCriptografado).toBeNull();
  });

  /**
   * A marca da conexão dona precisa casar EXATAMENTE com o que a conexão declara. Se divergir, o
   * filtro não reivindica a conversa e ela fica gravada e invisível: o mesmo sintoma de antes,
   * só que mais difícil de achar, porque a tela diz que está tudo conectado.
   */
  it("as conversas carregam a marca da conexão que as reivindica", async () => {
    const conversas = await prisma.conversa.findMany({
      where: { workspaceId: WORKSPACE_DEMO },
      select: { canal: true, contaCanal: true },
    });
    for (const c of conversas) {
      const esperado = c.canal === "WhatsApp" ? "meta_whatsapp:demo-whatsapp" : "meta_instagram:demo-instagram";
      expect(c.contaCanal, `conversa de canal ${c.canal}`).toBe(esperado);
    }

    const semMarca = await prisma.mensagemExtra.count({
      where: { workspaceId: WORKSPACE_DEMO, contaCanal: null },
    });
    expect(semMarca).toBe(0);
  });

  /**
   * Remontar é o uso normal, não a exceção: é o que devolve a conta ao estado inicial depois de
   * cada demonstração. Se duplicasse em vez de substituir, na terceira demonstração a tela estaria
   * com 36 contatos repetidos.
   */
  it("remontar substitui, não duplica", async () => {
    await semearDemo(prisma, "$2a$10$outrohashfalso0000000000000000000000000000000000000000");
    const contatos = await prisma.contato.count({ where: { workspaceId: WORKSPACE_DEMO } });
    const mensagens = await prisma.mensagemExtra.count({ where: { workspaceId: WORKSPACE_DEMO } });
    expect(contatos).toBe(CONTATOS_DEMO.length);
    expect(mensagens).toBe(resumoDaDemo().mensagens);
  });

  /**
   * A trava, verificada no banco e não no código: semear não pode encostar em nenhum outro
   * workspace. Este teste cria um workspace vizinho com dados dentro, remonta a demonstração, e
   * confere que o vizinho saiu intacto.
   */
  it("não encosta em workspace de cliente", async () => {
    await prisma.workspace.upsert({
      where: { id: "cliente-pagante" },
      create: { id: "cliente-pagante", nome: "Cliente de Verdade", slug: "cliente-pagante" },
      update: {},
    });
    await prisma.contato.upsert({
      where: { id: "contato-intocavel" },
      create: {
        id: "contato-intocavel",
        workspaceId: "cliente-pagante",
        initials: "CV",
        nome: "Contato Real",
        origem: "Indicação",
        etapa: "Novo lead",
        responsavel: "Alguém",
        ultima: "não pode sumir",
        valor: "R$ 1",
      },
      update: {},
    });

    await semearDemo(prisma, "$2a$10$maisumhashfalso000000000000000000000000000000000000000");

    const sobreviveu = await prisma.contato.findUnique({ where: { id: "contato-intocavel" } });
    expect(sobreviveu?.ultima).toBe("não pode sumir");
  });
});
