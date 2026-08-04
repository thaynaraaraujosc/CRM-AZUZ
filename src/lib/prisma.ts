import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Instância única do Prisma Client por processo — cada instância abre um pool de conexões, e o
 * hot-reload do `next dev` recriaria o módulo (e o pool) a cada mudança de arquivo sem esse cache
 * global, esgotando as conexões do banco rapidinho.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarPrismaClient() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  return new PrismaClient({ adapter });
}

export const prisma = globalParaPrisma.prisma ?? criarPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
