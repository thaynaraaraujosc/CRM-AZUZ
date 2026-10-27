/**
 * PRAZO PARA CHAMADA EXTERNA. O `fetch` do Node não tem nenhum por padrão.
 *
 * Isto não é zelo preventivo: é o conserto de um defeito que estava em produção. Todo o caminho de
 * RECEBIMENTO de mensagem faz chamadas externas em série antes de gravar a linha no banco — perfil
 * de quem mandou, foto, capa da mídia, download do anexo — e nenhuma delas tinha prazo. Quando uma
 * dessas parava de responder (o CDN da Meta faz isso, e responde devagar com mais frequência
 * ainda), o handler ficava pendurado esperando o socket, que leva MINUTOS pra desistir sozinho. O
 * que acontecia a seguir, em ordem:
 *
 *   1. A função da hospedagem atingia o próprio limite de tempo e era morta no meio.
 *   2. Nada tinha sido gravado, porque o `create` vem depois do download.
 *   3. A Meta reentregava o mesmo evento, e a segunda tentativa às vezes passava.
 *
 * Esse é exatamente o relato de "estava aparecendo, depois sumiu, voltou, depois sumiu de novo": a
 * mesma mensagem chegando ou não conforme o humor do CDN naquele minuto. Com prazo, a chamada
 * desiste rápido, o `catch` que já existe em cada chamador devolve o caso vazio, e a mensagem é
 * gravada com o rótulo em texto — que é o que o código sempre quis fazer ("melhor uma bolha escrita
 * '[Vídeo]' do que uma bolha em branco") e não conseguia, porque nunca chegava ao `catch`.
 *
 * Os prazos são generosos de propósito. A intenção não é cortar chamada lenta, é impedir chamada
 * PENDURADA: a diferença entre esperar três segundos e esperar até a função morrer.
 */

/**
 * Consulta de dados na Graph API (perfil, @, capa da mídia). Resposta pequena; o que demora aqui é
 * a Meta pensando, não o tamanho.
 */
export const PRAZO_CONSULTA_MS = 6_000;

/**
 * Download de arquivo (foto de perfil, anexo, mídia do WhatsApp). Mais folgado porque aqui há
 * megabytes atravessando a rede de verdade, e cortar cedo transformaria mídia lenta em mídia
 * perdida.
 */
export const PRAZO_DOWNLOAD_MS = 15_000;

/**
 * Envio de mensagem. Mais longo que os dois acima: do outro lado existe uma pessoa que apertou
 * "enviar" e está olhando, e desistir cedo significaria dizer que não enviou uma mensagem que pode
 * ter sido enviada — pior do que esperar.
 */
export const PRAZO_ENVIO_MS = 20_000;

/**
 * O `signal` pronto pra passar ao `fetch`.
 *
 * Existe como função em vez de cada chamador escrever `AbortSignal.timeout(...)` por dois motivos:
 * o prazo fica num lugar só, e um `AbortSignal.timeout` criado uma vez e reutilizado em várias
 * chamadas abortaria todas juntas — erro fácil de cometer e difícil de ver, porque só aparece
 * quando a segunda chamada demora.
 */
export function prazoDe(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Isto foi estouro de prazo, e não outra falha de rede?
 *
 * Serve pro log dizer qual das duas foi. "Falha ao baixar anexo" cobre desde "a Meta recusou o
 * token" até "o CDN não respondeu em 15 segundos", e as duas se consertam em lugares diferentes —
 * foi essa indistinção que fez a miniatura ausente parecer problema de permissão por semanas.
 */
export function ehEstouroDePrazo(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  const nome = (erro as { name?: unknown }).name;
  // `AbortSignal.timeout` rejeita com `TimeoutError`; um `abort()` manual, com `AbortError`.
  return nome === "TimeoutError" || nome === "AbortError";
}

/** O motivo, pronto pro log: o prazo quando foi prazo, a mensagem do erro quando foi outra coisa. */
export function motivoDaFalha(erro: unknown, prazoMs: number): string {
  if (ehEstouroDePrazo(erro)) return `não respondeu em ${prazoMs / 1000}s`;
  return erro instanceof Error ? erro.message : String(erro);
}
