/**
 * QUEM APARECE NA TELA DE CONTATOS.
 *
 * O problema: a tela mostrava TODO registro de contato, e a maioria nasce sozinha quando chega uma
 * mensagem. O resultado eram 191 linhas, quase todas `@usuario` do Instagram ou um número solto do
 * WhatsApp — sem nome, sem empresa, sem nada que permitisse reconhecer a pessoa. Uma agenda em que
 * não se reconhece ninguém não é uma agenda.
 *
 * A regra agora: Contatos é o que a EQUIPE guardou de propósito. Quem escreveu e ainda não foi
 * salvo continua inteiro em Conversas, no WhatsApp, no Instagram e no funil — que é onde se atende.
 *
 * O registro automático NÃO deixa de existir: é ele que liga conversa, card e automação à mesma
 * pessoa. Ele só deixa de se apresentar como contato.
 *
 * Puro, sem banco: é uma regra de negócio, e regra de negócio se prova sem banco.
 */

export type ContatoParaFiltro = {
  /** Quando alguém da equipe salvou. Nulo = nasceu sozinho e ninguém guardou. */
  salvoEm?: string | Date | null;
  /** "manual", "whatsapp", "instagram", "azuz-flow". */
  criadoVia?: string | null;
};

/**
 * Este contato foi guardado de propósito?
 *
 * `criadoVia === "manual"` conta como sim, e isso é o que dispensa migração de dado: todo contato
 * criado na tela de Contatos antes desta mudança já nasceu assim. Sem essa segunda condição, a
 * tela esvaziaria no dia da publicação e pareceria que os contatos foram perdidos.
 */
export function contatoFoiSalvo(contato: ContatoParaFiltro): boolean {
  if (contato.salvoEm) return true;
  return (contato.criadoVia ?? "manual") === "manual";
}
