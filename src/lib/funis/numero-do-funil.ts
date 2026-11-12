/**
 * UM FUNIL, UM NÚMERO. Escolhido na criação e fixo depois.
 *
 * "O funil, quando ele é criado, a gente escolhe um número e esse número é fixo. Nenhum funil pode
 * ter mais do que um número. Não pode receber mensagens de WhatsApps diferentes. (…) Se eu quiser
 * mudar, eu tenho que excluir esse funil e criar outro funil. O funil, ele é só de um número só."
 *
 * A VERSÃO ANTERIOR DISTO ESTAVA DE CABEÇA PRA BAIXO. O vínculo morava nos metadados da conexão
 * (`metadados.funilId`): o NÚMERO apontava pro funil. Nessa direção, dois números podiam apontar
 * pro mesmo quadro, e a tela do funil oferecia um seletor pra trocar o número a qualquer momento —
 * que é o contrário da regra. Trocar o número de um funil que já tem cards mistura duas caixas de
 * entrada num quadro só, e desfazer isso depois seria adivinhar de qual número era cada card.
 *
 * Agora o vínculo é uma coluna do próprio funil (`Funil.contaCanal`), escrita uma vez. "Um funil,
 * um número" vira o formato do dado em vez de uma regra que alguém precisa lembrar de conferir.
 *
 * Função pura, sem rede: é regra, e regra tem teste.
 */

import {
  funilDoNumero as acharFunilDoNumero,
  numerosDisponiveis as disponiveis,
  numerosDoFunil,
  type FunilComNumeros,
} from "@/lib/funis/numeros-do-funil";

/** O prefixo fixo do nome. O resto quem escreve é a pessoa — ver `nomeDoFunil`. */
export const PREFIXO_DO_NOME = "Funil - ";

/** O que esta regra precisa saber de um número conectado. Ver `NumeroDeWhatsApp`. */
export type NumeroParaFunil = {
  /** `contaCanal` da conexão. Vazio em conexão de QR Code cujo número o CRM ainda não descobriu. */
  chave: string;
  nome: string;
  provedor: string;
  status: string;
};

/** O que esta regra precisa saber de um funil. */
export type FunilComNumero = FunilComNumeros;

/**
 * O funil que já é deste número, se houver.
 *
 * É o que impede dois quadros disputarem a mesma caixa de entrada: a mensagem só pode cair num
 * lugar, e dois funis apontando pro mesmo número fariam metade dos leads sumir de um deles sem
 * explicação nenhuma.
 */
export function funilDoNumero<T extends FunilComNumero>(funis: T[], chave: string): T | null {
  // A regra mora em `numeros-do-funil.ts` desde que um funil passou a poder ter vários números.
  // Este nome continua aqui porque três telas o importam, e porque a pergunta que ele responde não
  // mudou: "de quem é este número?".
  return acharFunilDoNumero(funis, chave);
}

/**
 * Os números que ainda podem ser escolhidos ao criar um funil.
 *
 * Só os CONECTADOS e com chave: um número desconectado pode voltar, mas escolher agora um que o
 * CRM nem sabe endereçar criaria um quadro que não recebe nada e não diz por quê. E só os que
 * ainda não têm funil, pelo motivo de `funilDoNumero`.
 */
export function numerosDisponiveis<T extends NumeroParaFunil>(
  numeros: T[],
  funis: FunilComNumero[],
  funilAtual?: string | null,
): T[] {
  return disponiveis(numeros, funis, funilAtual);
}

/**
 * O NÚMERO DESTE FUNIL, como ele aparece na tela. `null` quando o funil não tem número.
 *
 * Sem número é o funil anterior a esta regra: ele continua recebendo o que não tem número próprio.
 * Devolver `null` deixa a tela dizer isso com as palavras dela em vez de inventar um rótulo.
 */
export function numeroDoFunil<T extends NumeroParaFunil>(
  numeros: T[],
  funil: FunilComNumero | null | undefined,
): T | null {
  const primeiro = funil ? numerosDoFunil(funil)[0] : null;
  if (!primeiro) return null;
  return numeros.find((n) => n.chave === primeiro) ?? null;
}

/** TODOS os números deste funil, como aparecem na tela. Vazio = funil sem número. */
export function numerosDoFunilNaTela<T extends NumeroParaFunil>(
  numeros: T[],
  funil: FunilComNumero | null | undefined,
): T[] {
  if (!funil) return [];
  return numerosDoFunil(funil)
    .map((chave) => numeros.find((n) => n.chave === chave))
    .filter((n): n is T => Boolean(n));
}

/**
 * O nome completo, a partir do que a pessoa digitou.
 *
 * "Vai ficar pré-definido que vai chamar funil tracinho. O restante do nome é eu que escolho." O
 * prefixo é fixo pra a lista de funis ficar legível sem ninguém combinar nada; o resto é texto
 * livre ("Meta oficial", "Número do Lucas").
 *
 * Sufixo vazio devolve string vazia, e não o prefixo sozinho: "Funil - " não é nome de nada, e
 * deixar criar com ele produziria dois funis indistinguíveis na lista.
 */
export function nomeDoFunil(sufixo: string): string {
  const limpo = sufixo.trim().replace(/\s+/g, " ");
  return limpo ? `${PREFIXO_DO_NOME}${limpo}` : "";
}

/**
 * O sufixo sugerido quando a pessoa escolhe um número: o nome do número.
 *
 * É só um palpite — o campo continua editável. Mas é o palpite certo na esmagadora maioria dos
 * casos, e poupa digitar o óbvio logo depois de escolher.
 */
export function sufixoSugerido(numero: NumeroParaFunil | null | undefined): string {
  return numero?.nome?.trim() ?? "";
}

/**
 * OS NÚMEROS NA ORDEM DOS FUNIS.
 *
 * "Eu quero que o funil azul seja o primeiro, porque eu quero que lá no chat também ele seja as
 * primeiras respostas. (…) O funil pode ser de acordo com a ordem do funil: se eu arrasto o funil
 * da Azuz para cima, ele fica como primeiro, e aí lá no chat do WhatsApp também ele fica como
 * primeiro."
 *
 * A caixa de entrada abria no primeiro número da lista, e essa lista vinha na ordem em que as
 * conexões foram criadas — que não quer dizer nada pra quem atende. Como cada funil é de um
 * número, a ordem que ela arrasta no menu passa a ser a mesma dos dois lados: uma decisão, dois
 * lugares.
 *
 * Número sem funil vai pro fim, na ordem que já tinha entre eles: ele não participa da decisão, e
 * inventar uma posição pra ele embaralharia o que ela arrumou.
 */
export function numerosNaOrdemDosFunis<T extends NumeroParaFunil>(
  numeros: T[],
  funis: FunilComNumero[],
): T[] {
  const posicao = new Map<string, number>();
  funis.forEach((f, i) => {
    if (f.contaCanal) posicao.set(f.contaCanal, i);
  });

  return [...numeros]
    .map((n, i) => ({ n, i, pos: posicao.get(n.chave) }))
    .sort((a, b) => {
      if (a.pos === b.pos) return a.i - b.i;
      if (a.pos === undefined) return 1;
      if (b.pos === undefined) return -1;
      return a.pos - b.pos;
    })
    .map((x) => x.n);
}
