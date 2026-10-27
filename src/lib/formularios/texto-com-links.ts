/**
 * Separa um texto escrito à mão em pedaços de texto e endereços clicáveis.
 *
 * Existe separado de `conversas/formatacao-mensagem.ts` de propósito, e não por falta de busca.
 * Aquele é o leitor de MENSAGEM: além de link, ele reconhece menção (`@5562...`), negrito do
 * WhatsApp e telefone, e o telefone vira os atalhos "WhatsApp" e "Ligar". Isso está certo dentro
 * de uma conversa e errado numa capa de formulário — a empresa escreve "ligue (62) 99999-0000" no
 * texto de apresentação e quem responde ganharia dois botões de atalho no meio de um parágrafo.
 *
 * Aqui é só endereço, e só `http(s)` ou `www.`: nada de `javascript:` virando link numa página
 * que qualquer pessoa abre.
 *
 * Puro, sem React, porque é regra de texto — e regra de texto se prova sem navegador.
 */

export type ParteDeTexto = { texto: string; link: boolean };

const ENDERECO = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;

/** Pontuação que encosta no fim de um endereço e não faz parte dele: "veja em azuz.com." tem um
 *  ponto final, não um endereço terminado em ponto. */
const PONTUACAO_FINAL = /[.,;:!?)\]]+$/;

export function separarLinks(texto: string): ParteDeTexto[] {
  const partes: ParteDeTexto[] = [];
  let fim = 0;

  for (const achado of texto.matchAll(ENDERECO)) {
    const inicio = achado.index ?? 0;
    let endereco = achado[0];

    const sobra = endereco.match(PONTUACAO_FINAL)?.[0] ?? "";
    if (sobra) endereco = endereco.slice(0, -sobra.length);
    if (!endereco) continue;

    if (inicio > fim) partes.push({ texto: texto.slice(fim, inicio), link: false });
    partes.push({ texto: endereco, link: true });
    fim = inicio + endereco.length;
  }

  if (fim < texto.length) partes.push({ texto: texto.slice(fim), link: false });
  return partes;
}

/** O endereço com esquema, pro `href`. "www.azuz.com" sem isto vira caminho relativo. */
export function enderecoCompleto(endereco: string): string {
  return endereco.startsWith("www.") ? `https://${endereco}` : endereco;
}
