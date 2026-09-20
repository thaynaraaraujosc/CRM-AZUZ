import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * A garantia que importa aqui: MANDAR DUAS VEZES É PIOR QUE NÃO MANDAR.
 *
 * Cada upload vira uma conversão nova no relatório do Google. O mesmo negócio enviado em duas
 * rodadas faz a campanha parecer render o dobro, e o algoritmo passa a investir em cima de um
 * número inventado — com dinheiro real do cliente. Não existe desfazer.
 *
 * A rede é dublada porque o que se testa é a decisão (quem entra na rodada, o que fica marcado),
 * não a API do Google. O formato da chamada é testado à parte, em `google-ads.test.ts`.
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
const WS = "conversao-teste";

afterAll(async () => {
  if (temBanco) await prisma.$disconnect().catch(() => {});
});

conditional("devolverConversoesDeTodosOsWorkspaces", () => {
  const fetchOriginal = globalThis.fetch;
  let chamadasDeUpload = 0;

  beforeEach(async () => {
    chamadasDeUpload = 0;

    globalThis.fetch = (async (url: string) => {
      const endereco = String(url);
      if (endereco.includes(":uploadClickConversions")) {
        chamadasDeUpload += 1;
        return { ok: true, status: 200, json: async () => ({}) };
      }
      // A busca da ação de conversão: responde que já existe, pra não exercitar a criação.
      return {
        ok: true,
        status: 200,
        json: async () => [
          { results: [{ conversionAction: { resourceName: "customers/1/conversionActions/9" } }] },
        ],
      };
    }) as unknown as typeof fetch;

    await prisma.origemDoLead.deleteMany({ where: { workspaceId: WS } });
    await prisma.negocioCard.deleteMany({ where: { workspaceId: WS } });
    await prisma.contato.deleteMany({ where: { workspaceId: WS } });
    await prisma.integracao.deleteMany({ where: { workspaceId: WS } });
    await prisma.funilEtapa.deleteMany({ where: { workspaceId: WS } });
    await prisma.funil.deleteMany({ where: { workspaceId: WS } });
    await prisma.workspace.upsert({
      where: { id: WS },
      create: { id: WS, nome: WS, slug: WS },
      update: {},
    });
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  async function prepararLeadGanho(sufixo: string) {
    await prisma.contato.create({
      data: {
        id: `${WS}-${sufixo}`,
        workspaceId: WS,
        initials: "XX",
        nome: `Cliente ${sufixo}`,
        origem: "Google Ads",
        etapa: "Fechado",
        responsavel: "-",
        ultima: "hoje",
        valor: "R$ 1.000",
      },
    });
    await prisma.funil.upsert({
      where: { id: `${WS}-funil` },
      create: { id: `${WS}-funil`, workspaceId: WS, nome: "Comercial", responsavel: "-" },
      update: {},
    });
    await prisma.funilEtapa.upsert({
      where: { id: `${WS}-etapa` },
      create: { id: `${WS}-etapa`, funilId: `${WS}-funil`, workspaceId: WS, titulo: "Fechado", ordem: 1 },
      update: {},
    });
    await prisma.negocioCard.create({
      data: {
        id: `${WS}-card-${sufixo}`,
        etapaId: `${WS}-etapa`,
        ordem: 1,
        workspaceId: WS,
        nome: `Cliente ${sufixo}`,
        valor: "R$ 1.000",
        origem: "Google Ads",
        dias: "1",
        data: "hoje",
        statusFechamento: "ganho",
        dataFechamento: new Date(),
      },
    });
    await prisma.origemDoLead.create({
      data: {
        id: `${WS}-origem-${sufixo}`,
        workspaceId: WS,
        contatoId: `${WS}-${sufixo}`,
        plataforma: "google",
        cliqueId: `clique-${sufixo}`,
        tipoDoClique: "gclid",
        caminho: "formulario",
      },
    });
  }

  it("nao devolve nada quando o Google Ads nao esta conectado", async () => {
    await prepararLeadGanho("a");
    const { devolverConversoesDeTodosOsWorkspaces } = await import("../devolver-conversao");
    await devolverConversoesDeTodosOsWorkspaces(prisma);
    expect(chamadasDeUpload).toBe(0);
    const origem = await prisma.origemDoLead.findFirst({ where: { workspaceId: WS } });
    expect(origem?.conversaoEnviadaEm).toBeNull();
  });

  it("nao devolve lead que ainda nao fechou negocio", async () => {
    await prisma.contato.create({
      data: {
        id: `${WS}-aberto`,
        workspaceId: WS,
        initials: "AB",
        nome: "Cliente aberto",
        origem: "Google Ads",
        etapa: "Novo",
        responsavel: "-",
        ultima: "hoje",
        valor: "-",
      },
    });
    await prisma.origemDoLead.create({
      data: {
        id: `${WS}-origem-aberto`,
        workspaceId: WS,
        contatoId: `${WS}-aberto`,
        plataforma: "google",
        cliqueId: "clique-aberto",
        tipoDoClique: "gclid",
        caminho: "formulario",
      },
    });
    const { devolverConversoesDeTodosOsWorkspaces } = await import("../devolver-conversao");
    await devolverConversoesDeTodosOsWorkspaces(prisma);
    expect(chamadasDeUpload).toBe(0);
  });

  it("nao devolve lead sem codigo de clique, porque nao ha o que mandar", async () => {
    await prepararLeadGanho("b");
    await prisma.origemDoLead.update({
      where: { id: `${WS}-origem-b` },
      data: { cliqueId: null },
    });
    const { devolverConversoesDeTodosOsWorkspaces } = await import("../devolver-conversao");
    await devolverConversoesDeTodosOsWorkspaces(prisma);
    expect(chamadasDeUpload).toBe(0);
  });
});
