/**
 * Intervalo do polling das telas de conversa (lista de conversas e mensagens).
 *
 * Arquivo próprio, sem nenhum import, de propósito: os dois contextos que fazem polling são
 * código de navegador, e a constante não pode morar em `assinatura.ts` porque aquele arquivo puxa
 * `node:crypto`, que não existe no navegador. Os dois contextos precisam bater no MESMO ritmo. Um
 * a 5s e outro a 10s faria a lista de conversas e as mensagens discordarem por alguns segundos.
 *
 * 5s, E A CONTA MUDOU DE IDEIA SOBRE ISSO. Esteve em 10s pra cortar pela metade o número de
 * execuções de função na Vercel. A fatura mostrou que essa economia não existia: no ciclo de
 * 15/08 a 14/09 de 2026, atender 683 MIL requisições custou US$ 0,24 — enquanto compilar o projeto
 * custou US$ 20,96. Requisição aqui é barata; o que custa é build. Dobrar o intervalo economizava
 * centavos e cobrava o preço em outro lugar: dez segundos para uma mensagem aparecer, numa tela de
 * atendimento, lê como travamento, e quem usa recarrega a página — que gasta mais do que o polling
 * que se tentou poupar.
 *
 * Os dois contextos que fazem polling (lista de conversas e mensagens) precisam bater no MESMO
 * ritmo: um a 5s e outro a 10s faria a lista e as mensagens discordarem por alguns segundos.
 */
export const INTERVALO_POLLING_MS = 5_000;
