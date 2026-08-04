import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { contatos as contatosIniciais } from "../src/lib/data";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
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

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
