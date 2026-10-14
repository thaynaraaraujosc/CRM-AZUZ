/**
 * Aplica o schema num banco com DADOS REAIS, mostrando antes o que vai fazer e recusando o que for
 * destrutivo.
 *
 * Por que existe, se o build já roda `prisma db push`: porque em 14/10/2026 ele não rodou. O código
 * novo subiu e o banco ficou atrás, em silêncio. Quando isso acontece é preciso aplicar à mão — e
 * aplicar à mão num banco de clientes precisa de mais cuidado do que um comando solto no terminal.
 *
 * O QUE ELE GARANTE, e não é por confiança, é por verificação:
 *
 *   1. Mostra o SQL exato que o `db push` executaria (via `prisma migrate diff`), e por padrão
 *      PARA AÍ, sem aplicar nada.
 *   2. Lê esse SQL e RECUSA se encontrar qualquer comando destrutivo (DROP, TRUNCATE, RENAME,
 *      MODIFY de coluna). "Só aditiva" deixa de ser uma intenção e passa a ser uma conferência.
 *   3. Nunca usa `--accept-data-loss`.
 *   4. Exige confirmação explícita de que existe backup.
 *
 * Rode com:
 *   npx tsx scripts/aplicar-schema-em-producao.ts              → só mostra o SQL
 *   npx tsx scripts/aplicar-schema-em-producao.ts --confirmo   → mostra e aplica
 *
 * ANTES de usar o --confirmo: npx tsx scripts/backup-banco.ts
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const CONFIRMADO = process.argv.includes("--confirmo");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada: confira se o .env existe na raiz do projeto.");
  process.exit(1);
}

/**
 * Comandos que mexem em dado que já existe.
 *
 * `MODIFY`/`CHANGE` entram na lista junto com os óbvios porque mudar o tipo de uma coluna que tem
 * dado é destrutivo mesmo quando o MySQL aceita sem reclamar: um `varchar(191)` virando
 * `varchar(50)` corta o que não couber, em silêncio.
 */
const DESTRUTIVOS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bTRUNCATE\b/i,
  /\bRENAME\b/i,
  /\bMODIFY\s+COLUMN\b/i,
  /\bCHANGE\s+COLUMN\b/i,
  /\bDELETE\s+FROM\b/i,
];

function rodar(comando: string, args: string[]) {
  return spawnSync(comando, args, { encoding: "utf-8", shell: false });
}

/*
 * O `prisma migrate diff` e o `db push` usam o conector do Prisma, que tem tempo de conexão próprio
 * e mais folgado que o 1 segundo do driver cru. Se mesmo assim der tempo esgotado aqui, o problema
 * é de rede e não de tempo: rode antes `npx tsx scripts/conferir-schema.mjs`, que diagnostica a
 * conexão e diz o que conferir.
 */

// 1. O SQL que o `db push` executaria. `migrate diff` não toca no banco: só compara.
/*
 * SINTAXE DO PRISMA 7, conferida contra a versão instalada e não pela memória.
 *
 * O `--from-url` e o `--to-schema-datamodel` do Prisma 6 FORAM REMOVIDOS: a primeira versão deste
 * script usava os dois e morreu com um despejo de ajuda em inglês na mão de quem só queria aplicar
 * o schema. Hoje a origem vem de `--from-config-datasource` (que lê o `datasource.url` do
 * `prisma.config.ts`, e esse lê a `DATABASE_URL`) e o destino de `--to-schema`.
 *
 * `migrate diff` é só leitura: ele compara e imprime, nunca escreve no banco.
 */
const diff = rodar("npx", [
  "prisma",
  "migrate",
  "diff",
  "--from-config-datasource",
  "--to-schema",
  "prisma/schema.prisma",
  "--script",
]);

if (diff.status !== 0) {
  console.error("Não deu pra calcular a diferença entre o schema e o banco:");
  console.error(diff.stderr || diff.stdout);
  process.exit(1);
}

const sql = (diff.stdout ?? "").trim();

if (!sql || /^--\s*This is an empty migration/i.test(sql)) {
  console.log("O banco já está igual ao schema. Nada a aplicar.");
  process.exit(0);
}

console.log("O SQL que seria executado:\n");
console.log(sql);
console.log("");

// 2. A conferência que torna "só aditiva" verificável.
const achados = DESTRUTIVOS.filter((padrao) => padrao.test(sql));
if (achados.length) {
  console.error("========================================================================");
  console.error("RECUSADO: a diferença contém comando DESTRUTIVO.");
  console.error("");
  console.error("  Os padrões encontrados:");
  for (const padrao of achados) console.error(`    ${padrao}`);
  console.error("");
  console.error("  Este script só aplica mudança aditiva (tabela nova, coluna nova e nula).");
  console.error("  Mudança destrutiva num banco com dados de cliente é decisão de gente, com");
  console.error("  plano de volta — não de script.");
  console.error("========================================================================");
  process.exit(1);
}

console.log("Conferido: a diferença é só aditiva (nenhum DROP, TRUNCATE, RENAME ou MODIFY).\n");

if (!CONFIRMADO) {
  console.log("Nada foi aplicado. Pra aplicar:");
  console.log("  1. npx tsx scripts/backup-banco.ts");
  console.log("  2. npx tsx scripts/aplicar-schema-em-producao.ts --confirmo");
  process.exit(0);
}

// 4. Backup: confere se existe algum, e de quando.
const pastaDeBackup = path.join(process.cwd(), "backups");
const backups = existsSync(pastaDeBackup)
  ? readdirSync(pastaDeBackup).filter((n) => n.endsWith(".json")).sort()
  : [];

if (!backups.length) {
  console.error("Não há nenhum arquivo em `backups/`. Rode primeiro:");
  console.error("  npx tsx scripts/backup-banco.ts");
  process.exit(1);
}
console.log(`Backup mais recente encontrado: backups/${backups[backups.length - 1]}`);
console.log("(Se esse backup for antigo, pare e tire um novo antes de seguir.)\n");

// 5. Aplica. SEM `--accept-data-loss`: se o Prisma achar que vai perder dado, o comando falha, e
//    falhar é o resultado certo — a conferência acima diz que não deveria haver nada a perder.
console.log("Aplicando com `prisma db push`...\n");
const push = rodar("npx", ["prisma", "db", "push"]);
process.stdout.write(`${push.stdout ?? ""}${push.stderr ?? ""}`);

if (push.status !== 0) {
  console.error("\nO `db push` falhou. NADA foi aplicado pela metade de propósito: o Prisma aplica");
  console.error("a diferença numa transação quando o banco permite. Confira a mensagem acima.");
  process.exit(push.status ?? 1);
}

console.log("\nAplicado. Agora confira:");
console.log("  npx tsx scripts/conferir-schema.mjs");
