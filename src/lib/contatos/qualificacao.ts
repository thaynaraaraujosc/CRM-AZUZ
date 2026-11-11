/**
 * COMO QUEM ATENDEU ENXERGA ESTE LEAD.
 *
 * "Coloca pra eu dizer se o cliente é bom, curioso, pra deixar o CRM mais inteligente, o
 * traqueamento mais inteligente — porque todas essas inteligências têm que levar a um lugar, que é
 * um retorno pros anúncios que estão ativos."
 *
 * É a peça que falta no meio do caminho, e ela não pode ser automática. O CRM já sabe o que o lead
 * FEZ (clicou, respondeu, agendou) e já sabe devolver venda ganha pro Google e pra Meta. O que ele
 * não sabe é o que só quem conversou sabe: se aquele era um comprador ou alguém matando tempo. Sem
 * isso, a plataforma só aprende com quem chegou até o fim — e demora semanas pra isso acontecer.
 *
 * TRÊS OPÇÕES, E É DE PROPÓSITO QUE SEJAM TRÊS. Duas (bom/ruim) obrigam a chamar de ruim quem só
 * estava perguntando, e aí ninguém marca nada. Cinco viram uma escala que cada atendente lê de um
 * jeito. "Curioso" é a resposta honesta pra maioria dos leads de anúncio, e separá-la de "ruim" é o
 * que faz a marcação continuar sendo feita depois da primeira semana.
 *
 * O QUE CADA UMA SIGNIFICA PRO ANÚNCIO:
 * - bom: é o sinal positivo. É este que vale a pena devolver como `lead_qualified`.
 * - curioso: não é sinal de nada, e está certo que não seja. Mandar "curioso" como qualificado
 *   ensinaria a plataforma a procurar mais curiosos.
 * - ruim: lead errado (fora da região, fora do preço, engano). Útil pro relatório interno; pra
 *   plataforma, o que vale é a ausência dele entre os bons.
 */

export type Qualificacao = "bom" | "curioso" | "ruim";

export const QUALIFICACOES: { valor: Qualificacao; label: string; descricao: string }[] = [
  { valor: "bom", label: "Bom", descricao: "Tem perfil e interesse de verdade. É este que volta pro anúncio como lead qualificado." },
  { valor: "curioso", label: "Curioso", descricao: "Perguntou, mas não tem intenção agora. Não vira sinal pra plataforma." },
  { valor: "ruim", label: "Ruim", descricao: "Lead errado: fora da região, fora do preço, engano." },
];

export function ehQualificacao(valor: unknown): valor is Qualificacao {
  return valor === "bom" || valor === "curioso" || valor === "ruim";
}

/** O rótulo da qualificação, ou vazio quando ela não foi dada. */
export function rotuloDaQualificacao(valor: unknown): string {
  return QUALIFICACOES.find((q) => q.valor === valor)?.label ?? "";
}

/**
 * Esta qualificação vira sinal pra plataforma de anúncio?
 *
 * Só "bom". É a regra que impede o erro que esvazia o recurso inteiro: devolver "curioso" como
 * lead qualificado faz o algoritmo procurar mais curiosos, e aí a qualificação passa a piorar a
 * campanha em vez de melhorá-la.
 */
export function viraSinalDeAnuncio(valor: unknown): boolean {
  return valor === "bom";
}
