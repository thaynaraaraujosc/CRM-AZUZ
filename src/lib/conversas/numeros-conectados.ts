/**
 * OS NÚMEROS DE WHATSAPP, do ponto de vista da caixa de entrada.
 *
 * Com um número, a caixa de entrada é "as conversas da empresa". Com a API oficial no número
 * principal e o celular de um vendedor no QR Code, ela passa a ser duas caixas no mesmo lugar — e
 * quem atende precisa poder ver só a sua, senão a lista vira um amontoado em que a conversa da
 * outra pessoa aparece do mesmo jeito que a dela.
 *
 * A COMPARAÇÃO É PELO `contaCanal` INTEIRO, não pelo telefone. No QR Code a identidade da conexão
 * é o número; no canal oficial é o `phoneNumberId` da Meta, e o telefone é só um rótulo. Comparar
 * dígitos funcionaria num canal e, em silêncio, em nenhum no outro — e "em silêncio" aqui quer
 * dizer um filtro que não devolve nada sem dizer por quê.
 *
 * Aqui mora só a parte que decide; a tela usa. É função pura porque é regra, e regra tem teste.
 */

export type NumeroConectado = {
  /** `contaCanal` da conexão: `meta_whatsapp:<id>` ou `whatsapp_nao_oficial:<numero>`. */
  chave: string;
  provedor: string;
  slot: number;
  nome: string;
  /** O nome que a empresa deu a este número. `null` = nunca nomeado. */
  apelido: string | null;
  numeroLegivel: string;
  status: string;
};

/**
 * POR QUAL CANAL ESTE NÚMERO FALA, em duas palavras.
 *
 * "Se for oficial, aparecer API oficial; se for QR Code, aparecer QR Code." Não é detalhe técnico:
 * os dois canais têm regras diferentes do lado de quem atende — o oficial tem janela de 24 horas e
 * modelo aprovado, o QR Code não tem nenhum dos dois. Saber por qual deles a conversa corre muda o
 * que dá pra fazer nela.
 */
export function canalDoNumero(provedor: string): string {
  return provedor === "meta_whatsapp" ? "API oficial" : "QR Code";
}

/**
 * A ETIQUETA DE UMA CONVERSA: o nome que a empresa deu ao número, ou o canal dele.
 *
 * O número cru saía na linha da conversa, e ali ele confunde: a linha é sobre o CONTATO, e um
 * telefone escrito nela se lê como o telefone da pessoa. "No lugar de colocar o número que eu
 * estou respondendo, pra pessoa não confundir achando que é o número da pessoa, coloca se é QR
 * Code ou se é API oficial. Ou nomeia com o nome que eu nomear."
 *
 * Então: o apelido quando existe — é o que ela escolheu —, e o canal quando não existe. O número
 * sai de cena; quem quiser vê-lo tem a aba lá em cima, que é onde se escolhe de qual número falar.
 */
export function etiquetaDoNumero(numero: Pick<NumeroConectado, "apelido" | "provedor">): string {
  const apelido = numero.apelido?.trim();
  return apelido || canalDoNumero(numero.provedor);
}

/** De `contaCanal` pra etiqueta da conversa. Mesmo papel de `mapaDeNumeros`, outro rótulo. */
export function mapaDeEtiquetas(numeros: NumeroConectado[]): Map<string, string> {
  return new Map(numeros.filter((n) => n.chave).map((n) => [n.chave, etiquetaDoNumero(n)]));
}

/** De `contaCanal` pro nome que aparece na tela. */
export function mapaDeNumeros(numeros: NumeroConectado[]): Map<string, string> {
  return new Map(numeros.filter((n) => n.chave).map((n) => [n.chave, n.nome]));
}

/**
 * O nome do número por onde esta conversa fala. `null` quando não dá pra saber.
 *
 * `whatsapp_baileys:` é o nome ANTIGO do canal de QR Code, e ainda está gravado em conversa de
 * antes da renomeação. Sem esta tradução, essas conversas apareceriam sem etiqueta nenhuma numa
 * lista em que todas as outras têm.
 */
export function nomeDoNumeroDaConversa(
  mapa: Map<string, string>,
  contaCanal: string | null | undefined,
): string | null {
  if (!contaCanal) return null;
  return mapa.get(normalizarContaCanal(contaCanal)) ?? null;
}

function normalizarContaCanal(contaCanal: string): string {
  return contaCanal.startsWith("whatsapp_baileys:")
    ? `whatsapp_nao_oficial:${contaCanal.slice("whatsapp_baileys:".length)}`
    : contaCanal;
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
  escolhido: string,
): boolean {
  if (escolhido === "Todos") return true;
  /*
   * Conversa SEM marca não pertence a número nenhum, e some quando um é escolhido.
   *
   * É histórico anterior à coluna existir. Mostrá-la em todo filtro seria dizer que ela é de cada
   * um dos números, o que é falso em pelo menos um dos casos — e quem filtrou "Closer — João"
   * está perguntando o que é dele, não o que pode ser de qualquer um.
   */
  if (!contaCanal) return false;
  return normalizarContaCanal(contaCanal) === escolhido;
}
