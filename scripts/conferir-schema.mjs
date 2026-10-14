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

/**
 * TEMPO DE CONEXÃO MAIOR QUE O PADRÃO.
 *
 * O conector mariadb espera 1 SEGUNDO por padrão pra abrir o socket. Isso serve pra um banco na
 * mesma rede e é curto demais pra um banco remoto visto de uma internet doméstica: o primeiro uso
 * deste script, em 14/10/2026, morreu com "failed to create socket after 1001ms" sem sequer chegar
 * a tentar autenticar. Quinze segundos distingue "está longe" de "não dá pra chegar".
 */
function comTempoDeSobra(databaseUrl) {
  const url = databaseUrl.replace(/^mysql:\/\//, "mariadb://");
  return `${url}${url.includes("?") ? "&" : "?"}connectTimeout=15000&socketTimeout=60000`;
}

/** O endereço, sem usuário nem senha: serve pra conferir se é o servidor certo, e nada além. */
function enderecoVisivel(databaseUrl) {
  try {
    const u = new URL(databaseUrl.replace(/^mysql:\/\//, "http://"));
    return `${u.hostname}:${u.port || "3306"}${u.pathname}`;
  } catch {
    return "(não deu pra ler o endereço da DATABASE_URL)";
  }
}

const endereco = enderecoVisivel(process.env.DATABASE_URL);
console.log(`Conectando em ${endereco} …\n`);

let conexao;
try {
  conexao = await createConnection(comTempoDeSobra(process.env.DATABASE_URL));
} catch (erro) {
  const codigo = erro?.code ?? "";
  console.error(`Não foi possível conectar em ${endereco}.`);
  console.error(`Motivo do driver: ${erro?.message ?? erro}\n`);

  if (codigo === "ER_CONNECTION_TIMEOUT" || codigo === "ETIMEDOUT") {
    console.error(
      [
        "O servidor não respondeu. Isso é diferente de 'recusou': os pacotes estão sumindo,",
        "o que normalmente quer dizer bloqueio de rede, e não banco fora do ar.",
        "",
        "Confira, nesta ordem:",
        "  1. o seu IP de agora está liberado no firewall do banco?",
        "     (IP de internet doméstica muda; o de ontem pode não valer mais)",
        "  2. a porta do banco foi fechada pra fora recentemente?",
        "  3. você está numa rede que bloqueia a porta 3306 (algumas empresas e cafés bloqueiam)?",
        "     Testar pelo celular, com roteamento de dados, costuma responder isso em um minuto.",
      ].join("\n"),
    );
  } else if (codigo === "ECONNREFUSED") {
    console.error("O servidor RECUSOU a conexão: ou o banco não está no ar, ou a porta está errada.");
  } else if (codigo === "ER_ACCESS_DENIED_ERROR") {
    console.error("Chegou no servidor, mas o usuário ou a senha da DATABASE_URL não foram aceitos.");
  } else if (codigo === "ENOTFOUND") {
    console.error("O endereço do servidor não existe (DNS não resolveu). Confira o host da DATABASE_URL.");
  }

  console.error("\nO CRM em produção continua funcionando: ele acessa o banco por outro caminho.");
  console.error("Este script roda do SEU computador, e é esse caminho que está bloqueado.");
  process.exit(1);
}

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
