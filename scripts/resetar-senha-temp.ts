// Script de uso único — troca a senha de uma conta específica direto no banco, pra recuperar
// acesso quando o e-mail de redefinição não está chegando (ex.: Resend não configurado em
// produção). Rode com: npx tsx scripts/resetar-senha-temp.ts <email> <nova-senha>
// Depois de logar, troque essa senha em Configurações > Segurança > Redefinir senha.
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

const [, , email, novaSenha] = process.argv;
if (!email || !novaSenha) {
  console.error("Uso: npx tsx scripts/resetar-senha-temp.ts <email> <nova-senha>");
  process.exit(1);
}

async function main() {
  // O driver @prisma/adapter-mariadb só aceita o prefixo mariadb:// — mesma conversão de
  // src/lib/prisma.ts, pro .env poder usar mysql:// (formato que o CLI do Prisma exige) sem
  // precisar manter duas variáveis diferentes.
  const url = process.env.DATABASE_URL!.replace(/^mysql:\/\//, "mariadb://");
  const adapter = new PrismaMariaDb(url);
  const prisma = new PrismaClient({ adapter });

  const membro = await prisma.membro.findUnique({ where: { email } });
  if (!membro) {
    console.error(`Nenhum membro encontrado com o e-mail ${email}.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  await prisma.membro.update({
    where: { id: membro.id },
    data: { senha: hash, ativo: true },
  });

  console.log(`Senha de ${email} redefinida com sucesso.`);
  console.log("Troque essa senha assim que entrar (Configurações > Segurança > Redefinir senha).");

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
