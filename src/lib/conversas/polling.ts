/**
 * Intervalo do polling das telas de conversa (lista de conversas e mensagens).
 *
 * Arquivo próprio, sem nenhum import, de propósito: os dois contextos que fazem polling são
 * código de navegador, e a constante não pode morar em `assinatura.ts` porque aquele arquivo puxa
 * `node:crypto`, que não existe no navegador. Os dois contextos precisam bater no MESMO ritmo. Um
 * a 5s e outro a 10s faria a lista de conversas e as mensagens discordarem por alguns segundos.
 *
 * 10s, e não 5s: com o `304 Not Modified` (ver `assinatura.ts`) a batida ficou barata pro banco,
 * mas cada uma ainda é uma execução de função na Vercel, cobrada por execução e por tempo, e uma
 * ida e volta até o banco na Railway. Dobrar o intervalo corta essa conta pela metade, e a
 * diferença entre 5s e 10s pra uma mensagem aparecer não muda como se usa a tela.
 */
export const INTERVALO_POLLING_MS = 10_000;
