import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { encriptar } from "@/lib/integracoes/crypto";

/* A chave de criptografia das integrações é definida aqui, e não vem do ambiente, pra este teste
   rodar junto com a suíte em qualquer máquina. O valor não importa: o que se testa é o caminho da
   devolução, não o algoritmo — e o mesmo processo cifra e decifra. */
process.env.INTEGRACAO_ENCRYPTION_KEY ??= "chave-so-de-teste-nao-usada-em-producao";
/* E a configuração do Google Ads, porque o cabeçalho de toda chamada exige ela. Sem isto a rodada
   lançava ao montar o cabeçalho, o erro era engolido pelo try/catch, e o teste via "nada foi
   enviado" sem nenhuma pista do motivo — que foi exatamente o que aconteceu ao escrever isto. */
process.env.GOOGLE_ADS_CLIENT_ID ??= "cliente-de-teste";
process.env.GOOGLE_ADS_CLIENT_SECRET ??= "segredo-de-teste";
process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ??= "1234567890";

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

conditional("Conversões Aprimoradas e estorno", () => {
  const fetchOriginal = globalThis.fetch;
  let chamadasDeUpload = 0;
  let chamadasDeEstorno = 0;
  let ultimoEnvio: { conversions: Record<string, unknown>[] } | null = null;

  beforeEach(async () => {
    chamadasDeUpload = 0;
    chamadasDeEstorno = 0;
    ultimoEnvio = null;
    globalThis.fetch = (async (url: string, init?: { body?: string }) => {
      const endereco = String(url);
      if (endereco.includes(":uploadClickConversions")) {
        chamadasDeUpload += 1;
        ultimoEnvio = JSON.parse(init?.body ?? "{}");
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (endereco.includes(":uploadConversionAdjustments")) {
        chamadasDeEstorno += 1;
        return { ok: true, status: 200, json: async () => ({}) };
      }
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
    await prisma.integracao.create({
      data: {
        id: `${WS}-gads`,
        workspaceId: WS,
        provedor: "google_ads",
        status: "conectado",
        metadados: { contaId: "1234567890" },
        // Token válido e longe de vencer: sem isso a conta é tratada como desconectada e a rodada
        // desiste antes de chegar no que se quer testar.
        accessTokenCriptografado: encriptar("token-de-teste"),
        expiraEm: new Date(Date.now() + 3_600_000),
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("lead SEM codigo de clique entra quando o contato tem telefone", async () => {
    // É o caso que as Conversões Aprimoradas existem pra cobrir: iPhone, bloqueador, link
    // compartilhado. Antes ele era descartado e a venda nunca voltava pro Google.
    await prisma.contato.create({
      data: {
        id: `${WS}-sem-clique`,
        workspaceId: WS,
        initials: "SC",
        nome: "Sem clique",
        origem: "Google Ads",
        etapa: "Fechado",
        responsavel: "-",
        ultima: "hoje",
        valor: "R$ 500",
        whatsapp: "11993154058",
      },
    });
    await prisma.funil.create({ data: { id: `${WS}-f`, workspaceId: WS, nome: "C", responsavel: "-" } });
    await prisma.funilEtapa.create({
      data: { id: `${WS}-e`, funilId: `${WS}-f`, workspaceId: WS, titulo: "Fechado", ordem: 1 },
    });
    await prisma.negocioCard.create({
      data: {
        id: `${WS}-card-sc`,
        etapaId: `${WS}-e`,
        ordem: 1,
        workspaceId: WS,
        nome: "Sem clique",
        valor: "R$ 500",
        origem: "Google Ads",
        dias: "1",
        data: "hoje",
        statusFechamento: "ganho",
        dataFechamento: new Date(),
      },
    });
    await prisma.origemDoLead.create({
      data: {
        id: `${WS}-o-sc`,
        workspaceId: WS,
        contatoId: `${WS}-sem-clique`,
        plataforma: "google",
        cliqueId: null,
        caminho: "formulario",
      },
    });

    const { devolverConversoesDeTodosOsWorkspaces } = await import("../devolver-conversao");
    await devolverConversoesDeTodosOsWorkspaces(prisma);

    expect(chamadasDeUpload).toBe(1);
    const c = ultimoEnvio!.conversions[0] as Record<string, unknown>;
    expect(c.gclid).toBeUndefined();
    expect(c.userIdentifiers).toHaveLength(1);
    // O identificador do negócio vai junto: é ele que deduplica contra a tag do site e é a chave
    // do estorno.
    expect(c.orderId).toBe(`${WS}-card-sc`);
  });

  it("lead sem codigo E sem contato identificavel continua fora", async () => {
    await prisma.contato.create({
      data: {
        id: `${WS}-anonimo`,
        workspaceId: WS,
        initials: "AN",
        nome: "Anonimo",
        origem: "Google Ads",
        etapa: "Fechado",
        responsavel: "-",
        ultima: "hoje",
        valor: "R$ 100",
      },
    });
    await prisma.funil.create({ data: { id: `${WS}-f2`, workspaceId: WS, nome: "C", responsavel: "-" } });
    await prisma.funilEtapa.create({
      data: { id: `${WS}-e2`, funilId: `${WS}-f2`, workspaceId: WS, titulo: "Fechado", ordem: 1 },
    });
    await prisma.negocioCard.create({
      data: {
        id: `${WS}-card-an`,
        etapaId: `${WS}-e2`,
        ordem: 1,
        workspaceId: WS,
        nome: "Anonimo",
        valor: "R$ 100",
        origem: "Google Ads",
        dias: "1",
        data: "hoje",
        statusFechamento: "ganho",
        dataFechamento: new Date(),
      },
    });
    await prisma.origemDoLead.create({
      data: {
        id: `${WS}-o-an`,
        workspaceId: WS,
        contatoId: `${WS}-anonimo`,
        plataforma: "google",
        cliqueId: null,
        caminho: "formulario",
      },
    });

    const { devolverConversoesDeTodosOsWorkspaces } = await import("../devolver-conversao");
    await devolverConversoesDeTodosOsWorkspaces(prisma);
    expect(chamadasDeUpload).toBe(0);
  });

  it("negocio que deixou de ser ganho e estornado, mesmo sem venda nova pra mandar", async () => {
    await prisma.contato.create({
      data: {
        id: `${WS}-revertido`,
        workspaceId: WS,
        initials: "RV",
        nome: "Revertido",
        origem: "Google Ads",
        etapa: "Perdido",
        responsavel: "-",
        ultima: "hoje",
        valor: "R$ 900",
      },
    });
    await prisma.funil.create({ data: { id: `${WS}-f3`, workspaceId: WS, nome: "C", responsavel: "-" } });
    await prisma.funilEtapa.create({
      data: { id: `${WS}-e3`, funilId: `${WS}-f3`, workspaceId: WS, titulo: "Perdido", ordem: 1 },
    });
    // O negócio existe, mas NÃO está mais como ganho: o cliente desistiu depois.
    await prisma.negocioCard.create({
      data: {
        id: `${WS}-card-rv`,
        etapaId: `${WS}-e3`,
        ordem: 1,
        workspaceId: WS,
        nome: "Revertido",
        valor: "R$ 900",
        origem: "Google Ads",
        dias: "1",
        data: "hoje",
        statusFechamento: "perdido",
      },
    });
    // E a venda dele já tinha sido devolvida pro Google antes.
    await prisma.origemDoLead.create({
      data: {
        id: `${WS}-o-rv`,
        workspaceId: WS,
        contatoId: `${WS}-revertido`,
        plataforma: "google",
        cliqueId: "clique-rv",
        tipoDoClique: "gclid",
        caminho: "formulario",
        conversaoEnviadaEm: new Date(Date.now() - 86_400_000),
        conversaoNegocioId: `${WS}-card-rv`,
      },
    });

    const { devolverConversoesDeTodosOsWorkspaces } = await import("../devolver-conversao");
    await devolverConversoesDeTodosOsWorkspaces(prisma);

    expect(chamadasDeUpload).toBe(0);
    expect(chamadasDeEstorno).toBe(1);
    const origem = await prisma.origemDoLead.findUnique({ where: { id: `${WS}-o-rv` } });
    expect(origem?.conversaoEstornadaEm).not.toBeNull();
  });

  it("negocio que continua ganho NAO e estornado", async () => {
    await prisma.contato.create({
      data: {
        id: `${WS}-firme`,
        workspaceId: WS,
        initials: "FI",
        nome: "Firme",
        origem: "Google Ads",
        etapa: "Fechado",
        responsavel: "-",
        ultima: "hoje",
        valor: "R$ 900",
      },
    });
    await prisma.funil.create({ data: { id: `${WS}-f4`, workspaceId: WS, nome: "C", responsavel: "-" } });
    await prisma.funilEtapa.create({
      data: { id: `${WS}-e4`, funilId: `${WS}-f4`, workspaceId: WS, titulo: "Fechado", ordem: 1 },
    });
    await prisma.negocioCard.create({
      data: {
        id: `${WS}-card-fi`,
        etapaId: `${WS}-e4`,
        ordem: 1,
        workspaceId: WS,
        nome: "Firme",
        valor: "R$ 900",
        origem: "Google Ads",
        dias: "1",
        data: "hoje",
        statusFechamento: "ganho",
        dataFechamento: new Date(),
      },
    });
    await prisma.origemDoLead.create({
      data: {
        id: `${WS}-o-fi`,
        workspaceId: WS,
        contatoId: `${WS}-firme`,
        plataforma: "google",
        cliqueId: "clique-fi",
        tipoDoClique: "gclid",
        caminho: "formulario",
        conversaoEnviadaEm: new Date(Date.now() - 86_400_000),
        conversaoNegocioId: `${WS}-card-fi`,
      },
    });

    const { devolverConversoesDeTodosOsWorkspaces } = await import("../devolver-conversao");
    await devolverConversoesDeTodosOsWorkspaces(prisma);
    expect(chamadasDeEstorno).toBe(0);
  });
});
