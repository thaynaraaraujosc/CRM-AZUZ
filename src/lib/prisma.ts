import { setDefaultResultOrder } from "node:dns";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { urlDeConexao } from "@/lib/banco/url-de-conexao";

// Node 18+ prioriza resultado IPv6 na resolução de DNS por padrão. Em redes onde a rota IPv6
// pro host do banco não funciona direito, isso trava a conexão até estourar o timeout do pool
// (em vez de falhar rápido e cair pro IPv4). Forçar IPv4 primeiro evita esse travamento.
setDefaultResultOrder("ipv4first");

/**
 * Instância única do Prisma Client por processo. Cada instância abre um pool de conexões, e o
 * hot-reload do `next dev` recriaria o módulo (e o pool) a cada mudança de arquivo sem esse cache
 * global, esgotando as conexões do banco rapidinho.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarPrismaClient() {
  // Os parâmetros de pool e compressão vivem em `banco/url-de-conexao.ts`, com dois níveis de
  // teste: um que confere a string montada e outro que ABRE conexão num banco de verdade. O
  // segundo existe porque o primeiro sozinho já deixou passar um bug que derrubou o CRM: string
  // bonita não prova nada, quem decide se ela presta é o driver e o servidor.
  const adapter = new PrismaMariaDb(urlDeConexao(process.env.DATABASE_URL!));
  return new PrismaClient({ adapter });
}

/**
 * Criação sob demanda (não no carregamento do módulo). O build do Next.js importa toda rota de
 * API pra analisá-la (`next build`/"collect page data"), sem `DATABASE_URL` disponível nessa etapa
 * no Railway. Um Prisma Client criado eager no import quebrava o build inteiro; este `Proxy` só
 * instancia de verdade no primeiro uso real (dentro de um handler, em runtime, quando a variável
 * já existe).
 */
function obterPrismaClient(): PrismaClient {
  if (!globalParaPrisma.prisma) {
    const cliente = criarPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalParaPrisma.prisma = cliente;
    }
    return cliente;
  }
  return globalParaPrisma.prisma;
}

let instanciaProducao: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, propriedade, receptor) {
    const cliente =
      process.env.NODE_ENV !== "production"
        ? obterPrismaClient()
        : (instanciaProducao ??= criarPrismaClient());
    return Reflect.get(cliente as object, propriedade, receptor);
  },
});
