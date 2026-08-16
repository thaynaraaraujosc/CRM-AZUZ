// Script de uso único — deixa só duas contas ativas (a admin e a de teste "cliente"), sem apagar
// nada: as demais só perdem o acesso (ativo=false), os dados que já apontam pra elas (conversas,
// tarefas etc.) continuam intactos. As duas contas mantidas recebem senha nova.
// Rode com: npx tsx scripts/resetar-contas.ts
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

setDefaultResultOrder("ipv4first");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada — confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

const CONTAS_MANTIDAS: { email: string; senha: string }[] = [
  { email: "thaynaraaraujosc@gmail.com", senha: "@Samantha1401" },
  { email: "ag.azuzdigital@gmail.com", senha: "@Samantha1401" },
];

async function main() {
  const url = process.env.DATABASE_URL!.replace(/^mysql:\/\//, "mariadb://");
  const adapter = new PrismaMariaDb(url);
  const prisma = new PrismaClient({ adapter });

  const emailsMantidos = CONTAS_MANTIDAS.map((c) => c.email);

  for (const conta of CONTAS_MANTIDAS) {
    const membro = await prisma.membro.findUnique({ where: { email: conta.email } });
    if (!membro) {
      console.error(`Conta ${conta.email} não encontrada — nada foi feito pra ela.`);
      continue;
    }
    const hash = await bcrypt.hash(conta.senha, 10);
    await prisma.membro.update({
      where: { id: membro.id },
      data: { senha: hash, ativo: true },
    });
    console.log(`${conta.email}: senha redefinida, conta ativa.`);
  }

  const { count } = await prisma.membro.updateMany({
    where: { email: { notIn: emailsMantidos } },
    data: { ativo: false },
  });
  console.log(`${count} outra(s) conta(s) desativada(s) (dados preservados, só sem acesso).`);

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
