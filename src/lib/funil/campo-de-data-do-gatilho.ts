/**
 * O GATILHO QUE SE PRENDE A UMA DATA DO CONTATO.
 *
 * "Vou criar um gatilho que vai ativar tal hora antes ou depois."
 *
 * Os gatilhos programados que existiam marcavam uma hora do RELÓGIO: todo dia às 12h, ou numa data
 * exata. Isso não serve pro que mais aparece numa clínica — "lembrar 24 horas antes da consulta",
 * "perguntar como foi 2 horas depois". Aí a hora não é do relógio: é relativa a uma data que está
 * na ficha de cada lead, e cada lead tem a sua.
 *
 * A ÂNCORA É UM CAMPO DE DATA DO CONTATO: um campo criado pela empresa (tipo "data", ver
 * `contatos/campos-do-contato.ts`) ou o `nascimento`, que é coluna do contato. O deslocamento é
 * em horas, com sinal: negativo é ANTES, positivo é DEPOIS, zero é na hora exata.
 *
 * CAMPO DE DATA NÃO TEM HORA, e isso é uma escolha da tela de contato (`<input type="date">`).
 * Sem hora, a data vale como MEIA-NOITE daquele dia — e é por isso que "24 horas antes" de uma
 * consulta do dia 12 dispara às 00:00 do dia 11, não numa hora comercial qualquer. É o
 * comportamento previsível; quem quiser a hora da consulta precisa de um campo com hora, que é
 * outra entrega.
 */

export const CAMPO_NASCIMENTO = "nascimento";

/** Um teto de um ano pra cada lado: acima disso o gatilho não está mais ligado àquela data. */
export const OFFSET_MAXIMO_HORAS = 24 * 365;

export function horasDeDeslocamento(cru: number | null | undefined): number {
  if (typeof cru !== "number" || !Number.isFinite(cru)) return 0;
  const inteiro = Math.trunc(cru);
  if (inteiro > OFFSET_MAXIMO_HORAS) return OFFSET_MAXIMO_HORAS;
  if (inteiro < -OFFSET_MAXIMO_HORAS) return -OFFSET_MAXIMO_HORAS;
  return inteiro;
}

/**
 * A data gravada no campo vira um instante local.
 *
 * Aceita "AAAA-MM-DD" (o que o `<input type="date">` grava) e "AAAA-MM-DDTHH:MM", pro dia em que
 * um campo guardar hora também. Qualquer outra coisa devolve `null` — e `null` quer dizer "este
 * lead não entra nesta varredura", nunca "use hoje".
 */
export function instanteDoCampo(valor: string | null | undefined, offsetHoras: number): Date | null {
  const texto = (valor ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(texto);
  if (!m) return null;

  const [, ano, mes, dia, hh, mm] = m;
  const a = Number(ano);
  const me = Number(mes);
  const d = Number(dia);
  if (me < 1 || me > 12 || d < 1 || d > 31) return null;

  // Hora LOCAL de propósito: a data foi escolhida no calendário de quem preencheu a ficha, e a
  // varredura compara com o relógio do servidor, que é o mesmo critério dos outros programados.
  const base = new Date(a, me - 1, d, Number(hh ?? 0), Number(mm ?? 0), 0, 0);
  // Data impossível ("2026-02-31") rola pro mês seguinte no construtor. Isso é dado errado na
  // ficha, não uma data a adivinhar.
  if (base.getMonth() !== me - 1 || base.getDate() !== d) return null;

  return new Date(base.getTime() + horasDeDeslocamento(offsetHoras) * 3_600_000);
}

/** Este minuto é o minuto deste lead? Compara minuto a minuto, como a varredura faz. */
export function ehOMinutoDoCampo(
  valor: string | null | undefined,
  offsetHoras: number,
  agora: Date,
): boolean {
  const alvo = instanteDoCampo(valor, offsetHoras);
  if (!alvo) return false;
  return (
    alvo.getFullYear() === agora.getFullYear() &&
    alvo.getMonth() === agora.getMonth() &&
    alvo.getDate() === agora.getDate() &&
    alvo.getHours() === agora.getHours() &&
    alvo.getMinutes() === agora.getMinutes()
  );
}

/** A frase do gatilho, pra linha cinza do cartão no funil. */
export function rotuloDoCampoDeData(nomeDoCampo: string, offsetHoras: number | null | undefined): string {
  const h = horasDeDeslocamento(offsetHoras ?? 0);
  const campo = nomeDoCampo.trim() || "um campo de data";
  if (h === 0) return `Na data de ${campo}`;
  const quantas = Math.abs(h);
  const unidade = quantas === 1 ? "hora" : "horas";
  return h < 0 ? `${quantas} ${unidade} antes de ${campo}` : `${quantas} ${unidade} depois de ${campo}`;
}
