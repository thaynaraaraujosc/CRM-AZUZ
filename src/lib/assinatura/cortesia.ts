/**
 * CONTA DE CORTESIA: o CRM liberado, sem cobrança, até uma data.
 *
 * A regra mora aqui, pura, porque ela decide quem usa o produto sem pagar — e isso precisa de
 * teste. No meio da leitura do banco ou do proxy ela só poderia ser exercitada com sessão,
 * requisição e banco em pé.
 *
 * A ideia é simples e o cuidado está nas bordas: enquanto a data não chega, a conta vale como
 * ativa; no dia em que ela chega, a conta volta a ser o que o banco diz — e, se o banco diz
 * "ativa" sem nenhuma cobrança por trás, ela passa a ser "pendente". Sem essa última parte a
 * cortesia nunca terminaria, que é o defeito que a data existe pra evitar.
 */

export type DadosDaAssinatura = {
  status: string;
  cortesiaAte?: Date | string | null;
  /** Vazio quando não existe cobrança de verdade por trás (é o caso de toda cortesia). */
  asaasSubscriptionId?: string | null;
};

function comoData(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A cortesia ainda está valendo nesta data? */
export function cortesiaValendo(assinatura: DadosDaAssinatura, agora: Date = new Date()): boolean {
  const ate = comoData(assinatura.cortesiaAte);
  return ate !== null && ate.getTime() > agora.getTime();
}

/**
 * O STATUS QUE VALE DE VERDADE, considerando a cortesia.
 *
 * É este que o paywall lê, e não a coluna crua. Guardar o vencimento como mudança de coluna
 * dependeria de uma rodada passar na hora certa: enquanto ela não passasse, a conta continuaria
 * entrando. Calculando na leitura, o acesso acaba no segundo marcado, com rodada ou sem.
 */
export function statusEfetivo(assinatura: DadosDaAssinatura, agora: Date = new Date()): string {
  if (cortesiaValendo(assinatura, agora)) return "ativa";

  const ate = comoData(assinatura.cortesiaAte);
  const teveCortesia = ate !== null;
  const temCobrancaDeVerdade = Boolean(assinatura.asaasSubscriptionId?.trim());

  // Cortesia vencida e nenhuma cobrança por trás: a conta precisa cair na tela de pagamento, mesmo
  // que a coluna ainda diga "ativa" — foi a cortesia que a deixou assim.
  if (teveCortesia && !temCobrancaDeVerdade && assinatura.status === "ativa") return "pendente";

  return assinatura.status;
}

/** Quantos dias faltam. Negativo quando já venceu; `null` quando não é cortesia. */
export function diasDeCortesia(assinatura: DadosDaAssinatura, agora: Date = new Date()): number | null {
  const ate = comoData(assinatura.cortesiaAte);
  if (!ate) return null;
  return Math.ceil((ate.getTime() - agora.getTime()) / 86_400_000);
}

/** Os prazos que o painel oferece. Mês "de calendário", que é como a pessoa pensa o prazo. */
export const PRAZOS_DE_CORTESIA = [
  { meses: 1, label: "1 mês" },
  { meses: 3, label: "3 meses" },
  { meses: 6, label: "6 meses" },
  { meses: 12, label: "1 ano" },
] as const;

/**
 * A data em que a cortesia termina, contada em meses de calendário.
 *
 * `setMonth` sozinho transborda: 31 de janeiro mais um mês vira 3 de março, porque fevereiro não
 * tem 31. Numa cortesia isso é pouco, mas é o tipo de coisa que ninguém confere e que faz a conta
 * de alguém vencer num dia que não foi combinado — então o dia é preso ao último do mês.
 */
export function fimDaCortesia(meses: number, inicio: Date = new Date()): Date {
  const fim = new Date(inicio.getTime());
  const dia = fim.getDate();
  fim.setDate(1);
  fim.setMonth(fim.getMonth() + meses);
  const ultimoDia = new Date(fim.getFullYear(), fim.getMonth() + 1, 0).getDate();
  fim.setDate(Math.min(dia, ultimoDia));
  return fim;
}
