/**
 * DE QUAL NÚMERO SÃO OS LEADS DESTE FUNIL.
 *
 * "Eu criei um funil com o nome do Lucas Chaveiro, é o funil do número 26. Por que que esse número
 * lá não está os contatos que eu estou conversando lá?" E: "tem que ter a opção de ver qual que é o
 * número do funil".
 *
 * A ligação já existia, e é aí que estava o problema: ela mora nos metadados da CONEXÃO
 * (`metadados.funilId`, em Configurações → WhatsApp), que é o lugar certo pra gravar e o lugar
 * errado pra descobrir. Quem abre o funil está olhando o funil, e não tinha como saber se ele
 * recebe de algum número — nem se recebe de nenhum, que é o padrão e o caso da maioria.
 *
 * A pergunta aqui é a INVERSA da gravada: dado um funil, quais números apontam pra ele. Pode ser
 * nenhum (o funil recebe o que não tem número próprio, que é o comportamento de sempre) e pode ser
 * mais de um — dois celulares da mesma equipe no mesmo quadro é arranjo legítimo, e esconder o
 * segundo faria a tela mentir.
 *
 * Função pura, sem rede: é regra, e regra tem teste.
 */

/** O que esta regra precisa saber de um número conectado. Ver `NumeroDeWhatsApp`. */
export type NumeroComFunil = {
  /** `contaCanal` da conexão. Vazio em conexão de QR Code cujo número o CRM ainda não descobriu. */
  chave: string;
  nome: string;
  provedor: string;
  status: string;
  /** O funil pra onde vão os leads deste número. `null` = o padrão da empresa. */
  funilId: string | null;
};

/**
 * Os números que mandam lead pra este funil, na ordem em que vieram.
 *
 * DESCONECTADO CONTINUA NA LISTA. O vínculo é configuração, não estado: um número que caiu (QR
 * Code expirado, token vencido) volta a receber quando reconectar, e sumir daqui enquanto isso
 * faria a tela dizer "este funil não é de número nenhum" — que é outra coisa, e a diferença
 * importa justamente na hora de investigar por que o lead não chegou.
 */
export function numerosDoFunil<T extends NumeroComFunil>(numeros: T[], funilId: string): T[] {
  if (!funilId) return [];
  return numeros.filter((n) => n.funilId === funilId);
}

/**
 * A FRASE DA ETIQUETA, do ponto de vista de quem está olhando o funil.
 *
 * Nenhum número apontando pra cá não é um defeito a sinalizar: é a configuração da maioria das
 * contas, e a frase diz o que acontece na prática ("recebe o que não tem número próprio") em vez
 * de um "sem número" que se lê como erro.
 */
export function rotuloDoNumeroDoFunil(numeros: NumeroComFunil[], funilId: string): string {
  const meus = numerosDoFunil(numeros, funilId);
  if (!meus.length) return "Todos os números";
  if (meus.length === 1) return meus[0].nome;
  return `${meus[0].nome} +${meus.length - 1}`;
}

/**
 * Vale mostrar a etiqueta?
 *
 * Só com dois ou mais números conectados. Com um só, "o funil deste número" e "o funil da empresa"
 * são a mesma coisa, e a etiqueta seria um controle que nunca muda nada do que está na tela — o
 * mesmo critério de `precisaEscolherNumero` na caixa de entrada.
 */
export function valeMostrarNumeroDoFunil(numeros: NumeroComFunil[]): boolean {
  return numeros.filter((n) => n.status === "conectado" && n.chave).length > 1;
}
