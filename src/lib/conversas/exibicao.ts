/**
 * Uma conversa do Instagram cujo nome ainda é o id interno da thread — só dígitos, algo como
 * `3984605438508218`. Acontece quando a busca do @ falha na primeira mensagem: o CRM cai no id pra
 * não perder a mensagem.
 *
 * Mora neste arquivo (sem nada de servidor dentro) porque tanto a tela quanto o webhook precisam
 * dela — e a tela é componente de cliente, que não pode importar nada que puxe o Prisma junto.
 */
export function nomeAindaEhIdCru(nome: string | null | undefined): boolean {
  return !!nome && /^\d{5,}$/.test(nome);
}

/**
 * Como o nome de uma conversa aparece na tela.
 *
 * Existe por causa de um caso só: conversa do Instagram cujo @ nunca foi resolvido (a busca do
 * perfil na Meta falhou, ver o webhook). O CRM guarda o id interno da thread como nome pra não
 * perder a mensagem, e a caixa de entrada acabava mostrando uma linha de dígitos — `3984605438508218`
 * — que não diz nada a quem atende e não serve nem pra achar a pessoa no Instagram.
 *
 * O número não é apagado: ele continua na conversa (e aparece no painel lateral, pra quem precisar
 * dele pra suporte). Aqui é só a vitrine.
 *
 * Quando o @ é resolvido — e ele é tentado de novo a cada mensagem nova — o nome de verdade passa
 * a aparecer sozinho, e esta função sai do caminho.
 */
export function nomeExibido(nome: string): string {
  return nomeAindaEhIdCru(nome) ? "Contato do Instagram" : nome;
}

/** Iniciais do avatar — um id cru viraria "39", que não ajuda ninguém. */
export function iniciaisExibidas(nome: string, initials: string): string {
  return nomeAindaEhIdCru(nome) ? "@" : initials;
}
