/**
 * O QUE, NESTA BUSCA, É MENSAGEM NOVA DE VERDADE.
 *
 * "Não fica mandando notificação atrasada. Quando eu abri o CRM, aparecem todas as notificações
 * que estavam. Não precisa — só as que chegarem."
 *
 * A regra vive aqui, fora do componente, porque ela é a diferença entre avisar e incomodar — e
 * porque o defeito que ela corrige era invisível de ler no `useEffect`: a foto de referência era
 * tirada antes da busca voltar, então a primeira lista de verdade parecia ter acabado de chegar
 * inteira. Doze conversas por ler viravam doze avisos de mensagens de ontem.
 *
 * `anterior` nulo quer dizer "ainda não houve foto": ninguém é novidade, e quem chama guarda a
 * foto pra próxima. É o abrir do CRM, que não é evento.
 */
export type ConversaParaAviso = {
  id: string;
  nome: string;
  canal: string;
  naoLidas: number;
};

export function conversasComNovidade(
  anterior: Map<string, number> | null,
  atual: readonly ConversaParaAviso[],
): ConversaParaAviso[] {
  if (!anterior) return [];
  return atual.filter((c) => {
    const antes = anterior.get(c.id);
    /*
     * Conversa que não estava na foto e chega COM não lidas é gente escrevendo pela primeira vez
     * — o aviso que menos pode faltar. Chegando lida, é a lista crescendo por outro motivo (uma
     * importação, um contato criado em outra tela), e aí fica calada.
     */
    if (antes === undefined) return c.naoLidas > 0;
    return c.naoLidas > antes;
  });
}

/** A foto desta busca, pra comparar com a próxima. */
export function fotoDasConversas(atual: readonly ConversaParaAviso[]): Map<string, number> {
  return new Map(atual.map((c) => [c.id, c.naoLidas]));
}
