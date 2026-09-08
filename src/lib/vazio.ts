/**
 * Marcador de "campo sem valor". O que aparece na tela quando um negócio não tem valor
 * definido, uma tarefa não tem contato vinculado, um membro ainda não tem leads.
 *
 * Era um travessão (o traço longo). Virou hífen porque o travessão espalhado pela interface dava ao
 * CRM cara de texto gerado por IA.
 *
 * O ponto de atenção: esse marcador não é só visual, ele é **gravado no banco** como valor
 * do campo. Existem registros criados antes dessa troca que continuam com o travessão. Por
 * isso `ehVazio` aceita os dois: se olhasse só o hífen, um contato antigo passaria a exibir
 * o travessão como se fosse um valor real, e as telas que escondem campos vazios (Agenda,
 * Equipe, linha do tempo) voltariam a mostrá-lo.
 */
export const VAZIO = "-";

// Escrito como escape de propósito: uma varredura futura que troque travessões por hífens
// no código não pode apagar justamente a constante que reconhece os registros antigos.
const TRAVESSAO_ANTIGO = "\u2014";

/** `true` quando o campo não tem valor de verdade. Vazio, hífen novo ou travessão antigo. */
export function ehVazio(valor: string | null | undefined): boolean {
  const texto = (valor ?? "").trim();
  return texto === "" || texto === VAZIO || texto === TRAVESSAO_ANTIGO;
}
