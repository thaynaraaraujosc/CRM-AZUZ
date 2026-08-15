import { setDefaultResultOrder } from "node:dns";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Node 18+ prioriza resultado IPv6 na resolução de DNS por padrão — em redes onde a rota IPv6
// pro host do banco não funciona direito, isso trava a conexão até estourar o timeout do pool
// (em vez de falhar rápido e cair pro IPv4). Forçar IPv4 primeiro evita esse travamento.
setDefaultResultOrder("ipv4first");

/**
 * Instância única do Prisma Client por processo — cada instância abre um pool de conexões, e o
 * hot-reload do `next dev` recriaria o módulo (e o pool) a cada mudança de arquivo sem esse cache
 * global, esgotando as conexões do banco rapidinho.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarPrismaClient() {
  // O CLI do Prisma (`db push`/`migrate`) exige o prefixo `mysql://` na `DATABASE_URL` (é o
  // provider declarado no schema), mas o driver `@prisma/adapter-mariadb` só aceita `mariadb://`
  // — convertendo aqui, a mesma variável serve pros dois sem o usuário precisar manter duas versões.
  const url = process.env.DATABASE_URL!.replace(/^mysql:\/\//, "mariadb://");
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({ adapter });
}

export const prisma = globalParaPrisma.prisma ?? criarPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
