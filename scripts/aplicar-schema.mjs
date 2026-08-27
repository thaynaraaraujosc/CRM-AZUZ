/**
 * Sincroniza o schema do Prisma com o banco antes do build.
 *
 * Existe porque nada aplicava mudança de banco em produção: o `prisma db push` morava no script
 * `start`, que a Vercel (serverless) nunca executa. Colocá-lo no `build` resolve — a Vercel sempre
 * roda o build e tem a `DATABASE_URL` — mas o repositório também é buildado em ambientes sem banco
 * configurado (o serviço do Railway, por exemplo, não tem nenhuma variável definida), e ali o
 * comando aborta e derruba o build inteiro por uma etapa que nem se aplica.
 *
 * Então: com `DATABASE_URL`, aplica e falha o build se não conseguir — é sinal de problema real.
 * Sem `DATABASE_URL`, avisa e segue, porque não há banco a sincronizar.
 *
 * Sem `--accept-data-loss` de propósito: mudança destrutiva deve falhar o build, e não apagar
 * coluna em silêncio a cada deploy.
 */
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.warn("[schema] DATABASE_URL não definida — pulando a sincronização do banco.");
  process.exit(0);
}

const resultado = spawnSync("npx", ["prisma", "db", "push"], { stdio: "inherit", shell: false });
process.exit(resultado.status ?? 1);
