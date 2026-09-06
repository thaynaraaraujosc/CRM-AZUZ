// Restaura um backup gerado por `scripts/backup-banco.ts` para o banco apontado por DATABASE_URL.
//
// Rode com: npx tsx scripts/restaurar-banco.ts backups/crm-azuz-AAAA-MM-DDTHH-MM-SS.json
//
// POR QUE ISTO EXISTE: o backup nasceu antes do restore, e por um dia o projeto teve um arquivo que
// ninguém sabia como usar. Backup sem restauração testada é só um arquivo grande — a hora de
// descobrir que não dá pra voltar não pode ser a hora em que o banco sumiu.
//
// LEIA ANTES DE RODAR:
// - Aponta para o banco da `DATABASE_URL` do `.env`. Confira que é o banco certo.
// - Não apaga nada: usa `skipDuplicates`, então linha que já existe é pulada. Restaurar por cima de
//   um banco com dados MAIS NOVOS não sobrescreve os novos, só devolve o que estava faltando.
// - Roda com a checagem de chave estrangeira DESLIGADA e religa no fim, inclusive se der erro. Sem
//   isso a ordem de inserção teria que ser perfeita, e uma tabela fora de ordem derrubaria tudo.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { readFile } from "node:fs/promises";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";

setDefaultResultOrder("ipv4first");

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: npx tsx scripts/restaurar-banco.ts <caminho-do-backup.json>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada — confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

/** Quantas linhas por `createMany`. Não é o número de linhas que limita, é o TAMANHO: uma linha de
 * `DocumentoBiblioteca` guarda o arquivo inteiro em data URL, e um lote grande estoura o pacote
 * máximo do MySQL com um erro que não diz que o problema foi tamanho. */
const LOTE = 100;

/** Data que o `JSON.stringify` produziu a partir de um `Date`, e só ela: `2026-09-04T22:25:42.123Z`.
 * O padrão é estrito de propósito — o schema tem campos String que guardam data curta
 * (`aaaa-mm-dd`, ver `NegocioCard.data` e `DocumentoBiblioteca.atualizadoEm`), e converter esses
 * para `Date` faria o Prisma recusar a linha inteira. */
const ISO_COMPLETO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function reviverDatas(valor: unknown): unknown {
  if (typeof valor === "string") return ISO_COMPLETO.test(valor) ? new Date(valor) : valor;
  if (Array.isArray(valor)) return valor.map(reviverDatas);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([c, v]) => [c, reviverDatas(v)]));
  }
  return valor;
}

type Backup = {
  geradoEm?: string;
  totalLinhas?: number;
  tabelasAusentes?: string[];
  tabelas: Record<string, Record<string, unknown>[]>;
};

async function main() {
  const backup = JSON.parse(await readFile(arquivo, "utf-8")) as Backup;
  if (!backup?.tabelas) {
    console.error("✗ Arquivo não parece um backup deste projeto (falta a chave \"tabelas\").");
    process.exit(1);
  }

  console.log(`Backup de ${backup.geradoEm ?? "data desconhecida"} — ${backup.totalLinhas ?? "?"} linhas.`);
  if (backup.tabelasAusentes?.length) {
    console.warn(`⚠ Este backup está INCOMPLETO. Ficaram de fora: ${backup.tabelasAusentes.join(", ")}`);
  }
  console.log(`Destino: ${process.env.DATABASE_URL!.replace(/:[^:@]+@/, ":***@")}\n`);

  let inseridas = 0;
  let puladas = 0;
  const problemas: string[] = [];

  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const [tabela, linhas] of Object.entries(backup.tabelas)) {
      if (!linhas.length) {
        console.log(`  ${"0".padStart(7)} × ${tabela}`);
        continue;
      }
      const modelo = prisma[tabela as keyof typeof prisma] as unknown as {
        createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
      };
      if (typeof modelo?.createMany !== "function") {
        problemas.push(`${tabela}: não existe no client do Prisma (rode "npx prisma generate")`);
        console.warn(`  ${"PULADA".padStart(7)} × ${tabela}`);
        continue;
      }

      let contador = 0;
      for (let i = 0; i < linhas.length; i += LOTE) {
        const lote = linhas.slice(i, i + LOTE).map((l) => reviverDatas(l));
        try {
          const r = await modelo.createMany({ data: lote, skipDuplicates: true });
          contador += r.count;
        } catch (erro) {
          // Um lote ruim não pode levar a tabela junto: reinsere linha a linha pra salvar as boas e
          // apontar exatamente qual falhou. Restauração parcial com relatório é muito melhor do que
          // uma tabela inteira perdida por causa de uma linha.
          for (const linha of lote) {
            try {
              const r = await modelo.createMany({ data: [linha], skipDuplicates: true });
              contador += r.count;
            } catch (erroLinha) {
              const msg = erroLinha instanceof Error ? erroLinha.message.split("\n")[0] : String(erroLinha);
              problemas.push(`${tabela}: ${msg}`);
            }
          }
          void erro;
        }
      }
      inseridas += contador;
      puladas += linhas.length - contador;
      console.log(`  ${String(contador).padStart(7)} × ${tabela}${contador < linhas.length ? `  (${linhas.length - contador} já existiam ou falharam)` : ""}`);
    }
  } finally {
    // No `finally`: sair com a checagem desligada deixaria o banco aceitando dado inconsistente
    // depois, e ninguém iria perceber.
    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  }

  console.log(`\n✓ ${inseridas} linhas inseridas, ${puladas} puladas (já existiam ou falharam).`);
  if (problemas.length) {
    console.error(`\n⚠ ${problemas.length} problema(s):`);
    for (const p of problemas.slice(0, 20)) console.error(`  - ${p}`);
    if (problemas.length > 20) console.error(`  ... e mais ${problemas.length - 20}.`);
    process.exit(1);
  }
  console.log(`\n  Abra o CRM e confira as conversas, o funil e os contatos antes de considerar pronto.`);
}

main()
  .catch((erro) => {
    console.error("\n✗ A restauração NÃO foi concluída:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
