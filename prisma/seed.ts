import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { contatos as contatosIniciais, equipe as equipeInicial, tarefas as tarefasIniciais } from "../src/lib/data";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function semearContatos() {
  const total = await prisma.contato.count();
  if (total > 0) {
    console.log(`Tabela Contato já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  await prisma.contato.createMany({
    data: contatosIniciais.map((c) => ({ ...c, etiquetas: c.etiquetas ?? undefined })),
  });
  console.log(`Semeados ${contatosIniciais.length} contatos.`);
}

async function semearEquipe() {
  const total = await prisma.membro.count();
  if (total > 0) {
    console.log(`Tabela Membro já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  await prisma.membro.createMany({
    data: equipeInicial.map((m) => ({ ...m, permissoes: m.permissoes })),
  });
  console.log(`Semeados ${equipeInicial.length} membros da equipe.`);
}

async function semearTarefas() {
  const total = await prisma.tarefaEtapa.count();
  if (total > 0) {
    console.log(`Tabela TarefaEtapa já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  let totalCards = 0;
  for (const [indice, coluna] of tarefasIniciais.entries()) {
    const etapa = await prisma.tarefaEtapa.create({
      data: { id: `etapa-seed-${indice}`, titulo: coluna.titulo, ordem: indice },
    });
    for (const [ordem, card] of coluna.cards.entries()) {
      await prisma.tarefaCard.create({
        data: {
          id: card.id,
          etapaId: etapa.id,
          ordem,
          titulo: card.titulo,
          contato: card.contato,
          contatoId: card.contatoId,
          data: card.data,
          atrasada: card.atrasada ?? false,
          responsavelNome: card.responsavel.nome,
          responsavelInitials: card.responsavel.initials,
          concluida: card.concluida ?? false,
          urgencia: card.urgencia,
          descricao: card.descricao,
          anexoArquivo: card.anexo?.arquivo,
          anexoDetalhe: card.anexo?.detalhe,
          modelo: card.modelo,
        },
      });
      totalCards += 1;
    }
  }
  console.log(`Semeadas ${tarefasIniciais.length} etapas e ${totalCards} tarefas.`);
}

async function main() {
  await semearContatos();
  await semearEquipe();
  await semearTarefas();
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
