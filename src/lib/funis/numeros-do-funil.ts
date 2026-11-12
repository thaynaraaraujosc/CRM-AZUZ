/**
 * UM FUNIL PODE TER VÁRIOS NÚMEROS. UM NÚMERO SÓ PODE TER UM FUNIL.
 *
 * "A gente poderia ter a opção de criar um funil onde a gente pode colocar tipo até 10 números.
 * Às vezes o cara quer só um funil porque ele quer organizar — entrada, financeiro — e aí ele quer
 * que todos os números vejam aquele mesmo funil e cada um fique responsável pelo seu quadro."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ISTO AFROUXA METADE DE UMA REGRA QUE ERA DELA, e a outra metade fica de pé.
 *
 * A regra antiga (`numero-do-funil.ts`) era "um funil, um número, escolhido na criação e fixo". O
 * motivo estava escrito e era bom: misturar duas caixas de entrada num quadro só seria
 * irreversível, porque "desfazer isso depois seria adivinhar de qual número era cada card".
 *
 * Esse motivo não vale mais, e não porque alguém mudou de ideia: porque o dado mudou. O card já
 * grava de qual conexão veio (`NegocioCard.contaCanal`), coluna que nasceu pra outra finalidade —
 * esconder negócio de canal desconectado. Com ela, a mistura deixa de ser irreversível: dá pra
 * ver, filtrar e separar por número a qualquer momento. Caiu o motivo, cai a regra.
 *
 * O QUE CONTINUA: um número pertence a NO MÁXIMO UM funil. Isso nunca foi preferência — é física.
 * A mensagem que chega precisa cair num lugar só, e dois funis disputando o mesmo número fariam
 * metade dos leads sumir de um deles sem explicação nenhuma.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * DUAS FONTES, UMA LEITURA. Os funis criados antes desta mudança guardam o número em
 * `Funil.contaCanal`; os novos guardam em `FunilNumero`. Ler os dois juntos é o que faz isto não
 * exigir migração de dado nenhuma — e é o que impede o funil antigo de aparecer "sem número" no
 * dia da publicação, que é como se perde a confiança numa tela.
 *
 * Puro, sem banco: é regra de negócio, e regra de negócio se prova sem banco.
 */

/** O que estas regras precisam saber de um funil. */
export type FunilComNumeros = {
  id: string;
  nome: string;
  /** O número do formato antigo (um só). Ver o comentário acima. */
  contaCanal?: string | null;
  /** Os números do formato novo. Ausente num funil que ainda não foi lido com eles. */
  contaCanais?: string[] | null;
};

/** O que estas regras precisam saber de um número conectado. */
export type NumeroParaFunil = {
  /** `contaCanal` da conexão. Vazio em conexão de QR Code cujo número o CRM ainda não descobriu. */
  chave: string;
  nome: string;
  provedor: string;
  status: string;
};

/**
 * TODOS os números de um funil, sem repetição e na ordem em que aparecem.
 *
 * O `contaCanal` antigo entra primeiro porque, num funil que tem os dois, ele é o original — o que
 * já estava recebendo antes de alguém acrescentar os outros.
 */
export function numerosDoFunil(funil: FunilComNumeros): string[] {
  const todos = [funil.contaCanal, ...(funil.contaCanais ?? [])].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  return [...new Set(todos)];
}

/**
 * O funil que já é deste número, se houver.
 *
 * É o que impede dois quadros disputarem a mesma caixa de entrada. `""` nunca casa: conexão de QR
 * Code sem número descoberto tem chave vazia, e tratá-la como número faria todas elas parecerem o
 * mesmo.
 */
export function funilDoNumero<T extends FunilComNumeros>(funis: T[], chave: string): T | null {
  if (!chave) return null;
  return funis.find((f) => numerosDoFunil(f).includes(chave)) ?? null;
}

/**
 * Os números que ainda podem ser escolhidos — pra um funil novo, ou pra este funil.
 *
 * Só os CONECTADOS e com chave: um número desconectado pode voltar, mas escolhê-lo agora criaria
 * um funil que não recebe nada e ninguém saberia por quê.
 *
 * `funilAtual` é o id do funil sendo EDITADO: os números dele continuam na lista, senão editar um
 * funil mostraria os próprios números como indisponíveis — e desmarcar seria a única saída.
 */
export function numerosDisponiveis<N extends NumeroParaFunil>(
  numeros: N[],
  funis: FunilComNumeros[],
  funilAtual?: string | null,
): N[] {
  return numeros.filter((n) => {
    if (!n.chave || n.status !== "conectado") return false;
    const dono = funilDoNumero(funis, n.chave);
    return !dono || dono.id === funilAtual;
  });
}

/**
 * Esta escolha de números pode ser gravada neste funil?
 *
 * Devolve o motivo em português quando não pode, e `null` quando pode. A mensagem é a que a tela
 * mostra — por isso ela diz QUAL número está preso e em QUAL funil, em vez de "escolha inválida".
 */
export function porQueNaoPodeUsarEstesNumeros(
  escolhidos: string[],
  numeros: NumeroParaFunil[],
  funis: FunilComNumeros[],
  funilAtual?: string | null,
): string | null {
  if (escolhidos.length === 0) return "Escolha pelo menos um número de WhatsApp para este funil.";

  // Repetido na mesma escolha: a tela não deveria permitir, mas o corpo da requisição não vem só
  // da tela. Gravar duplicado estouraria a chave única com um erro que não explica nada.
  if (new Set(escolhidos).size !== escolhidos.length) {
    return "Há um número repetido na escolha.";
  }

  for (const chave of escolhidos) {
    const numero = numeros.find((n) => n.chave === chave);
    if (!numero) return "Um dos números escolhidos não está entre os conectados.";
    if (numero.status !== "conectado") {
      return `“${numero.nome}” não está conectado agora. Um funil ligado a um número desconectado não recebe nada.`;
    }
    const dono = funilDoNumero(funis, chave);
    if (dono && dono.id !== funilAtual) {
      return `“${numero.nome}” já é do funil “${dono.nome}”. Um número só pode alimentar um funil.`;
    }
  }
  return null;
}
