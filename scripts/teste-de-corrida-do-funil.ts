/**
 * Mede a corrida de entrada de lead contra um banco DE VERDADE.
 *
 * O que ele responde: com N chamadas simultâneas de `receberLeadDoFlow`, o CRM termina com um
 * contato, uma conversa e um card por pessoa, e um registro de entrega por chave de idempotência?
 * Três cenários, N = 2, 3 e 8, 20 rodadas cada.
 *
 * POR QUE ELE EXISTE, mesmo havendo teste automatizado: o teste em memória não reproduz a ordem em
 * que um banco de verdade intercala leituras e gravações entre conexões diferentes de um pool. Foi
 * um teste como este, em 14/10/2026, que encontrou o card duplicado que nenhum teste de unidade
 * tinha pegado.
 *
 * ---
 *
 * NUNCA RODE ISTO CONTRA PRODUÇÃO. Ele grava dezenas de contatos, conversas e cards.
 *
 * Por isso ele NÃO lê `DATABASE_URL`: se lesse, um `.env` de produção na raiz do projeto faria o
 * script apontar pro banco dos clientes sem ninguém notar. Ele exige `DATABASE_URL_CORRIDA`, que
 * só existe se alguém a tiver definido de propósito, e ainda pede a confirmação explícita.
 *
 * Rode com:
 *   DATABASE_URL_CORRIDA="mysql://..." npx tsx scripts/teste-de-corrida-do-funil.ts --confirmo
 *
 * Tudo que ele cria fica sob um prefixo próprio (`zz-corrida-<momento>`) e é apagado no fim. Nenhum
 * `deleteMany` deste script alcança linha que ele não tenha criado: todos são filtrados pelo
 * workspace de teste, que nasce e morre aqui dentro.
 */
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";

setDefaultResultOrder("ipv4first");

const URL_DO_TESTE = process.env.DATABASE_URL_CORRIDA;
const CONFIRMADO = process.argv.includes("--confirmo");

