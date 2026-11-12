/**
 * A CONTA DE ANÚNCIOS DO META: COMO SE ESCOLHE E O QUE O ESTADO DELA QUER DIZER.
 *
 * "E se essa campanha tiver errada? Eu tô achando que essa conta não é essa conta. Como que eu
 * faço pra escolher? Porque pode ter várias páginas lá."
 *
 * Duas coisas que vale separar, porque a Meta mistura os nomes:
 *
 *  · PÁGINA do Facebook é a identidade que publica — o perfil da empresa.
 *  · CONTA DE ANÚNCIOS é a carteira: é ela que tem campanha, orçamento e fatura.
 *
 * Campanha mora na conta de anúncios, e é por isso que é ela que o CRM precisa saber. Uma mesma
 * empresa pode ter várias (a da agência, a do cliente, a velha de teste), e uma conta de anúncios
 * pode anunciar por várias páginas.
 *
 * Até aqui o CRM escolhia sozinho, no fim do OAuth, e nunca mais perguntava. Agora a escolha
 * automática é só o PRIMEIRO palpite — e é esta função, com teste, em vez de uma linha solta
 * dentro da rota de callback.
 */

export type ContaDeAnuncios = {
  id: string;
  name: string;
  account_status: number;
  currency: string;
};

/**
 * Os estados que a Meta devolve em `account_status`, em português de quem precisa resolver.
 *
 * Importa porque conta desativada ou com fatura em aberto **para de entregar e some dos
 * relatórios** — e, da tela do CRM, isso é indistinguível de "não tem campanha". Dizer o estado é
 * o que separa "escolhi a conta errada" de "a conta está suspensa".
 */
export function rotuloDoStatusDaConta(status: number): string {
  switch (status) {
    case 1:
      return "Ativa";
    case 2:
      return "Desativada";
    case 3:
      return "Com pendência de pagamento";
    case 7:
      return "Em análise de risco";
    case 8:
      return "Aguardando acerto de fatura";
    case 9:
      return "Em período de carência";
    case 100:
      return "Em processo de encerramento";
    case 101:
      return "Encerrada";
    default:
      return "Estado desconhecido";
  }
}

/**
 * A conta escolhida automaticamente ao conectar: a primeira ATIVA, e só então a primeira da lista.
 *
 * O palpite tem que existir — sem conta gravada a tela de Tráfego não teria o que ler, e obrigar
 * a escolher antes de ver qualquer coisa é pior pra quem só tem uma. Mas é palpite, e a tela diz
 * isso: quando há mais de uma conta, o seletor aparece com todas, pra pessoa conferir qual é.
 *
 * `null` quando não há nenhuma — caso em que conectar não faz sentido e quem chama avisa.
 */
export function escolherContaPadrao<T extends { account_status: number }>(contas: T[]): T | null {
  return contas.find((c) => c.account_status === 1) ?? contas[0] ?? null;
}
