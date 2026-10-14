/**
 * Formatação de data e hora no fuso de Brasília.
 *
 * Por que um módulo só para isto: o CRM guarda `Compromisso.dataIso` e `Compromisso.hora` como
 * hora LOCAL (é o que o usuário digitou na agenda), mas o AZUZ Flow entrega o instante da reunião
 * em UTC. Converter na mão com `getHours()` usaria o fuso do servidor — na Vercel, UTC — e uma
 * reunião às 22h de Brasília viraria o dia seguinte. Todo o produto é de clientes brasileiros,
 * então o fuso é fixo: não há configuração por workspace a respeitar.
 */

export const FUSO_BRASILIA = "America/Sao_Paulo";

/** Partes numéricas do instante já convertido para Brasília. */
function partesEmBrasilia(instante: Date) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASILIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    // Sem h23 o Intl devolve "24" para a meia-noite, que não existe em campo de hora.
    hourCycle: "h23",
  }).formatToParts(instante);

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  return {
    ano: valor("year"),
    mes: valor("month"),
    dia: valor("day"),
    hora: valor("hour"),
    minuto: valor("minute"),
  };
}

/** Instante UTC → "YYYY-MM-DD" no calendário de Brasília. */
export function dataIsoEmBrasilia(instante: Date): string {
  const { ano, mes, dia } = partesEmBrasilia(instante);
  return `${ano}-${mes}-${dia}`;
}

/** Instante UTC → "HH:MM" no relógio de Brasília. */
export function horaEmBrasilia(instante: Date): string {
  const { hora, minuto } = partesEmBrasilia(instante);
  return `${hora}:${minuto}`;
}

/**
 * "YYYY-MM-DD" → instante usado só para descobrir o dia da semana.
 *
 * MEIO-DIA em UTC, não meia-noite: `new Date("2026-10-20")` é meia-noite UTC, que em Brasília
 * é 21h do DIA ANTERIOR. Com meio-dia a data cai no meio do dia em qualquer fuso do Brasil.
 */
function instanteDoDia(dataIso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso);
  if (!m) return null;
  const [, ano, mes, dia] = m;
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia), 12));
}

/** "2026-10-20" → "terça-feira, 20 de outubro". Data inválida devolve "" (nunca quebra o envio). */
export function dataPorExtenso(dataIso: string): string {
  const instante = instanteDoDia(dataIso);
  if (!instante) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASILIA,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instante);
}

/** "2026-10-20" → "20/10/2026". Data inválida devolve "". */
export function dataCurta(dataIso: string): string {
  const instante = instanteDoDia(dataIso);
  if (!instante) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASILIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instante);
}

/** Hoje em Brasília, no formato "YYYY-MM-DD". Usado para descartar reunião que já passou. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return dataIsoEmBrasilia(agora);
}
