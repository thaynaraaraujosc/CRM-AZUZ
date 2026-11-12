/**
 * Os campos de `Conversa` que o navegador pode escrever. LISTA FECHADA.
 *
 * O `PATCH /api/conversas/[id]` fazia `data: dados` — o corpo da requisição inteiro, direto pro
 * Prisma. A tipagem em TypeScript parecia uma lista fechada, mas tipo não existe em tempo de
 * execução: qualquer campo que o navegador mandasse era gravado. Entre eles:
 *
 * - `workspaceId`: mover a conversa — com todo o histórico de mensagens — pra outra empresa.
 *   Escrita cruzando workspaces, que é exatamente o que o isolamento existe pra impedir.
 * - `nome`: a camada de mensagens é indexada pelo nome da conversa. Trocá-lo por fora separa a
 *   thread das próprias mensagens.
 * - `contato`: o telefone de destino. Reescrevê-lo manda a próxima mensagem pra outra pessoa.
 *
 * Nada disso era intenção de ninguém; era o `data: dados` fazendo o que ele faz. É o mesmo defeito
 * que `contatos/campos-editaveis.ts` já tinha corrigido do outro lado, com as mesmas palavras — e
 * a lição que ele já registrou vale aqui: campo novo no schema não entra sozinho.
 */

export const CAMPOS_CONVERSA_EDITAVEIS = [
  "naoLidas",
  "favorita",
  "arquivada",
  "status",
  "atendenteSelecionado",
  "fotoUrl",
  /**
   * POR QUAL CONEXÃO ESTA CONVERSA FALA AGORA.
   *
   * "Eu fui mandar uma mensagem pela API oficial. Esse número eu já conversava pelo QR Code. E aí
   * simplesmente voltou para não oficial. (…) Eu abri um número no WhatsApp oficial, não mandei
   * mensagem, e quando eu saí e entrei de novo ele foi lá para as mensagens do QR Code."
   *
   * É o campo que decide em qual aba a conversa mora. Ele entra na lista porque passou a ser
   * escrito de propósito: quando alguém manda uma mensagem por OUTRA conexão, a conversa passa a
   * acontecer ali, e continuar listando-a na aba antiga é a tela discordando do que acabou de
   * acontecer. A rota confere o valor contra as conexões da empresa antes de gravar.
   */
  "contaCanal",
] as const;

/** Filtra o corpo recebido, deixando passar só o que está na lista. */
export function somenteCamposDeConversa(corpo: Record<string, unknown>): Record<string, unknown> {
  const limpo: Record<string, unknown> = {};
  for (const campo of CAMPOS_CONVERSA_EDITAVEIS) {
    if (corpo[campo] !== undefined) limpo[campo] = corpo[campo];
  }
  return limpo;
}
