// Renomeia a origem "Indicação" para "Salvo manualmente" nos CONTATOS.
//
// Rode com: npx tsx scripts/renomear-origem-indicacao.ts
// Só pra ver o que aconteceria: npx tsx scripts/renomear-origem-indicacao.ts --contar
//
// POR QUE ISTO EXISTE: "Indicação" era a origem gravada em todo contato criado à mão, porque era o
// padrão da rota de criação. Só que indicação é uma afirmação sobre COMO a pessoa chegou (alguém
// a indicou), e o CRM não tem como saber isso: ele só sabe que alguém digitou um nome num
// formulário. O padrão virou "Salvo manualmente", que é o que aquele contato sempre foi de fato, e
// este script acerta o que já estava gravado.
//
// A TELA JÁ FUNCIONA SEM ISTO. `origemNoFiltro` (src/lib/contatos/ordenacao.ts) faz "Indicação"
// cair no filtro "Salvo manualmente", e essa tradução CONTINUA existindo depois desta migração:
// ela é o que segura qualquer base onde o script não tenha rodado. Aqui é só pra o dado no banco
// dizer a mesma coisa que a tela.
//
// ESCOPO, e ele é estreito de propósito:
//
//   - Só `Contato.origem`. `NegocioCard.origem` tem "Indicação" como uma escolha REAL, feita à mão
//     na tela do funil: ali a palavra significa o que diz, e mexer nela apagaria uma informação
//     que alguém digitou de verdade.
//   - Só o valor exato "Indicação". Nada de "contém", nada de acento normalizado.
//
// É seguro rodar quantas vezes quiser: na segunda vez não sobra nada pra renomear.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";

setDefaultResultOrder("ipv4first");

const ANTIGA = "Indicação";
const NOVA = "Salvo manualmente";

const apenasSimular = process.argv.includes("--contar");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada: confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

async function main() {
  const workspaces = await prisma.workspace.findMany({ select: { id: true, nome: true } });

  let total = 0;
  for (const workspace of workspaces) {
    const quantos = await prisma.contato.count({
      where: { workspaceId: workspace.id, origem: ANTIGA },
    });
    if (!quantos) continue;

    console.log(`\n${workspace.nome}`);
    console.log(`  ${apenasSimular ? "[seriam renomeados]" : "→"} ${quantos} contato(s)`);

    if (!apenasSimular) {
      await prisma.contato.updateMany({
        where: { workspaceId: workspace.id, origem: ANTIGA },
        data: { origem: NOVA },
      });
    }
    total += quantos;
  }

  if (!total) {
    console.log('Nenhum contato com origem "Indicação". Nada a fazer.');
    return;
  }

  console.log(
    apenasSimular
      ? `\n(--contar: nada foi gravado.) ${total} contato(s) passariam de "${ANTIGA}" para "${NOVA}".`
      : `\n✓ ${total} contato(s) passaram de "${ANTIGA}" para "${NOVA}".`,
  );
  console.log("  Só a coluna `origem` do contato mudou. Nome, telefone, etapa e histórico ficaram como estavam.");
  console.log("  Negócios do funil não foram tocados: lá a origem Indicação é uma escolha de verdade.");
}

main()
  .catch((erro) => {
    console.error("\n✗ A renomeação NÃO foi concluída:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
