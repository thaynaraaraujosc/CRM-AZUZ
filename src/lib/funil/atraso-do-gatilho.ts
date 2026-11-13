/**
 * ESPERAR ANTES DE AGIR, nos gatilhos de entrada na etapa.
 *
 * "Imediatamente quando movido para esta etapa, ou depois de 5 minutos, ou depois de 10 minutos,
 * ou um dia. Ou eu posso selecionar o intervalo."
 *
 * Até aqui todo gatilho de etapa rodava no instante em que o card se mexia. Isso cobre "mande a
 * boas-vindas", e não cobre o resto do trabalho de verdade: "espere dez minutos antes de cobrar",
 * "no dia seguinte pergunte se ficou alguma dúvida". Sem a espera, a única saída era pôr um bloco
 * de pausa dentro do robô — o que obriga a criar um robô pra cada tempo e esconde a espera dentro
 * de um fluxograma, longe de onde ela foi decidida.
 *
 * O NÚMERO É SEMPRE MINUTOS. A tela oferece atalhos e um campo de horas+minutos, e todos cabem num
 * inteiro só. Guardar valor+unidade (como o `espera*` do "sem resposta" faz) seriam duas colunas
 * pra representar "1440", e duas chances de elas discordarem.
 */

/** Os atalhos da lista, na ordem em que aparecem. Zero é "imediatamente", e é o padrão. */
export const ATALHOS_DE_ATRASO: { minutos: number; label: string }[] = [
  { minutos: 0, label: "Imediatamente" },
  { minutos: 5, label: "Depois de 5 minutos" },
  { minutos: 10, label: "Depois de 10 minutos" },
  { minutos: 60 * 24, label: "Um dia" },
];

/** Um teto de 30 dias: acima disso não é mais automação de etapa, é outra coisa. */
export const ATRASO_MAXIMO_MINUTOS = 60 * 24 * 30;

/**
 * O atraso gravado, normalizado.
 *
 * Nulo, negativo, quebrado ou acima do teto viram zero — imediatamente, que é como o gatilho se
 * comportava antes desta coluna existir e o único padrão que não surpreende ninguém.
 */
export function minutosDeAtraso(cru: number | null | undefined): number {
  if (typeof cru !== "number" || !Number.isFinite(cru)) return 0;
  const inteiro = Math.floor(cru);
  if (inteiro <= 0) return 0;
  return Math.min(inteiro, ATRASO_MAXIMO_MINUTOS);
}

/** Horas e minutos digitados viram o total. Campo vazio conta como zero, não como erro. */
export function minutosDoIntervalo(horas: number | string | null | undefined, minutos: number | string | null | undefined): number {
  const h = Math.max(0, Math.floor(Number(horas) || 0));
  const m = Math.max(0, Math.floor(Number(minutos) || 0));
  return minutosDeAtraso(h * 60 + m);
}

/** O total de volta em horas e minutos, pros dois campos da tela. */
export function intervaloEmHorasEMinutos(total: number | null | undefined): { horas: number; minutos: number } {
  const t = minutosDeAtraso(total);
  return { horas: Math.floor(t / 60), minutos: t % 60 };
}

/** Este atraso é um dos atalhos, ou é intervalo digitado à mão? */
export function ehAtalho(minutos: number | null | undefined): boolean {
  return ATALHOS_DE_ATRASO.some((a) => a.minutos === minutosDeAtraso(minutos));
}

/**
 * A frase do atraso, pra linha cinza do cartão no funil.
 *
 * Em português de gente: "depois de 1h30", não "depois de 90 minutos". Quem escolheu uma hora e
 * meia não quer ler noventa.
 */
export function rotuloDoAtraso(minutos: number | null | undefined): string {
  const t = minutosDeAtraso(minutos);
  if (t === 0) return "Imediatamente";
  const atalho = ATALHOS_DE_ATRASO.find((a) => a.minutos === t);
  if (atalho) return atalho.label;

  const { horas, minutos: resto } = intervaloEmHorasEMinutos(t);
  if (horas === 0) return `Depois de ${resto} min`;
  if (resto === 0) return `Depois de ${horas}h`;
  return `Depois de ${horas}h${String(resto).padStart(2, "0")}`;
}

/** Quando esta execução deve acontecer, a partir do instante em que o lead entrou na etapa. */
export function quandoRodar(entrouEm: Date, minutos: number | null | undefined): Date {
  return new Date(entrouEm.getTime() + minutosDeAtraso(minutos) * 60_000);
}
