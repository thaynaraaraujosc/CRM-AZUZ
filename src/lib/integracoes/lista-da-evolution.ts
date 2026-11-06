/**
 * A LISTA DENTRO DA RESPOSTA DA EVOLUTION, seja qual for o embrulho da versão.
 *
 * Isto existe por causa de um defeito que se parecia com sucesso: a conexão por QR Code conectava,
 * a lista de conversas do celular vinha, a importação andava conversa por conversa e terminava
 * marcada como concluída — e NENHUMA MENSAGEM entrava no CRM.
 *
 * A causa era o formato. Na v2 da Evolution, `/chat/findMessages` responde paginado:
 *
 *   { "messages": { "total": 412, "pages": 3, "currentPage": 1, "records": [ … ] } }
 *
 * O leitor antigo testava `Array.isArray(dados.messages)` — e aqui `messages` é um OBJETO, não um
 * array. Testava `Array.isArray(dados.records)` — e aqui `records` está um nível abaixo. Os dois
 * davam falso, a função devolvia `[]`, e cada conversa era processada com zero mensagem. Sem erro,
 * sem aviso: a importação dizia ter trazido trinta conversas e a tela de Conversas ficava vazia.
 *
 * A lição que fica no código: ler uma resposta de API de terceiro por tentativa e erro de formato
 * precisa cobrir o caso ANINHADO também, porque paginação é a forma mais comum de uma resposta
 * mudar de versão pra versão — e o jeito como ela quebra é silencioso.
 *
 * Pura e testada de propósito: é a única parte disso que dá pra provar sem uma instância da
 * Evolution de pé.
 */

/** Onde a lista pode estar, do mais provável pro menos. */
const CHAVES = ["records", "messages", "chats", "contacts", "data", "items", "results"] as const;

/**
 * Acha o array de itens numa resposta da Evolution.
 *
 * Aceita: o array cru; `{ records: [...] }`; `{ messages: [...] }`; e o paginado
 * `{ messages: { records: [...] } }` — em qualquer combinação dessas chaves, até dois níveis.
 * Qualquer outra coisa vira lista vazia, que é o único resultado honesto pra uma resposta que não
 * dá pra interpretar.
 */
export function listaDaEvolution(dados: unknown): unknown[] {
  if (Array.isArray(dados)) return dados;
  if (!dados || typeof dados !== "object") return [];

  const objeto = dados as Record<string, unknown>;
  for (const chave of CHAVES) {
    const valor = objeto[chave];
    if (Array.isArray(valor)) return valor;
  }
  // Segundo nível: o embrulho de paginação, que é onde a v2 põe a lista de verdade.
  for (const chave of CHAVES) {
    const valor = objeto[chave];
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      const dentro = valor as Record<string, unknown>;
      for (const chaveInterna of CHAVES) {
        const lista = dentro[chaveInterna];
        if (Array.isArray(lista)) return lista;
      }
    }
  }
  return [];
}
