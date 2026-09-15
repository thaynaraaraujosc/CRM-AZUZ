import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { aplicarOrigemPelaMensagem, aplicarOrigemPelaReferenciaDaMeta } from "../aplicar";
import { marcarMensagem } from "../codigo";

/**
 * A costura entre o clique e a conversa, provada contra um banco de verdade.
 *
 * Aqui moram as duas metades soltas do rastreamento: um clique sem pessoa e uma pessoa sem clique.
 * Nenhuma serve pra nada sozinha, e é esta função que as junta. Se ela errar, o sintoma não é erro
 * nenhum: as conversas acontecem, o atendimento funciona, e meses depois a tela de Tráfego não
 * explica de onde vieram os clientes.
 *
 * Contra banco de verdade, e não com dublê, porque o que precisa ser provado aqui são justamente
 * as garantias do banco: a unicidade do código, a trava de um contato ter uma origem só, e o
 * isolamento entre empresas. Teste de unidade confere o que o autor imaginou; banco confere o que
 * o banco aceita.
 *
 * Pula sozinho quando não há banco. Como preparar, ver `src/lib/demo/README.md`.
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

const WS = "rastreio-teste";
const OUTRO_WS = "rastreio-vizinho";

async function prepararWorkspace(id: string) {
  await prisma.workspace.upsert({
    where: { id },
    create: { id, nome: id, slug: id },
    update: {},
  });
}

async function criarContato(id: string, workspaceId: string) {
  await prisma.contato.upsert({
    where: { id },
    create: {
      id,
      workspaceId,
      initials: "TT",
      nome: id,
      origem: "WhatsApp",
      etapa: "Novo lead",
      responsavel: "Ninguém",
      ultima: "oi",
      valor: "R$ 0",
    },
    update: {},
  });
  return id;
}

async function criarClique(codigo: string, workspaceId: string) {
  await prisma.cliqueRastreado.create({
    data: {
      id: `clique-${codigo}`,
      workspaceId,
      codigo,
      dados: {
        plataforma: "google",
        cliqueId: "EAIaIQobChM-teste",
        tipoDoClique: "gclid",
        campanhaNome: "Implantes · Setembro",
        palavraChave: "implante dentario",
        bruto: { gclid: "EAIaIQobChM-teste" },
      },
    },
  });
}

conditional("aplicarOrigemPelaMensagem", () => {
  beforeEach(async () => {
    await prisma.origemDoLead.deleteMany({ where: { workspaceId: { in: [WS, OUTRO_WS] } } });
    await prisma.cliqueRastreado.deleteMany({ where: { workspaceId: { in: [WS, OUTRO_WS] } } });
    await prepararWorkspace(WS);
    await prepararWorkspace(OUTRO_WS);
  });

  it("cola a origem no contato quando acha o código", async () => {
    await criarClique("AB2CD3", WS);
    const contatoId = await criarContato("contato-rastreado", WS);

    const r = await aplicarOrigemPelaMensagem(prisma, {
      workspaceId: WS,
      contatoId,
      mensagem: marcarMensagem("Olá! Vim pelo anúncio.", "AB2CD3"),
    });

    expect(r.atribuido).toBe(true);
    const origem = await prisma.origemDoLead.findUnique({ where: { contatoId } });
    expect(origem?.plataforma).toBe("google");
    expect(origem?.cliqueId).toBe("EAIaIQobChM-teste");
    expect(origem?.campanhaNome).toBe("Implantes · Setembro");
    expect(origem?.caminho).toBe("whatsapp");
  });

  it("marca o clique como consumido", async () => {
    await criarClique("AB2CD4", WS);
    const contatoId = await criarContato("contato-consumo", WS);
    await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId, mensagem: "oi [AZ-AB2CD4]" });
    const clique = await prisma.cliqueRastreado.findUnique({ where: { codigo: "AB2CD4" } });
    expect(clique?.consumidoEm).toBeTruthy();
  });

  /**
   * Mensagem pronta é encaminhada o tempo todo: alguém acha o serviço interessante e repassa pra
   * uma amiga, que manda o mesmo texto com o mesmo código. Sem esta trava as duas seriam atribuídas
   * ao mesmo clique, e o Google receberia DUAS vendas por um anúncio que gerou uma — inflando
   * exatamente o número que o anunciante usa pra decidir onde pôr dinheiro.
   */
  it("um código atribui uma pessoa só, mesmo se a mensagem for encaminhada", async () => {
    await criarClique("AB2CD5", WS);
    const primeira = await criarContato("contato-primeira", WS);
    const segunda = await criarContato("contato-segunda", WS);

    const r1 = await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId: primeira, mensagem: "oi [AZ-AB2CD5]" });
    const r2 = await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId: segunda, mensagem: "oi [AZ-AB2CD5]" });

    expect(r1.atribuido).toBe(true);
    expect(r2).toEqual({ atribuido: false, motivo: "ja-usado" });
    expect(await prisma.origemDoLead.findUnique({ where: { contatoId: segunda } })).toBeNull();
  });

  /**
   * A trava multi-empresa, conferida no banco e não no código: código de uma empresa não atribui
   * lead de outra. Sem isso, descobrir o formato do código bastaria pra roubar a atribuição alheia.
   */
  it("não aceita código de outra empresa", async () => {
    await criarClique("AB2CD6", OUTRO_WS);
    const contatoId = await criarContato("contato-de-ca", WS);

    const r = await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId, mensagem: "oi [AZ-AB2CD6]" });

    expect(r).toEqual({ atribuido: false, motivo: "codigo-desconhecido" });
    expect(await prisma.origemDoLead.findUnique({ where: { contatoId } })).toBeNull();
  });

  // O anúncio que trouxe a pessoa pela primeira vez é o que merece o crédito, e não o último link
  // em que ela clicou meses depois.
  it("não sobrescreve a origem de quem já tem", async () => {
    await criarClique("AB2CD7", WS);
    await criarClique("AB2CD8", WS);
    const contatoId = await criarContato("contato-primeiro-toque", WS);

    await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId, mensagem: "oi [AZ-AB2CD7]" });
    const r = await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId, mensagem: "oi [AZ-AB2CD8]" });

    expect(r).toEqual({ atribuido: false, motivo: "ja-tem-origem" });
    const origem = await prisma.origemDoLead.findUnique({ where: { contatoId } });
    expect(origem?.bruto).toBeTruthy();
  });

  // O caso normal, e de longe o mais comum: mensagem de gente que não veio de anúncio.
  it("não faz nada com mensagem sem código", async () => {
    const contatoId = await criarContato("contato-organico", WS);
    const r = await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId, mensagem: "Bom dia, tudo bem?" });
    expect(r).toEqual({ atribuido: false, motivo: "sem-codigo" });
  });

  it("não quebra com código que nunca existiu", async () => {
    const contatoId = await criarContato("contato-codigo-falso", WS);
    const r = await aplicarOrigemPelaMensagem(prisma, { workspaceId: WS, contatoId, mensagem: "oi [AZ-ZZ9ZZ9]" });
    expect(r).toEqual({ atribuido: false, motivo: "codigo-desconhecido" });
  });
});

