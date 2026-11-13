/**
 * Prova a rota `POST /api/integracoes/azuz-flow/lista` contra um banco DE VERDADE.
 *
 * O que ele responde, caso a caso: a coluna do Flow vira contato e card no funil e na etapa
 * escolhidos; quem já existe é reaproveitado (por WhatsApp, por e-mail e por nome); "manter" não
 * mexe em card que já está noutra etapa e "mover" move; o mesmo lote reenviado não cria nada nem
 * dispara gatilho de novo; e cinquenta chamadas simultâneas terminam com um contato e um card por
 * pessoa.
 *
 * POR QUE ELE EXISTE, mesmo havendo teste automatizado: o teste em memória prova a DECISÃO (ver
 * `azuz-flow-lista.test.ts`), com as dependências simuladas. Ele não reproduz a ordem em que um
 * banco de verdade intercala leituras e gravações entre conexões diferentes de um pool — e foi
 * exatamente aí que o card duplicado apareceu em 14/10/2026, sem nenhum teste de unidade pegar.
 *
 * ---
 *
 * NUNCA RODE ISTO CONTRA PRODUÇÃO. Ele grava dezenas de contatos, conversas e cards.
 *
 * Por isso ele NÃO lê `DATABASE_URL`: se lesse, um `.env` de produção na raiz faria o script
 * apontar pro banco dos clientes sem ninguém notar. Ele exige `DATABASE_URL_LISTA`, que só existe
 * se alguém a tiver definido de propósito, e ainda pede confirmação explícita.
 *
 * Rode com:
 *   DATABASE_URL_LISTA="mysql://..." npx tsx scripts/teste-da-lista-do-flow.ts --confirmo
 *
 * Tudo que ele cria fica sob um prefixo próprio (`zz-lista-<momento>`) e é apagado no fim. Nenhum
 * `deleteMany` deste script alcança linha que ele não tenha criado: todos são filtrados pelo
 * workspace de teste, que nasce e morre aqui dentro.
 */
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";

setDefaultResultOrder("ipv4first");

const URL_DO_TESTE = process.env.DATABASE_URL_LISTA;
const CONFIRMADO = process.argv.includes("--confirmo");

if (!URL_DO_TESTE) {
  console.error(
    [
      "Falta DATABASE_URL_LISTA.",
      "",
      "Este script grava muitos dados e NÃO usa a DATABASE_URL do .env de propósito, pra não",
      "haver como apontá-lo pro banco de produção sem perceber. Aponte-a pra um banco de teste.",
    ].join("\n"),
  );
  process.exit(1);
}

