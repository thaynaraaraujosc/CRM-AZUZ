/**
 * O que a tela pode AFIRMAR sobre uma integração, conforme o que ela conseguiu ler.
 *
 * Num arquivo próprio, sem React, porque estas duas regras têm consequência real e merecem teste
 * sem precisar renderizar nada.
 *
 * A distinção que elas protegem é entre NÃO SEI e NÃO TEM. São coisas diferentes, e tratá-las como
 * iguais produziu dois defeitos em produção no mesmo cartão, em 14/10/2026: a tela afirmou que a
 * empresa não tinha funil e que o WhatsApp não estava conectado (não sabia: a leitura falhou), e o
 * botão de gerar chave deixou de pedir confirmação justamente quando não dava pra saber se havia
 * chave em uso.
 */
export type SituacaoDaLeitura = "lendo" | "lido" | "falhou";

/**
 * Pergunta antes de gerar?
 *
 * Sim quando há chave, e sim também quando NÃO SE SABE. Gerar derruba a chave anterior na hora, e
 * o preço de errar é o Flow parar de entregar lead sem ninguém perceber — então a dúvida resolve a
 * favor de perguntar. Só não pergunta quando foi lido que não há chave nenhuma.
 */
export function precisaConfirmarAntesDeGerar(situacao: SituacaoDaLeitura, temChave: boolean): boolean {
  if (situacao !== "lido") return true;
  return temChave;
}

/** Descreve o destino do lead (funil, WhatsApp) só quando ele foi lido de verdade. */
export function podeDescreverOEstado(situacao: SituacaoDaLeitura): boolean {
  return situacao === "lido";
}