if (!URL_DO_TESTE) {
  console.error(
    [
      "Falta DATABASE_URL_CORRIDA.",
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

const PREFIXO = `zz-corrida-${Date.now()}`;
const PARALELAS = [2, 3, 8];
const RODADAS = 20;

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(URL_DO_TESTE.replace(/^mysql:\/\//, "mariadb://")),
});

type Falha = { cenario: string; n: number; rodada: number; motivo: string };

async function criarWorkspaceDeTeste(): Promise<string> {
  const id = PREFIXO;
  await prisma.workspace.create({ data: { id, nome: "Corrida (teste)", slug: id } });
  await prisma.funil.create({ data: { id: `${id}-funil`, workspaceId: id, nome: "Comercial" } });
  await prisma.funilEtapa.create({
    data: { id: `${id}-etapa`, funilId: `${id}-funil`, workspaceId: id, titulo: "Novo", ordem: 0 },
  });
  return id;
}

/** Apaga só o que este script criou. Na ordem das dependências, de dentro pra fora. */
async function limpar(workspaceId: string) {
  await prisma.negocioCard.deleteMany({ where: { workspaceId } });
  await prisma.funilEtapa.deleteMany({ where: { workspaceId } });
  await prisma.funil.deleteMany({ where: { workspaceId } });
  await prisma.leadRecebido.deleteMany({ where: { workspaceId } });
  await prisma.mensagemExtra.deleteMany({ where: { workspaceId } });
  await prisma.conversa.deleteMany({ where: { workspaceId } });
  await prisma.compromisso.deleteMany({ where: { workspaceId } });
  await prisma.contato.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
}

async function contar(workspaceId: string) {
  const [contatos, conversas, cards, entregas] = await Promise.all([
    prisma.contato.count({ where: { workspaceId } }),
    prisma.conversa.count({ where: { workspaceId } }),
    prisma.negocioCard.count({ where: { workspaceId } }),
    prisma.leadRecebido.count({ where: { workspaceId } }),
  ]);
  return { contatos, conversas, cards, entregas };
}

async function zerarDados(workspaceId: string) {
  await prisma.negocioCard.deleteMany({ where: { workspaceId } });
  await prisma.leadRecebido.deleteMany({ where: { workspaceId } });
  await prisma.mensagemExtra.deleteMany({ where: { workspaceId } });
  await prisma.conversa.deleteMany({ where: { workspaceId } });
  await prisma.compromisso.deleteMany({ where: { workspaceId } });
  await prisma.contato.deleteMany({ where: { workspaceId } });
}

async function main() {
  const { receberLeadDoFlow, dependenciasReais } = await import("../src/lib/integracoes/azuz-flow-lead");
  const { validarPayloadDoFlow } = await import("../src/lib/integracoes/azuz-flow-payload");

  function montarLead(respostaId: string, dados: Record<string, unknown>) {
    const r = validarPayloadDoFlow({
      origem: { formularioId: "f1", formularioNome: "Consultoria grátis", respostaId },
      lead: dados,
      respostas: [],
      consentimento: { whatsapp: { aceitou: true, texto: null, em: null } },
    });
    if (!r.ok) throw new Error(`payload inválido: ${r.erro}`);
    return r.lead;
  }

  const workspaceId = await criarWorkspaceDeTeste();
  const falhas: Falha[] = [];

  /**
   * Os três cenários. Cada um devolve as chamadas a disparar em paralelo e o que esperar depois.
   *
   * O WhatsApp oficial não está conectado neste workspace de teste, então a conversa não é criada —
   * o esperado de conversas é 0, e isso é o comportamento correto (lead entra sem conversa e com
   * aviso). O que este script mede é CONTATO, CARD e ENTREGA, que é onde a corrida mordia.
   */
  const cenarios = [
    {
      nome: "pessoas diferentes, mesmo nome",
      leads: (n: number, rodada: number) =>
        Array.from({ length: n }, (_, i) =>
          montarLead(`${PREFIXO}-r${rodada}-${i}`, {
            nome: "Marina",
            sobrenome: "Alves",
            whatsapp: `55629963400${String(i).padStart(2, "0")}`,
          }),
        ),
      esperado: (n: number) => ({ contatos: n, cards: n, entregas: n }),
    },
    {
      nome: "mesma pessoa, entregas diferentes",
      leads: (n: number, rodada: number) =>
        Array.from({ length: n }, (_, i) =>
          montarLead(`${PREFIXO}-r${rodada}-${i}`, { nome: "Ana", sobrenome: "Souza", whatsapp: "5562996340438" }),
        ),
      esperado: (n: number) => ({ contatos: 1, cards: 1, entregas: n }),
    },
    {
      nome: "mesma entrega (mesma chave de idempotência)",
      leads: (n: number, rodada: number) => {
        const unico = montarLead(`${PREFIXO}-r${rodada}`, {
          nome: "Ana",
          sobrenome: "Souza",
          whatsapp: "5562996340438",
        });
        return Array.from({ length: n }, () => unico);
      },
      esperado: () => ({ contatos: 1, cards: 1, entregas: 1 }),
    },
  ];

  try {
    for (const cenario of cenarios) {
      for (const n of PARALELAS) {
        let limpas = 0;
        for (let rodada = 0; rodada < RODADAS; rodada++) {
          await zerarDados(workspaceId);

          const resultados = await Promise.allSettled(
            cenario.leads(n, rodada).map((lead) =>
              receberLeadDoFlow({ workspaceId, lead, deps: dependenciasReais(workspaceId) }),
            ),
          );

          const estouradas = resultados.filter((r) => r.status === "rejected");
          const contagem = await contar(workspaceId);
          const esperado = cenario.esperado(n);

          const problemas: string[] = [];
          if (estouradas.length) {
            const motivos = estouradas
              .map((r) => (r as PromiseRejectedResult).reason)
              .map((e) => (e as { code?: string; message?: string }).code ?? (e as Error).message)
              .join(", ");
            problemas.push(`${estouradas.length} chamada(s) estouraram (${motivos})`);
          }
          if (contagem.contatos !== esperado.contatos) {
            problemas.push(`contatos: ${contagem.contatos}, esperado ${esperado.contatos}`);
          }
          if (contagem.cards !== esperado.cards) problemas.push(`cards: ${contagem.cards}, esperado ${esperado.cards}`);
          if (contagem.entregas !== esperado.entregas) {
            problemas.push(`entregas: ${contagem.entregas}, esperado ${esperado.entregas}`);
          }

          if (problemas.length) {
            falhas.push({ cenario: cenario.nome, n, rodada, motivo: problemas.join(" · ") });
          } else {
            limpas++;
          }
        }
        const marca = limpas === RODADAS ? "ok " : "FALHOU";
        console.log(`${marca} ${cenario.nome} · N=${n} · ${limpas}/${RODADAS} rodadas limpas`);
      }
    }
  } finally {
    await limpar(workspaceId);
    await prisma.$disconnect();
  }

  if (falhas.length) {
    console.error(`\n${falhas.length} rodada(s) com problema:`);
    for (const f of falhas.slice(0, 20)) {
      console.error(`  ${f.cenario} · N=${f.n} · rodada ${f.rodada}: ${f.motivo}`);
    }
    if (falhas.length > 20) console.error(`  ... e outras ${falhas.length - 20}`);
    process.exit(1);
  }

  console.log("\nTodas as rodadas limpas: nenhuma exceção, 1 contato e 1 card por pessoa, 1 entrega por chave.");
}

main().catch(async (erro) => {
  console.error("O teste de corrida parou:", erro);
  await limpar(PREFIXO).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