if (!CONFIRMADO) {
  const host = (() => {
    try {
      return new URL(URL_DO_TESTE.replace(/^mysql:\/\//, "http://")).host;
    } catch {
      return "(não deu pra ler o endereço)";
    }
  })();
  console.error(
    [
      `Este script vai GRAVAR MUITO em: ${host}`,
      "",
      "Se esse for o banco de produção, pare agora.",
      "Pra seguir, repita o comando com --confirmo.",
    ].join("\n"),
  );
  process.exit(1);
}

const PREFIXO = `zz-lista-${Date.now()}`;

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(URL_DO_TESTE.replace(/^mysql:\/\//, "mariadb://")),
});

const falhas: string[] = [];
function conferir(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) {
    console.log(`  ok  ${nome}`);
    return;
  }
  falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`  FALHOU  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

async function montarWorkspace(): Promise<{ workspaceId: string; funilId: string; etapaA: string; etapaB: string }> {
  const id = PREFIXO;
  await prisma.workspace.create({ data: { id, nome: "Lista (teste)", slug: id } });
  await prisma.funil.create({ data: { id: `${id}-funil`, workspaceId: id, nome: "Reativação" } });
  await prisma.funilEtapa.createMany({
    data: [
      { id: `${id}-etapaA`, funilId: `${id}-funil`, workspaceId: id, titulo: "Aquecendo", ordem: 0 },
      { id: `${id}-etapaB`, funilId: `${id}-funil`, workspaceId: id, titulo: "Depois", ordem: 1 },
    ],
  });
  return { workspaceId: id, funilId: `${id}-funil`, etapaA: `${id}-etapaA`, etapaB: `${id}-etapaB` };
}

async function limpar(workspaceId: string) {
  await prisma.gatilhoEtapa.deleteMany({ where: { workspaceId } });
  await prisma.negocioCard.deleteMany({ where: { workspaceId } });
  await prisma.funilEtapa.deleteMany({ where: { workspaceId } });
  await prisma.funil.deleteMany({ where: { workspaceId } });
  await prisma.leadRecebido.deleteMany({ where: { workspaceId } });
  await prisma.mensagemExtra.deleteMany({ where: { workspaceId } });
  await prisma.conversa.deleteMany({ where: { workspaceId } });
  await prisma.contato.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
}

async function zerar(workspaceId: string) {
  await prisma.negocioCard.deleteMany({ where: { workspaceId } });
  await prisma.leadRecebido.deleteMany({ where: { workspaceId } });
  await prisma.mensagemExtra.deleteMany({ where: { workspaceId } });
  await prisma.conversa.deleteMany({ where: { workspaceId } });
  await prisma.contato.deleteMany({ where: { workspaceId } });
}

async function main() {
  const { receberListaDoFlow } = await import("../src/lib/integracoes/azuz-flow-lista");
  const { dependenciasReaisDaLista } = await import("../src/lib/integracoes/azuz-flow-lista-reais");

  const { workspaceId, funilId, etapaA, etapaB } = await montarWorkspace();
  const deps = dependenciasReaisDaLista(workspaceId);

  const lead = (i: number, extra: Record<string, unknown> = {}) => ({
    id: `lead-${i}`,
    nome: `Pessoa ${i}`,
    email: `pessoa${i}@exemplo.com`,
    whatsapp: `5562990000${String(i).padStart(3, "0")}`,
    empresa: null,
    instagram: null,
    segmento: null,
    ...extra,
  });

  const enviar = (leads: ReturnType<typeof lead>[], etapaId = etapaA, seJaTemCard: "manter" | "mover" = "manter") =>
    receberListaDoFlow({
      payload: {
        origem: { listaId: "lista-1", rotulo: "Flow: No show" },
        destino: { funilId, etapaId, seJaTemCard },
        leads,
      },
      deps,
    });

  try {
    // ------------------------------------------------------------- contato e card novos
    console.log("\n1. contato novo, card novo");
    {
      const r = await enviar([lead(1)]);
      if ("erro" in r) throw new Error(r.erro);
      conferir("contato criado", r.resultados[0].contato === "criado", r.resultados[0].contato);
      conferir("card criado", r.resultados[0].card === "criado", r.resultados[0].card);
      const contato = await prisma.contato.findFirst({ where: { workspaceId, nome: "Pessoa 1" } });
      conferir("etiqueta carimbada", JSON.stringify(contato?.etiquetas ?? []).includes("Flow: No show"));
      conferir("card na etapa escolhida", (await prisma.negocioCard.count({ where: { workspaceId, etapaId: etapaA } })) === 1);
    }

    // ------------------------------------------------------------- reaproveita quem já existe
    console.log("\n2. acha quem já existe (WhatsApp, e-mail, nome)");
    {
      const porTelefone = await enviar([lead(1, { nome: "Outro nome", email: "outro@exemplo.com" })]);
      if ("erro" in porTelefone) throw new Error(porTelefone.erro);
      conferir("mesmo telefone reaproveita o contato", porTelefone.resultados[0].contato === "existente");
      conferir("sem contato duplicado", (await prisma.contato.count({ where: { workspaceId } })) === 1);

      const porEmail = await enviar([lead(1, { whatsapp: null, nome: "Mais outro" })]);
      if ("erro" in porEmail) throw new Error(porEmail.erro);
      conferir("mesmo e-mail reaproveita o contato", porEmail.resultados[0].contato === "existente");

      const porNome = await enviar([lead(99, { nome: "Pessoa 1", whatsapp: null, email: null })].map((l) => ({ ...l, email: "zz@exemplo.com" })));
      if ("erro" in porNome) throw new Error(porNome.erro);
      conferir("nome igual reaproveita o contato", porNome.resultados[0].contato === "existente");
      conferir("continua um contato só", (await prisma.contato.count({ where: { workspaceId } })) === 1);
    }

    // ------------------------------------------------------------- manter × mover
    console.log("\n3. manter × mover");
    {
      await prisma.negocioCard.updateMany({ where: { workspaceId }, data: { etapaId: etapaB } });

      const manter = await enviar([lead(1)], etapaA, "manter");
      if ("erro" in manter) throw new Error(manter.erro);
      conferir('"manter" não mexe', manter.resultados[0].card === "ja_estava", manter.resultados[0].card);
      conferir("card segue na etapa B", (await prisma.negocioCard.count({ where: { workspaceId, etapaId: etapaB } })) === 1);

      const mover = await enviar([lead(1)], etapaA, "mover");
      if ("erro" in mover) throw new Error(mover.erro);
      conferir('"mover" move', mover.resultados[0].card === "movido", mover.resultados[0].card);
      conferir("card agora na etapa A", (await prisma.negocioCard.count({ where: { workspaceId, etapaId: etapaA } })) === 1);

      const jaNaEtapa = await enviar([lead(1)], etapaA, "mover");
      if ("erro" in jaNaEtapa) throw new Error(jaNaEtapa.erro);
      conferir('"mover" com o card já na etapa não é movimento', jaNaEtapa.resultados[0].card === "ja_estava");
    }

    // ------------------------------------------------------------- gatilho da etapa
    console.log("\n4. o gatilho da etapa dispara na entrada, e só nela");
    {
      await zerar(workspaceId);
      await prisma.gatilhoEtapa.create({
        data: {
          id: `${workspaceId}-gat`,
          workspaceId,
          funilId,
          etapaId: etapaA,
          quando: "movido_ou_criado",
          tipoAcao: "etiqueta",
          acaoDados: { etiqueta: "aquecido" },
          ordem: 0,
          ativo: true,
        },
      });

      await enviar([lead(2)]);
      const depoisDoPrimeiro = await prisma.contato.findFirst({ where: { workspaceId, nome: "Pessoa 2" } });
      conferir(
        "gatilho rodou na criação do card",
        JSON.stringify(depoisDoPrimeiro?.etiquetas ?? []).includes("aquecido"),
        JSON.stringify(depoisDoPrimeiro?.etiquetas ?? []),
      );

      // Reenvio: o card já está na etapa, então NÃO é entrada — e o gatilho não pode rodar de novo.
      await prisma.contato.update({
        where: { workspaceId_nome: { workspaceId, nome: "Pessoa 2" } },
        data: { etiquetas: ["Flow: No show"] },
      });
      await enviar([lead(2)]);
      const depoisDoReenvio = await prisma.contato.findFirst({ where: { workspaceId, nome: "Pessoa 2" } });
      conferir(
        "reenvio NÃO dispara de novo",
        !JSON.stringify(depoisDoReenvio?.etiquetas ?? []).includes("aquecido"),
        JSON.stringify(depoisDoReenvio?.etiquetas ?? []),
      );
    }

    // ------------------------------------------------------------- a mesma lista, de novo
    console.log("\n5. a mesma lista reenviada não duplica nada");
    {
      await zerar(workspaceId);
      const leads = Array.from({ length: 10 }, (_, i) => lead(100 + i));
      await enviar(leads);
      await enviar(leads);
      conferir("dez contatos", (await prisma.contato.count({ where: { workspaceId } })) === 10);
      conferir("dez cards", (await prisma.negocioCard.count({ where: { workspaceId } })) === 10);
    }

    // ------------------------------------------------------------- cinquenta ao mesmo tempo
    console.log("\n6. cinquenta chamadas simultâneas da MESMA pessoa");
    {
      await zerar(workspaceId);
      await Promise.all(Array.from({ length: 50 }, () => enviar([lead(7)])));
      conferir("um contato só", (await prisma.contato.count({ where: { workspaceId } })) === 1);
      conferir("um card só", (await prisma.negocioCard.count({ where: { workspaceId } })) === 1);
    }

    // ------------------------------------------------------------- destino de outra empresa
    console.log("\n7. destino que não é desta empresa");
    {
      const r = await enviar([lead(8)], "etapa-de-outra-empresa");
      conferir("recusa com motivo", "erro" in r, JSON.stringify(r).slice(0, 80));
      conferir("e não escreveu nada", (await prisma.contato.count({ where: { workspaceId, nome: "Pessoa 8" } })) === 0);
    }
  } finally {
    await limpar(workspaceId);
    await prisma.$disconnect();
  }

  console.log(falhas.length ? `\n${falhas.length} FALHA(S):\n- ${falhas.join("\n- ")}` : "\nTudo certo.");
  process.exit(falhas.length ? 1 : 0);
}

void main();
