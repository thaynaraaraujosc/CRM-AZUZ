/**
 * O formato do progresso da importação do histórico do WhatsApp por QR Code.
 *
 * Fica num arquivo sem nenhuma dependência de runtime porque as DUAS pontas precisam dele: o
 * servidor, que grava o progresso dentro de `Integracao.metadados`, e a tela, que mostra o número
 * subindo. Antes cada lado declarava o seu, e os dois já tinham saído de sincronia: o servidor
 * ganhou um campo novo e a tela não sabia que ele existia.
 */
export type ChatNaFila = { remoteJid: string };

export type HistoricoSync = {
  status: "em_andamento" | "pausado" | "concluido" | "erro";
  totalChats: number | null;
  chatsProcessados: number;
  filaRestante: ChatNaFila[] | null;
  /**
   * As conversas ANTIGAS, que ficaram de fora da primeira leva.
   *
   * Por padrão só as mais recentes entram na fila. Numa conta comercial o celular tem centenas de
   * conversas, e importar todas de uma vez foi o que já derrubou o CRM. As que interessam pra
   * trabalhar são as de agora; estas ficam prontas pra entrar quando alguém pedir.
   */
  filaGuardada?: ChatNaFila[] | null;
  /**
   * Quantas vezes a lista de conversas voltou vazia.
   *
   * Existe por causa de uma falha que se parecia com sucesso: recém-conectada, a sessão do WhatsApp
   * ainda não montou a lista de conversas do celular, e a primeira consulta volta vazia. O código
   * gravava "fila vazia", e na rodada seguinte fila vazia virava `concluido`. Resultado: a
   * importação terminava em segundos, com zero conversa, sem erro nenhum, e nunca mais tentava.
   *
   * Com o contador, vazio vira "tenta de novo no próximo minuto" até um teto. Só depois disso é
   * que se conclui de verdade, e aí com o motivo escrito.
   */
  tentativasSemChats?: number;
  erro?: string;
};

/** Quantas conversas entram na primeira leva. Ver `filaGuardada`. */
export const CHATS_NA_PRIMEIRA_LEVA = 30;

/**
 * Quantas rodadas esperar pela lista de conversas antes de desistir.
 *
 * O relógio roda de minuto em minuto, então isto é cerca de quinze minutos: tempo de sobra pra uma
 * sessão recém-lida terminar de sincronizar a lista do celular, e pouco o bastante pra não ficar
 * consultando pra sempre uma conta que realmente não tem conversa nenhuma.
 */
export const TENTATIVAS_MAXIMAS_SEM_CHATS = 15;

/**
 * Separa a primeira leva das conversas guardadas.
 *
 * A lista chega da Evolution já ordenada da mais recente pra mais antiga (ver `buscarChats`), então
 * cortar as primeiras é cortar as que interessam. Quem chega depois espera o pedido explícito.
 */
export function separarPrimeiraLeva(chats: ChatNaFila[]): {
  primeiras: ChatNaFila[];
  guardadas: ChatNaFila[];
} {
  return {
    primeiras: chats.slice(0, CHATS_NA_PRIMEIRA_LEVA),
    guardadas: chats.slice(CHATS_NA_PRIMEIRA_LEVA),
  };
}
