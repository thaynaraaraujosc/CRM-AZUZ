/**
 * "COMEÇOU A ME SEGUIR": o que dá pra saber, e quando dá pra saber.
 *
 * O Instagram NÃO avisa quando alguém aperta Seguir. Não existe campo de webhook pra isso (os que
 * existem são mensagem, comentário, comentário de live, reação e menção), e não existe endereço
 * pra perguntar quem passou a seguir — a API devolve só o TOTAL de seguidores, que não diz quem.
 *
 * O que a Meta devolve é a RELAÇÃO, no perfil de quem interage: `is_user_follow_business`, que o
 * CRM guarda em `Contato.igSegueVoce`. Então o que é possível saber é uma transição: alguém que o
 * CRM conhecia como NÃO seguidor aparece, numa interação, como seguidor. Isso é um fato, com hora
 * e com pessoa — e é o que este gatilho dispara.
 *
 * O LIMITE, DITO SEM RODEIO: o robô percebe no primeiro contato depois do Seguir (um comentário,
 * uma resposta de story, um Direct), e não no instante do clique. Quem segue e some não é
 * percebido, porque não há nada a perceber: a conta não recebe evento nenhum.
 *
 * É por isso que a função mora aqui e não dentro do webhook: a regra é uma só, tem teste, e o dia
 * em que a Meta passar a avisar de verdade, é aqui que o "antes" vai mudar de origem.
 */

/**
 * A pessoa ACABOU de virar seguidora?
 *
 * `antes` é o que estava gravado no contato; `agora` é o que a Meta acabou de devolver.
 *
 * NÃO SABER NÃO É "NÃO SEGUIA". `antes === null` (contato novo, ou perfil que nunca foi
 * consultado) não dispara: é a primeira vez que o CRM olha, e tudo que ele sabe é que a pessoa
 * segue AGORA. Tratar isso como "começou agora" faria o robô dar as boas-vindas a quem segue
 * desde o ano passado e acabou de comentar — e essa mensagem errada chega como deboche.
 */
export function virouSeguidor(antes: boolean | null | undefined, agora: boolean | null | undefined): boolean {
  if (agora !== true) return false;
  return antes === false;
}