conditional("aplicarOrigemPelaReferenciaDaMeta", () => {
  beforeEach(async () => {
    await prisma.origemDoLead.deleteMany({ where: { workspaceId: WS } });
    await prepararWorkspace(WS);
  });

  /**
   * O caminho que funciona sem ninguém configurar nada: a Meta manda a referência do anúncio junto
   * da primeira mensagem. É o que faz o rastreamento valer pro cliente que compra o CRM e nunca
   * vai abrir o código do próprio site.
   */
  it("atribui pelo que a Meta manda junto da mensagem", async () => {
    const contatoId = await criarContato("contato-ctwa", WS);
    const r = await aplicarOrigemPelaReferenciaDaMeta(prisma, {
      workspaceId: WS,
      contatoId,
      referencia: { ad_id: "120210", ctwa_clid: "ARB1x9", headline: "Avaliação gratuita" },
      caminho: "whatsapp",
    });

    expect(r.atribuido).toBe(true);
    const origem = await prisma.origemDoLead.findUnique({ where: { contatoId } });
    expect(origem?.plataforma).toBe("meta");
    expect(origem?.tipoDoClique).toBe("ctwa_clid");
    expect(origem?.anuncioId).toBe("120210");
  });

  // Sem o clique, o anúncio sozinho ainda mostra a campanha na tela. Só não permite devolver a
  // conversão por clique — e meia atribuição é melhor que nenhuma.
  it("aceita referência sem o código do clique", async () => {
    const contatoId = await criarContato("contato-ref-parcial", WS);
    const r = await aplicarOrigemPelaReferenciaDaMeta(prisma, {
      workspaceId: WS,
      contatoId,
      referencia: { ad_id: "120211" },
      caminho: "instagram",
    });
    expect(r.atribuido).toBe(true);
    const origem = await prisma.origemDoLead.findUnique({ where: { contatoId } });
    expect(origem?.tipoDoClique).toBeNull();
    expect(origem?.caminho).toBe("instagram");
  });

  it("não faz nada quando a mensagem não veio de anúncio", async () => {
    const contatoId = await criarContato("contato-sem-ref", WS);
    const r = await aplicarOrigemPelaReferenciaDaMeta(prisma, {
      workspaceId: WS,
      contatoId,
      referencia: null,
      caminho: "whatsapp",
    });
    expect(r).toEqual({ atribuido: false, motivo: "sem-codigo" });
  });
});
