/**
 * OS NÚMEROS DE WHATSAPP, do ponto de vista da caixa de entrada.
 *
 * Com um número, a caixa de entrada é "as conversas da empresa". Com a vendedora e o closer
 * conectados, ela passa a ser duas caixas no mesmo lugar — e quem atende precisa poder ver só a
 * sua, senão a lista vira um amontoado em que a conversa da outra pessoa aparece do mesmo jeito
 * que a dela.
 *
 * Aqui mora só a parte que decide; a tela usa. É função pura porque é regra, e regra tem teste.
 */

export type NumeroConectado = {
  slot: number;
  nome: string;
  numero: string | null;
  status: string;
};

/** De `contaCanal` ("whatsapp_nao_oficial:5562…") pro nome que a empresa deu ao número. */
export function mapaDeNumeros(numeros: NumeroConectado[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const n of numeros) {
    const digitos = (n.numero ?? "").replace(/\D/g, "");
    if (digitos) mapa.set(digitos, n.nome);
  }
  return mapa;
}

/** O nome do número por onde esta conversa fala. `null` quando não dá pra saber. */
export function nomeDoNumeroDaConversa(
  mapa: Map<string, string>,
  contaCanal: string | null | undefined,
): string | null {
  if (!contaCanal) return null;
  const corte = contaCanal.indexOf(":");
  if (corte < 0) return null;
  const digitos = contaCanal.slice(corte + 1).replace(/\D/g, "");
  return digitos ? (mapa.get(digitos) ?? null) : null;
}

/**
 * Vale oferecer o filtro por número?
 *
 * Só com dois ou mais conectados. Com um só, o filtro ofereceria uma escolha entre "todos" e "o
 * único" — um controle a mais na barra que nunca muda nada do que está na tela.
 */
export function precisaEscolherNumero(numeros: NumeroConectado[]): boolean {
  return numeros.filter((n) => n.status === "conectado").length > 1;
}

/** Esta conversa é do número escolhido no filtro? `"Todos"` deixa passar tudo. */
export function conversaDoNumero(
  contaCanal: string | null | undefined,
  numeroEscolhido: string,
): boolean {
  if (numeroEscolhido === "Todos") return true;
  const digitos = (contaCanal ?? "").slice((contaCanal ?? "").indexOf(":") + 1).replace(/\D/g, "");
  /*
   * Conversa SEM marca não pertence a número nenhum, e some quando um é escolhido.
   *
   * É histórico anterior à coluna existir. Mostrá-la em todo filtro seria dizer que ela é de cada
   * um dos números, o que é falso em pelo menos um dos casos — e quem filtrou "Closer — João"
   * está perguntando o que é dele, não o que pode ser de qualquer um.
   */
  return Boolean(digitos) && digitos === numeroEscolhido.replace(/\D/g, "");
}
