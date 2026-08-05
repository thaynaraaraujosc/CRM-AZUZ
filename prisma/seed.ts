import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { contatos as contatosIniciais, equipe as equipeInicial } from "../src/lib/data";

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

async function main() {
  await semearContatos();
  await semearEquipe();
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
