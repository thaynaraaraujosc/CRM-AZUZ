import { setDefaultResultOrder } from "node:dns";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

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

/**
 * Monta a URL de conexão. Pura e exportada só pra poder ser provada por teste.
 *
 * O `poolParams` no fim é o que permite ajustar o pool SEM tocar em código nem na `DATABASE_URL`.
 * Isso importa porque duas tentativas de consertar o pool por deploy derrubaram o CRM em
 * produção no mesmo dia, e porque a Vercel mascara o valor das variáveis: abrir a `DATABASE_URL`
 * pra editar traz o campo vazio, e salvar assim apaga a URL do banco e derruba tudo.
 *
 * Com a variável ausente o resultado é IDÊNTICO, caractere por caractere, ao que rodava antes
 * desta linha existir. É isso que torna o deploy inerte: ele não pode quebrar o que não muda.
 * Ver `__tests__/prisma-url.test.ts`.
 */
export function montarUrlDoBanco(databaseUrl: string, poolParams?: string): string {
  let url = databaseUrl.replace(/^mysql:\/\//, "mariadb://");
  url += url.includes("?") ? "&connectionLimit=3" : "?connectionLimit=3";
  url += "&compress=true";
  url += poolParams ?? "";
  return url;
}

function criarPrismaClient() {
  const adapter = new PrismaMariaDb(
    montarUrlDoBanco(process.env.DATABASE_URL!, process.env.DATABASE_POOL_PARAMS),
  );
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
