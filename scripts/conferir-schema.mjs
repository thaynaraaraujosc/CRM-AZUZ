/**
 * SÓ LEITURA: diz o que falta no banco deste ambiente.
 *
 * Nenhum `CREATE`, nenhum `ALTER`, nenhum `UPDATE`. Lê `information_schema` e compara com a lista
 * de estruturas que a versão atual do CRM espera. Pode rodar contra produção sem medo — é a mesma
 * consulta que a rota `/api/saude/banco` faz.
 *
 * Rode com:
 *   npx tsx scripts/conferir-schema.mjs
 *
 * Usa a `DATABASE_URL` do `.env` (ao contrário do teste de corrida, que a recusa de propósito):
 * aqui ler o banco de produção é exatamente o que se quer.
 */
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";

import { createConnection } from "mariadb";

setDefaultResultOrder("ipv4first");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada: confira se o .env existe na raiz do projeto.");
  process.exit(1);
}

/**
 * A MESMA lista de `src/lib/saude/estrutura-do-banco.ts`, repetida aqui de propósito.
 *
 * Importar o módulo arrastaria o Prisma Client e o `@/` do Next pra dentro de um script que precisa
 * rodar com o mínimo possível — inclusive num momento em que o build está quebrado. São dez linhas;
 * divergirem é um risco pequeno e visível, e o teste `estrutura-do-banco.test.ts` compara as duas.
 */
const ESPERADAS = [
  { tabela: "ChaveDeIntegracao", colunas: [] },
  { tabela: "LeadRecebido", colunas: [] },
  {
    tabela: "Contato",
    colunas: [
      "consentimentoWhatsApp",
      "consentimentoWhatsAppEm",
      "consentimentoWhatsAppTexto",
      "consentimentoWhatsAppOrigem",
    ],
  },
];

const conexao = await createConnection(process.env.DATABASE_URL.replace(/^mysql:\/\//, "mariadb://"));

try {
  const [{ banco }] = await conexao.query("SELECT DATABASE() AS banco");
  console.log(`Banco: ${banco}\n`);

  const tabelas = await conexao.query(
    "SELECT TABLE_NAME AS nome FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
  );
  const colunas = await conexao.query(
    "SELECT TABLE_NAME AS tabela, COLUMN_NAME AS nome FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
  );

  const temTabela = new Set(tabelas.map((t) => String(t.nome).toLowerCase()));
  const temColuna = new Set(colunas.map((c) => `${String(c.tabela).toLowerCase()}.${String(c.nome).toLowerCase()}`));

  const faltando = [];
  for (const esperada of ESPERADAS) {
    if (!temTabela.has(esperada.tabela.toLowerCase())) {
      faltando.push(`tabela ${esperada.tabela}`);
      continue;
    }
    console.log(`ok     tabela ${esperada.tabela}`);
    for (const coluna of esperada.colunas) {
      const existe = temColuna.has(`${esperada.tabela.toLowerCase()}.${coluna.toLowerCase()}`);
      if (existe) console.log(`ok     coluna ${esperada.tabela}.${coluna}`);
      else faltando.push(`coluna ${esperada.tabela}.${coluna}`);
    }
  }

  if (faltando.length) {
    console.log("");
    for (const f of faltando) console.log(`FALTA  ${f}`);
    console.log(
      [
        "",
        `${faltando.length} estrutura(s) faltando: o schema desta versão NÃO foi aplicado neste banco.`,
        "",
        "Pra corrigir, na ordem:",
        "  1. npx tsx scripts/backup-banco.ts",
        "  2. npx tsx scripts/aplicar-schema-em-producao.ts        (mostra o SQL e não aplica)",
        "  3. npx tsx scripts/aplicar-schema-em-producao.ts --confirmo",
      ].join("\n"),
    );
    process.exitCode = 1;
  } else {
    console.log("\nTudo presente: o banco tem a estrutura que esta versão do CRM espera.");
  }
} finally {
  await conexao.end();
}
