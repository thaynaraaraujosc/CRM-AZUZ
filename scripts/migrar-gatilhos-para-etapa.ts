// Traz os gatilhos que hoje moram DENTRO do fluxo para a tabela `GatilhoEtapa`.
//
// Rode com: npx tsx scripts/migrar-gatilhos-para-etapa.ts
// Só pra ver o que aconteceria: npx tsx scripts/migrar-gatilhos-para-etapa.ts --contar
//
// POR QUE ISTO EXISTE: até aqui havia duas formas de dizer "esta automação roda nesta etapa". O
// bloco de gatilho no canvas (com funil e etapa escolhidos no próprio bloco) e a linha em
// `GatilhoEtapa` (a grade "Automatizar" do funil). Duas fontes de verdade pra mesma coisa, e nada
// as conciliava: um fluxo com as duas disparava DUAS vezes pro mesmo lead.
//
// Depois desta migração a etapa é a dona do gatilho, que é o modelo do Kommo e o que a tela do
// funil mostra. O bloco de gatilho continua no fluxo, intocado: ele deixa de disparar (o
// disparador passa a pular fluxos que já têm gatilho de etapa), mas continua desenhado, e é o que
// permite voltar atrás sem perder nada.
//
// É seguro rodar quantas vezes quiser: já existindo um gatilho de etapa equivalente, não cria
// outro.
//
// NÃO migra gatilho de conversa (mensagem recebida, palavra-chave, comentário do Instagram):
// esses não são "entrar numa etapa", não têm etapa a que se prender, e continuam disparando pelo
// bloco como sempre.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import type { FlowNode, GatilhoEtapaData } from "../src/lib/automation-flow/types";

setDefaultResultOrder("ipv4first");

const soContar = process.argv.includes("--contar");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada: confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

/** Que `quando` de `GatilhoEtapa` corresponde a cada bloco de gatilho do canvas. */
const QUANDO_POR_TIPO: Record<string, string> = {
  lead_criado: "criado",
  lead_entrou_etapa: "movido",
  responsavel_alterado: "responsavel_alterado",
};

async function main() {
  const fluxos = await prisma.fluxoAutomacao.findMany({
    where: { arquivada: false },
    select: { id: true, workspaceId: true, nome: true, nodes: true, funilId: true, etapaId: true, ativa: true },
  });

  let criados = 0;
  let jaTinham = 0;
  let semEtapa = 0;

  for (const fluxo of fluxos) {
    const nodes = (fluxo.nodes ?? []) as FlowNode[];
    const gatilho = Array.isArray(nodes) ? nodes.find((n) => n.category === "gatilho") : undefined;
    if (!gatilho) continue;

    const quando = QUANDO_POR_TIPO[gatilho.type];
    if (!quando) continue;

    // A etapa pode estar no bloco (o caso normal) ou no próprio fluxo (formato mais antigo).
    const dados = (gatilho.data ?? {}) as GatilhoEtapaData;
    const etapaId = dados.etapaId || fluxo.etapaId || null;
    if (!etapaId) {
      // Gatilho de etapa sem etapa escolhida. Não dá pra migrar (não se sabe QUAL etapa), e
      // inventar uma seria pior do que deixar como está.
      semEtapa++;
      continue;
    }

    const etapa = await prisma.funilEtapa.findFirst({
      where: { id: etapaId, workspaceId: fluxo.workspaceId },
      select: { id: true, funilId: true, titulo: true },
    });
    if (!etapa) {
      semEtapa++;
      continue;
    }

    const existente = await prisma.gatilhoEtapa.findFirst({
      where: { workspaceId: fluxo.workspaceId, etapaId: etapa.id, fluxoId: fluxo.id },
      select: { id: true },
    });
    if (existente) {
      jaTinham++;
      continue;
    }

    console.log(
      `${soContar ? "[seria migrado]" : "→"} "${fluxo.nome}": ${gatilho.type} → etapa "${etapa.titulo}" (${quando})`,
    );
    if (soContar) {
      criados++;
      continue;
    }

    await prisma.gatilhoEtapa.create({
      data: {
        id: `gat-mig-${fluxo.id}`,
        workspaceId: fluxo.workspaceId,
        funilId: etapa.funilId,
        etapaId: etapa.id,
        quando,
        tipoAcao: "robo",
        fluxoId: fluxo.id,
        // Herda o liga/desliga do fluxo: uma automação pausada não pode voltar a disparar só
        // porque o gatilho mudou de lugar.
        ativo: fluxo.ativa,
        ordem: 0,
      },
    });
    criados++;
  }

  console.log(
    soContar
      ? `\n(--contar: nada foi gravado.) ${criados} gatilho(s) de etapa seriam criados.`
      : `\n✓ ${criados} gatilho(s) de etapa criados.`,
  );
  if (jaTinham) console.log(`  ${jaTinham} fluxo(s) já tinham gatilho de etapa. Nada foi duplicado.`);
  if (semEtapa) {
    console.log(`  ${semEtapa} fluxo(s) têm gatilho de etapa SEM etapa escolhida e ficaram como estavam.`);
  }
  console.log("  Os blocos de gatilho continuam no canvas. Nada foi apagado.");
}

main()
  .catch((erro) => {
    console.error("\n✗ A migração NÃO foi concluída:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
