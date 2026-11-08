/**
 * O AVISO DO `prisma db push` DIZ PERDA DE DADO OU DIZ OUTRA COISA?
 *
 * Nasce de 07/11/2026, de seis publicações seguidas morrendo em 13 segundos. O `db push` recusou
 * a mudança com isto:
 *
 *   ⚠️ There might be data loss when applying the changes:
 *     • A unique constraint covering the columns `[workspaceId,provedor,slot]` on the table
 *       `Integracao` will be added. If there are existing duplicate values, this will fail.
 *   Error: Use the --accept-data-loss flag to ignore the data loss warnings
 *
 * Repare no que o próprio aviso diz: SE houver duplicados, isto VAI FALHAR. Não apaga nada — ou
 * aplica, ou o banco recusa em voz alta. (Ali nem falhar podia: a tabela já era única em
 * `[workspaceId, provedor]`, e um índice mais largo que um índice único é único por consequência.)
 *
 * O `db push` junta sob o mesmo título duas coisas de naturezas opostas: "isto apaga dado" e
 * "isto pode não ser aceito". A primeira TEM que parar o build. A segunda parando o build custou
 * horas de trabalho publicado que nunca saiu do lugar, sem nenhum sinal pra quem usa — o site
 * continuava no ar, servindo o build velho.
 *
 * ESTA FUNÇÃO LÊ OS AVISOS, UM A UM. Só passa o que está na lista do que comprovadamente não
 * apaga nada. Qualquer aviso desconhecido — um que o Prisma venha a escrever amanhã, numa versão
 * nova — para o build, que é o lado seguro do erro.
 *
 * A primeira tentativa de consertar isto perguntava o SQL ao Prisma (`migrate diff --script`) e
 * lia os comandos. Falhou na Vercel por um motivo que não dá pra reproduzir sem o banco de
 * produção, e o build continuou travado. Ler o texto que o `db push` JÁ IMPRIMIU não precisa de
 * processo nenhum a mais: é a mesma decisão com uma peça móvel a menos.
 *
 * Pura de propósito: é o que separa "publica" de "não publica", e isso tem teste.
 */

/**
 * Os avisos que NÃO apagam dado.
 *
 * Um só, por enquanto, e de propósito: a lista cresce quando alguém provar que outro aviso é
 * inofensivo, não por precaução. Índice é caminho pro dado, não o dado; criar um é uma operação
 * que ou vale ou é recusada, sempre em voz alta.
 */
const AVISOS_SEGUROS = [
  /unique constraint covering the columns .* will be added/i,
];

/**
 * Pega as linhas de aviso da saída do `db push`.
 *
 * O Prisma lista cada uma começando com `•`; versões antigas usaram `-`. Qualquer linha que
 * comece assim é um aviso, esteja ela sob qual título for — ler o bloco pelo título seria confiar
 * num texto em inglês que muda de versão pra versão.
 */
export function avisosDoPush(saida) {
  return (saida ?? "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.startsWith("•") || /^-\s/.test(linha))
    .map((linha) => linha.replace(/^[•-]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Dá pra aplicar com `--accept-data-loss` sem perder nada?
 *
 * `false` quando não há aviso nenhum reconhecido também: se o `db push` pediu a bandeira e não
 * deu pra ler por quê, não se aplica no escuro.
 */
export function avisosSaoSeguros(saida) {
  const avisos = avisosDoPush(saida);
  if (avisos.length === 0) return { seguro: false, avisos };
  const perigosos = avisos.filter((aviso) => !AVISOS_SEGUROS.some((padrao) => padrao.test(aviso)));
  return { seguro: perigosos.length === 0, avisos, perigosos };
}
