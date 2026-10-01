/**
 * O que fazer com um evento `messages.upsert` da Evolution: processar ou jogar fora, e por quê.
 *
 * Pura de propósito, e separada da rota por um motivo concreto: esta é a decisão que fazia mensagem
 * desaparecer sem deixar rastro, e decisão que some precisa de teste.
 *
 * O `type` DEIXOU DE SER MOTIVO DE DESCARTE, e essa é a correção.
 *
 * A rota descartava todo evento cujo `type` não fosse exatamente `"notify"`, tratando qualquer
 * outro valor como sincronização de histórico. Mas no Baileys (que é o que roda dentro da
 * Evolution) `"append"` não quer dizer histórico: quer dizer "mensagem anexada à conversa", que é
 * como chegam, entre outras, as mensagens de GRUPO e as espelhadas de outro aparelho. O efeito era
 * o pior possível: o CRM respondia `200 OK`, não gravava a mensagem e não registrava descarte
 * nenhum. Do lado de quem usa, "mensagem de grupo não chega no CRM", sem nada em lugar nenhum
 * dizendo que ela chegou e foi descartada.
 *
 * Quem protege contra o flood de histórico são as outras duas travas, que continuam de pé e são as
 * que de fato funcionam:
 *
 * 1. O tamanho do lote, aqui embaixo. Histórico vem em rajada; mensagem ao vivo vem uma a uma.
 * 2. A idade de cada mensagem, já dentro de `processarMensagemRecebida`.
 *
 * A trava de idade foi criada exatamente porque o `type` não é confiável (a Evolution já mandou o
 * histórico inteiro do celular sem marcar `type` de jeito nenhum, e foi isso que floodou o banco).
 * Ou seja: a defesa real nunca foi o `type`. Ele só adicionava um jeito silencioso de perder
 * mensagem legítima.
 */

/** Mensagem ao vivo chega uma de cada vez, ou em rajadas bem pequenas. Um lote grande num evento
 *  só é sincronização de histórico. */
export const MAXIMO_MENSAGENS_POR_LOTE = 20;

export type DecisaoDeLote =
  | { acao: "processar"; mensagens: unknown[]; tipo: string | null }
  | { acao: "descartar"; motivo: string; detalhe: string };

export function decidirSobreLote(bruto: { messages?: unknown[]; type?: string } | null | undefined): DecisaoDeLote {
  // A Evolution normalmente manda uma mensagem só, já achatada, direto em `data`. Dependendo da
  // versão/configuração ela repassa o formato bruto do Baileys (`{ messages: [...], type }`).
  const mensagens = Array.isArray(bruto?.messages) ? bruto.messages : [bruto];
  const tipo = bruto?.type ?? null;

  if (mensagens.length > MAXIMO_MENSAGENS_POR_LOTE) {
    return {
      acao: "descartar",
      motivo: "lote grande",
      detalhe: `${mensagens.length} mensagens de uma vez${tipo ? ` (type: ${tipo})` : ""}`,
    };
  }

  return { acao: "processar", mensagens, tipo };
}
