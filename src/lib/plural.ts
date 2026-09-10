/**
 * Concordância de número em português, pra contagem que aparece na tela.
 *
 * "1 contatos" e "1 passos" saíam assim em vários lugares porque o texto era montado com o plural
 * fixo grudado no número. Erra sempre no 1, que é justamente o caso mais comum numa conta nova.
 *
 * Zero vai no plural, que é o que se diz em português: "0 contatos", não "0 contato".
 */
export function contagem(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}
