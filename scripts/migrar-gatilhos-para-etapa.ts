// Traz os gatilhos que hoje moram DENTRO do fluxo para a tabela `GatilhoEtapa`.
//
// Rode com: npx tsx scripts/migrar-gatilhos-para-etapa.ts
// Só pra ver o que aconteceria: npx tsx scripts/migrar-gatilhos-para-etapa.ts --contar
//
// Existe também um botão pra isto na tela "Automatizar funil", que faz exatamente o mesmo e não
// precisa de terminal. Este script serve pra rodar em TODOS os workspaces de uma vez (o botão só
// mexe no de quem clicou) e pra ficar o registro do que foi feito.
//
// POR QUE ISTO EXISTE: havia duas formas de dizer "esta automação roda nesta etapa". O bloco de
// gatilho no canvas e a linha em `GatilhoEtapa` (a grade do funil). Nada as conciliava: um fluxo
// com as duas disparava DUAS vezes pro mesmo lead.
//
// A lógica NÃO está aqui: está em `src/lib/funil/migrar-gatilhos.ts`, compartilhada com o botão.
// Duas cópias divergiriam na primeira correção feita só numa delas, que é justamente a classe de
// problema que esta migração resolve.
//
// É seguro rodar quantas vezes quiser: já existindo um gatilho equivalente, não cria outro. Nada
// é apagado: os blocos de gatilho continuam no canvas.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import { migrarGatilhosParaEtapa } from "../src/lib/funil/migrar-gatilhos";

setDefaultResultOrder("ipv4first");

const apenasSimular = process.argv.includes("--contar");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada: confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

async function main() {
  // Todos os workspaces: é o que o script tem de diferente do botão.
  const workspaces = await prisma.workspace.findMany({ select: { id: true, nome: true } });

  let total = 0;
  for (const workspace of workspaces) {
    const resultado = await migrarGatilhosParaEtapa({ workspaceId: workspace.id, apenasSimular });
    if (!resultado.migrados.length && !resultado.semEtapa.length) continue;

    console.log(`\n${workspace.nome}`);
    for (const m of resultado.migrados) {
      console.log(
        `  ${apenasSimular ? "[seria migrado]" : "→"} "${m.fluxoNome}": ${m.tipoGatilho} → etapa "${m.etapaTitulo}" (${m.quando})${m.ativo ? "" : " [pausada]"}`,
      );
    }
    for (const s of resultado.semEtapa) {
      console.log(`  [sem etapa escolhida, ficou como estava] "${s.fluxoNome}"`);
    }
    if (resultado.jaTinham) console.log(`  ${resultado.jaTinham} ja tinha(m) gatilho de etapa.`);
    total += resultado.migrados.length;
  }

  console.log(
    apenasSimular
      ? `\n(--contar: nada foi gravado.) ${total} gatilho(s) de etapa seriam criados.`
      : `\n✓ ${total} gatilho(s) de etapa criados.`,
  );
  console.log("  Os blocos de gatilho continuam no canvas. Nada foi apagado.");
}

main()
  .catch((erro) => {
    console.error("\n✗ A migração NÃO foi concluída:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
