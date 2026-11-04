import { diasEntre, somarDias } from "@/lib/agenda/fuso";

/**
 * O PERÍODO PEDIDO NA URL, aparado até virar um recorte que existe.
 *
 * Dois jeitos de pedir, um só jeito de representar. `?dias=7` é o atalho das pastilhas (Dia,
 * Semana, Mês, Trimestre); `?de=&ate=` é o intervalo escolhido no calendário. Qualquer um dos
 * dois vira o mesmo par primeiro/último dia, e daí pra frente ninguém mais sabe por qual porta a
 * pergunta entrou.
 *
 * TUDO É APARADO, porque isto é uma URL e qualquer um digita nela — ou guarda nos favoritos um
 * recorte que fazia sentido no mês passado. O fim nunca passa de hoje (não há dado do futuro, e
 * um gráfico com dez barras vazias à direita parece defeito, não resposta), o começo nunca passa
 * do fim, e o tamanho nunca passa do teto.
 */

/**
 * Noventa dias.
 *
 * Não é gosto: a API de insights da Meta não devolve período maior, e oferecer "último ano" na
 * tela seria prometer um recorte que volta vazio.
 */
export const TETO_DE_DIAS = 90;

/** Uma data no formato do `<input type="date">` e do resto do CRM. */
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type Recorte = {
  /** "YYYY-MM-DD" no calendário do fuso da conta. */
  primeiroDia: string;
  ultimoDia: string;
  /** Quantos dias o recorte cobre, contando as duas pontas. */
  periodoDias: number;
};

export function recortePedido(parametros: URLSearchParams, hoje: string): Recorte {
  const de = parametros.get("de");
  const ate = parametros.get("ate");

  if (de && ate && DATA_ISO.test(de) && DATA_ISO.test(ate)) {
    const fim = ate > hoje ? hoje : ate;
    // Começo depois do fim seria um intervalo de zero dia: vira o próprio dia do fim.
    let inicio = de > fim ? fim : de;
    if (diasEntre(inicio, fim) > TETO_DE_DIAS) inicio = somarDias(fim, -(TETO_DE_DIAS - 1));
    return { primeiroDia: inicio, ultimoDia: fim, periodoDias: diasEntre(inicio, fim) };
  }

  const pedido = Number(parametros.get("dias") ?? "7");
  const periodoDias = Number.isFinite(pedido)
    ? Math.min(TETO_DE_DIAS, Math.max(1, Math.trunc(pedido)))
    : 7;
  return { primeiroDia: somarDias(hoje, -(periodoDias - 1)), ultimoDia: hoje, periodoDias };
}
