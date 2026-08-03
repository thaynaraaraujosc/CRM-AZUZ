/**
 * Parser e formatador único de data — o CRM registra "quando" um evento
 * aconteceu em formatos bem diferentes dependendo do módulo de origem
 * ("Há 6 min", "28 jul", "22/07/2026", "09:16 · automática"...). Antes,
 * cada tela decidia sozinha como mostrar isso; documentos como o PDF do
 * relatório ficavam com datas misturadas e sem sentido depois de
 * arquivados. Esta é a fonte única: um parser (`parseDataTexto`) e dois
 * formatadores (`formatarDataCompleta`, `formatarDataComRelativo`).
 *
 * LIMITAÇÃO CONHECIDA: como o CRM ainda não tem timestamp real por evento,
 * o parser é uma heurística sobre texto de exibição — ver mesma nota em
 * `src/lib/timeline.ts`. Quando existir timestamp real, troque o parser por
 * leitura direta do campo de data e os formatadores continuam os mesmos.
 */

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Dia de referência de todo o CRM — mesmo "hoje" usado em `data.ts`/`timeline.ts`. */
export const HOJE = new Date(2026, 6, 30);

/**
 * Tenta transformar o texto de exibição num `Date` real. Retorna `null`
 * quando não reconhece o formato — nesse caso, quem chama deve mostrar o
 * texto original em vez de inventar uma data.
 */
export function parseDataTexto(raw: string): Date | null {
  const texto = raw.trim();
  if (!texto) return null;
  const low = texto.toLowerCase();
  let m: RegExpMatchArray | null;

  if (low === "hoje" || low === "agora") return new Date(HOJE);
  if (low === "ontem") return new Date(HOJE.getTime() - 24 * 60 * 60000);
  if ((m = low.match(/^há (\d+)\s*min/))) return new Date(HOJE.getTime() - Number(m[1]) * 60000);
  if ((m = low.match(/^há (\d+)\s*h(?:oras?)?\s*(\d+)?/))) {
    const minutos = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
    return new Date(HOJE.getTime() - minutos * 60000);
  }
  if ((m = low.match(/^(\d+)h(\d+)?$/))) {
    const minutos = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
    return new Date(HOJE.getTime() - minutos * 60000);
  }
  if ((m = low.match(/^há (\d+)\s*dias?/))) {
    return new Date(HOJE.getTime() - Number(m[1]) * 24 * 60 * 60000);
  }
  // ISO aaaa-mm-dd
  if ((m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  // dd/mm/aaaa
  if ((m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  // "28 jul" / "01 ago"
  if ((m = low.match(/^(\d{1,2})\s+([a-zç]{3})\.?$/))) {
    const mes = MESES[m[2]];
    if (mes) return new Date(2026, mes - 1, Number(m[1]));
  }
  // "HH:MM" (assume dia de hoje — é o formato usado dentro de uma conversa do dia)
  if ((m = low.match(/^(\d{1,2}):(\d{2})/))) {
    return new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate(), Number(m[1]), Number(m[2]));
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "02/08/2026 às 09:16" — formato único usado em documentos gerados (PDF/CSV). */
export function formatarDataCompleta(data: Date): string {
  return `${pad2(data.getDate())}/${pad2(data.getMonth() + 1)}/${data.getFullYear()} às ${pad2(data.getHours())}:${pad2(data.getMinutes())}`;
}

/** "02/08/2026" sem horário — usado quando só a data importa. */
export function formatarDataCurta(data: Date): string {
  return `${pad2(data.getDate())}/${pad2(data.getMonth() + 1)}/${data.getFullYear()}`;
}

/** "1 de agosto de 2026" — usado em capas e cabeçalhos de relatório. */
export function formatarDataPorExtenso(data: Date): string {
  return `${data.getDate()} de ${NOMES_MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

function relativo(data: Date): string {
  const diffMin = Math.round((HOJE.getTime() - data.getTime()) / 60000);
  if (diffMin <= 0) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffMin < 24 * 60) return `há ${Math.round(diffMin / 60)}h`;
  return `há ${Math.round(diffMin / 1440)} dias`;
}

/**
 * Formato usado em documentos arquivados: data absoluta primeiro, tempo
 * relativo como informação secundária — nunca só o relativo, porque ele
 * perde o sentido depois que o documento é salvo.
 *   "02/08/2026 às 09:16 · há 2 dias"
 * Quando o texto original não é reconhecido, devolve ele mesmo (nunca
 * inventa uma data).
 */
export function formatarDataComRelativo(raw: string): string {
  const data = parseDataTexto(raw);
  if (!data) return raw || "—";
  return `${formatarDataCompleta(data)} · ${relativo(data)}`;
}

export function estimarMinutosAtras(raw: string): number {
  const data = parseDataTexto(raw);
  if (!data) return 10 ** 8;
  return Math.round((HOJE.getTime() - data.getTime()) / 60000);
}
