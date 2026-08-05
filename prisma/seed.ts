import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import {
  contatos as contatosIniciais,
  equipe as equipeInicial,
  tarefas as tarefasIniciais,
  funis as funisIniciais,
} from "../src/lib/data";

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

async function semearFunis() {
  const total = await prisma.funil.count();
  if (total > 0) {
    console.log(`Tabela Funil já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  let totalEtapas = 0;
  let totalCards = 0;
  for (const funil of funisIniciais) {
    await prisma.funil.create({ data: { id: funil.id, nome: funil.nome, responsavel: funil.responsavel } });
    for (const [ordemEtapa, coluna] of funil.colunas.entries()) {
      await prisma.funilEtapa.create({
        data: { id: coluna.id, funilId: funil.id, titulo: coluna.titulo, ordem: ordemEtapa },
      });
      totalEtapas += 1;
      for (const [ordemCard, card] of coluna.cards.entries()) {
        await prisma.negocioCard.create({
          data: {
            id: card.id,
            etapaId: coluna.id,
            ordem: ordemCard,
            nome: card.nome,
            valor: card.valor,
            origem: card.origem,
            dias: card.dias,
            data: card.data,
            etiquetas: card.etiquetas ?? undefined,
            responsavel: card.responsavel,
          },
        });
        totalCards += 1;
      }
    }
  }
  console.log(`Semeados ${funisIniciais.length} funis, ${totalEtapas} etapas e ${totalCards} negócios.`);
}

async function main() {
  await semearContatos();
  await semearEquipe();
  await semearTarefas();
  await semearFunis();
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
