/**
 * QUEM APARECE NA TELA DE CONTATOS.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * A REGRA MUDOU, e vale contar por quê, porque ela mudou duas vezes.
 *
 * ANTES: a tela mostrava TODO registro, e a maioria nasce sozinha quando chega uma mensagem. Eram
 * 191 linhas, quase todas um `@usuario` do Instagram ou um número solto sem nome. Agenda em que
 * não se reconhece ninguém não é agenda. A resposta foi: só mostra o que a equipe guardou de
 * propósito (`salvoEm`).
 *
 * ERA UMA RESPOSTA CERTA PRA PERGUNTA ERRADA. O problema nunca foi "aparece demais": era "aparece
 * o que não dá pra usar". E o preço de exigir salvar à mão apareceu quando o uso ficou claro:
 *
 *   "Os contatos que entram em contato com a gente, as pessoas que conversam com a gente, os
 *   números que a gente salva manualmente, tudo tem que aparecer aqui em contatos, porque é as
 *   pessoas que a gente vai fazer disparo. A Lidiane mandou mensagem, já salva o número dela."
 *
 * Contatos é a LISTA DE DISPARO. Quem escreveu ontem e ninguém lembrou de salvar some da campanha
 * de amanhã — e não dá pra inventar contato na hora de disparar.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * AGORA SÃO DUAS PERGUNTAS, e as duas vêm do que ela disse:
 *
 *  1. DÁ PRA DISPARAR PRA ESSA PESSOA? Precisa de telefone. "Tudo que for de arroba de Instagram,
 *     não precisa salvar nada dentro de contato, apenas os números de WhatsApp." Um `@` sem
 *     telefone não recebe disparo: ele não pertence a esta lista.
 *
 *  2. DÁ PRA SABER PRA QUEM? Precisa de nome. "Se não tiver nome, não coloque aqui em contato,
 *     porque senão a gente não sabe pra quem tá enviando as coisas." Um número cru numa lista de
 *     disparo é a linha que ninguém tem coragem de incluir e ninguém tem coragem de apagar.
 *
 * As duas juntas devolvem a agenda cheia SEM devolver o lixo: entra todo mundo que conversou pelo
 * WhatsApp e tem nome, sai todo `@` do Instagram, sai todo número sem nome.
 *
 * E NINGUÉM SOME DE VEZ: quem está sem nome fica na fila de batismo (`contatoEsperaNome`), que a
 * tela mostra à parte. Dar o nome é o que move a pessoa pra lista — em vez de ela simplesmente
 * não existir, que é como quem não se vê desaparece de verdade.
 *
 * Puro, sem banco: é regra de negócio, e regra de negócio se prova sem banco.
 */

export type ContatoParaFiltro = {
  /** O nome gravado. Pode ser o telefone cru, quando o WhatsApp não deu nome de perfil. */
  nome?: string | null;
  /** O telefone. É ele que torna a pessoa alcançável por disparo. */
  whatsapp?: string | null;
  /** Quando alguém da equipe salvou. Nulo = nasceu sozinho e ninguém guardou. */
  salvoEm?: string | Date | null;
  /** "manual", "whatsapp", "instagram", "azuz-flow". */
  criadoVia?: string | null;
};

/**
 * Isto é um nome, ou são só os dígitos de um telefone?
 *
 * O teste é "tem letra". Não serve olhar só se são todos dígitos: o mesmo número aparece gravado
 * como `5511919749536` e como `+55 (11) 91974-9536`, e o segundo passaria por nome. Qualquer nome
 * de gente tem pelo menos uma letra; nenhum telefone tem.
 */
export function temNomeDeVerdade(nome: string | null | undefined): boolean {
  return !!nome?.trim() && /\p{L}/u.test(nome);
}

/** Tem telefone? Só conta se sobrar dígito de verdade — `"-"` e `""` são o jeito de dizer "não". */
export function temTelefone(whatsapp: string | null | undefined): boolean {
  return (whatsapp ?? "").replace(/\D/g, "").length >= 8;
}

/**
 * Esta pessoa aparece na tela de Contatos?
 *
 * A ordem das checagens é a regra:
 *
 *  · sem nome, não entra — nem salva à mão. É a condição que ela pediu primeiro, e vale pra todo
 *    mundo: a lista existe pra disparar, e disparo sem saber pra quem é o erro que não se desfaz.
 *  · com telefone, entra. É a volta da agenda cheia: quem conversou pelo WhatsApp está aqui sem
 *    ninguém ter que lembrar de salvar.
 *  · sem telefone, só entra quem a equipe criou ou guardou de propósito — e nunca um contato de
 *    Instagram, que é justamente o que ela não quer nesta lista.
 */
export function contatoApareceEmContatos(contato: ContatoParaFiltro): boolean {
  if (!temNomeDeVerdade(contato.nome)) return false;
  if (temTelefone(contato.whatsapp)) return true;
  if ((contato.criadoVia ?? "manual") === "instagram") return false;
  /*
   * Contato sem telefone que a equipe criou à mão continua aparecendo. São as fichas de e-mail, de
   * empresa, de quem ainda não passou o número — e elas existiam antes desta regra. Tirá-las seria
   * a agenda encolhendo sozinha, que é como se perde a confiança numa lista.
   */
  if (contato.salvoEm) return true;
  return (contato.criadoVia ?? "manual") === "manual";
}

/**
 * Esta pessoa está esperando um nome?
 *
 * Tem telefone, conversou, e o CRM não conseguiu descobrir como ela se chama — o WhatsApp dela não
 * tem nome de perfil, ou o nome já pertencia a outro número. É a fila que a tela mostra à parte,
 * pra o número não sumir em silêncio: batizar é o que o move pra lista de verdade.
 */
export function contatoEsperaNome(contato: ContatoParaFiltro): boolean {
  return temTelefone(contato.whatsapp) && !temNomeDeVerdade(contato.nome);
}

/**
 * Mantida porque o nome dela aparece em código antigo e o significado não mudou: "a equipe guardou
 * de propósito". Hoje ela é só UMA das condições — ver `contatoApareceEmContatos`.
 */
export function contatoFoiSalvo(contato: ContatoParaFiltro): boolean {
  if (contato.salvoEm) return true;
  return (contato.criadoVia ?? "manual") === "manual";
}
