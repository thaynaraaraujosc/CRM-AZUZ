/**
 * ESTE SQL PERDE DADO?
 *
 * Nasce de 07/11/2026, de cinco deploys seguidos falhando em 13 segundos. O `prisma db push`
 * recusou a mudança com esta mensagem:
 *
 *   ⚠️ There might be data loss when applying the changes:
 *     • A unique constraint covering the columns [workspaceId,provedor,slot] on the table
 *       Integracao will be added. If there are existing duplicate values, this will fail.
 *   Error: Use the --accept-data-loss flag to ignore the data loss warnings
 *
 * Repare no que ele diz: "SE houver duplicados, isto VAI FALHAR". Não é perda de dado — é uma
 * operação que ou funciona ou é recusada pelo banco, em voz alta, sem apagar nada. (No caso, nem
 * falhar ela podia: a tabela já era única em `[workspaceId, provedor]`, e um índice mais largo que
 * um índice único é único por consequência.)
 *
 * O `db push` não distingue "pode apagar dado" de "pode não aplicar". Ele junta tudo em um aviso
 * só e para. E a política do `aplicar-schema.mjs` — falhar o build quando o banco recusa — estava
 * certa e é a que protege a produção; o que faltava era saber O QUE seria aplicado antes de
 * decidir.
 *
 * Então: nada entra em `--accept-data-loss` sem passar por aqui. Esta função lê o SQL que o Prisma
 * aplicaria e responde se ele DESTRÓI alguma coisa. Só o que não destrói é liberado; o resto
 * continua parando o build, como sempre parou.
 *
 * Pura de propósito: é a decisão que separa "publica" de "não publica", e isso tem teste.
 */

/**
 * Os comandos que tiram dado do banco, em MySQL/MariaDB.
 *
 * `MODIFY`/`CHANGE` entram na lista mesmo sem certeza. Mudança de tipo de coluna ÀS VEZES trunca
 * (VARCHAR(255) → VARCHAR(50) corta o resto em silêncio) e às vezes é inofensiva (NULL → NOT NULL
 * numa coluna cheia). Daqui não dá pra saber qual é, e o lado errado de errar é o que apaga texto
 * de cliente sem ninguém ver. Quem precisar de uma dessas aplica à mão, conferindo.
 *
 * `DROP INDEX`/`DROP CONSTRAINT` NÃO entram: índice não é dado, é caminho pro dado. Derrubar um e
 * criar outro é exatamente o que esta mudança faz.
 */
const DESTRUTIVOS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bTRUNCATE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bMODIFY\s+COLUMN\b/i,
  /\bCHANGE\s+COLUMN\b/i,
  // O Postgres escreve o tipo assim; o projeto é MySQL hoje, mas a proteção não custa nada.
  /\bALTER\s+COLUMN\b[\s\S]{0,80}?\bTYPE\b/i,
];

/** Tira comentários e linhas vazias: um `-- DROP TABLE` num comentário não é um DROP TABLE. */
function semComentarios(sql) {
  return sql
    .split("\n")
    .map((linha) => linha.replace(/--.*$/, ""))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Devolve a lista de comandos destrutivos encontrados. Vazia = nada se perde.
 *
 * Lista e não booleano porque quem chama precisa DIZER o que achou: "o build parou" sem o motivo
 * é o mesmo beco em que este arquivo nasceu.
 */
export function trechosDestrutivos(sql) {
  const limpo = semComentarios(sql ?? "");
  const achados = [];
  for (const comando of limpo.split(";")) {
    const texto = comando.trim();
    if (!texto) continue;
    if (DESTRUTIVOS.some((padrao) => padrao.test(texto))) achados.push(texto.replace(/\s+/g, " "));
  }
  return achados;
}

/** Atalho pra leitura: este SQL pode ser aplicado sem perder dado? */
export function podeAplicarSemPerder(sql) {
  return trechosDestrutivos(sql).length === 0;
}
