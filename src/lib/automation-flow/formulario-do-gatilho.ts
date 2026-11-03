/**
 * DE QUAL FORMULÁRIO ESTE ROBÔ ATENDE.
 *
 * O bloco "Formulário preenchido" sempre teve um campo `formularioId` no tipo. Nada o preenchia e
 * nada o lia: o disparo não mandava de qual formulário veio o evento, e por isso a comparação não
 * tinha com o que ser feita. O efeito era o defeito relatado — TODO robô de "formulário
 * preenchido" disparava para TODO formulário, do CRM e do AZUZ Flow, e não havia como uma
 * resposta ser diferente da outra.
 *
 * Os dois produtos numerando formulários por conta própria é o detalhe que obriga a um prefixo: um
 * id do Flow e um id do CRM são strings do mesmo feitio, e sem marcar de onde vêm, o dia em que
 * coincidirem um robô do CRM responde a um lead do Flow. A chance é remota e o estrago é mudo —
 * exatamente o tipo de defeito que não se encontra depois.
 */

/** O prefixo que marca um formulário do AZUZ Flow. O do CRM vai sem prefixo nenhum. */
const PREFIXO_DO_FLOW = "flow:";

/** Como um formulário DO CRM é identificado num bloco de gatilho. */
export function identificadorDoFormularioDoCrm(id: string): string {
  return id;
}

/** Como um formulário DO AZUZ FLOW é identificado num bloco de gatilho. */
export function identificadorDoFormularioDoFlow(id: string): string {
  return `${PREFIXO_DO_FLOW}${id}`;
}

/** É um formulário do Flow? Serve pra tela saber onde ele mora. */
export function ehFormularioDoFlow(identificador: string): boolean {
  return identificador.startsWith(PREFIXO_DO_FLOW);
}

/** O id cru de volta, sem o prefixo. */
export function idSemPrefixo(identificador: string): string {
  return ehFormularioDoFlow(identificador)
    ? identificador.slice(PREFIXO_DO_FLOW.length)
    : identificador;
}

/**
 * Este gatilho atende ao formulário que acabou de ser preenchido?
 *
 * BLOCO SEM FORMULÁRIO ESCOLHIDO ATENDE A TODOS, e isso não é descuido: é o comportamento que
 * existia antes desta regra, e é o que todo robô já publicado tem gravado (o campo nunca foi
 * preenchido por ninguém). Passar a exigir escolha faria, na primeira publicação, todo robô de
 * formulário do CRM parar de disparar em silêncio — a pior forma possível de estrear um filtro.
 *
 * EVENTO SEM FORMULÁRIO NÃO ATENDE BLOCO COM FORMULÁRIO. Quando a tela pediu "só o formulário X" e
 * o evento não diz de qual veio, não há como afirmar que é o X. Disparar mesmo assim seria repetir
 * o defeito que esta função existe para consertar, só que agora com a tela prometendo o contrário.
 */
export function gatilhoServeAoFormulario(
  formularioDoBloco: string | null | undefined,
  formularioDoEvento: string | null | undefined,
): boolean {
  const escolhido = formularioDoBloco?.trim();
  if (!escolhido) return true;
  const veio = formularioDoEvento?.trim();
  if (!veio) return false;
  return escolhido === veio;
}
