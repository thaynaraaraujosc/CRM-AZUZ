/**
 * Os erros do banco que são RESPOSTA, não falha.
 *
 * Num sistema em que vários pedidos chegam ao mesmo tempo, "essa linha já existe" é informação
 * útil: quer dizer que outro pedido gravou primeiro. Tratar isso como erro devolve 500 pra quem
 * chamou, e aí o Flow (ou o webhook da Meta) repete uma entrega que já deu certo.
 */

/**
 * O banco recusou por chave repetida (`P2002`).
 *
 * Conferir o CÓDIGO e não a mensagem: a mensagem vem do MySQL, em inglês, e muda de versão pra
 * versão — "Unique constraint failed on the constraint: PRIMARY" é texto, não contrato.
 */
export function ehChaveDuplicada(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && (erro as { code?: unknown }).code === "P2002";
}
