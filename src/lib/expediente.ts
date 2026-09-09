/**
 * O horário de funcionamento do workspace, e as contas que dependem dele.
 *
 * Existe pra ser reutilizado: pausa de automação, follow-up e gatilho de etapa precisam da mesma
 * resposta pra "estamos abertos agora?". Sem um lugar só, cada um teria a própria configuração e
 * elas divergiriam: o follow-up de duas horas dispararia às três da manhã enquanto o gatilho
 * respeitava o comercial.
 *
 * As funções daqui são PURAS: recebem o expediente e a data, devolvem a conta. Quem lê do banco é
 * `carregarExpediente`, e ele é o único que toca o Prisma. É o que deixa isto testável sem banco.
 */

/** 1 = segunda … 7 = domingo. Dia ausente = fechado. */
export type FaixaDoDia = { de: string; ate: string };
export type DiasDoExpediente = Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", FaixaDoDia>>;

export type Expediente = {
  dias: DiasDoExpediente;
  fuso: string;
};

/** Comercial de segunda a sexta. O que a maioria usaria, e o que evita a tela nascer vazia. */
export const EXPEDIENTE_PADRAO: Expediente = {
  dias: {
    "1": { de: "08:00", ate: "18:00" },
    "2": { de: "08:00", ate: "18:00" },
    "3": { de: "08:00", ate: "18:00" },
    "4": { de: "08:00", ate: "18:00" },
    "5": { de: "08:00", ate: "18:00" },
  },
  fuso: "America/Sao_Paulo",
};

/** Domingo é 0 no JavaScript e 7 aqui. Sem esta conversão, "Dom" na tela ligaria a segunda. */
function diaDaSemana(data: Date): "1" | "2" | "3" | "4" | "5" | "6" | "7" {
  const d = data.getDay();
  return String(d === 0 ? 7 : d) as "1";
}

function emMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutosDoDia(data: Date): number {
  return data.getHours() * 60 + data.getMinutes();
}

/** Estamos abertos neste instante? */
export function dentroDoExpediente(expediente: Expediente, quando: Date): boolean {
  const faixa = expediente.dias[diaDaSemana(quando)];
  if (!faixa) return false;
  const agora = minutosDoDia(quando);
  return agora >= emMinutos(faixa.de) && agora < emMinutos(faixa.ate);
}

/**
 * O próximo instante em que o expediente abre, a partir de `quando`.
 *
 * Devolve `null` quando o expediente não tem nenhum dia aberto: não existe "próxima abertura", e
 * inventar uma faria a automação parada acordar num momento arbitrário.
 */
export function proximaAbertura(expediente: Expediente, quando: Date): Date | null {
  if (!Object.keys(expediente.dias).length) return null;

  // Uma semana à frente basta: se em sete dias não abre, é porque não abre nunca.
  for (let salto = 0; salto <= 7; salto++) {
    const dia = new Date(quando);
    dia.setDate(dia.getDate() + salto);
    const faixa = expediente.dias[diaDaSemana(dia)];
    if (!faixa) continue;

    const abertura = new Date(dia);
    const [h, m] = faixa.de.split(":").map(Number);
    abertura.setHours(h || 0, m || 0, 0, 0);
    if (abertura > quando) return abertura;

    // Hoje já abriu: se ainda estamos dentro, a "próxima abertura" é agora mesmo.
    if (salto === 0 && dentroDoExpediente(expediente, quando)) return new Date(quando);
  }
  return null;
}

/**
 * Soma minutos CONTANDO SÓ O EXPEDIENTE.
 *
 * "Pausar 2 horas úteis" às 17h20 de sexta não termina às 19h20 de sexta: termina às 9h20 de
 * segunda. É a diferença entre um follow-up que chega no meio do atendimento e um que chega de
 * madrugada, e é a razão de esta função existir em vez de um `+ 2h` direto.
 */
export function somarMinutosUteis(expediente: Expediente, inicio: Date, minutos: number): Date | null {
  if (minutos <= 0) return new Date(inicio);
  if (!Object.keys(expediente.dias).length) return null;

  let restam = minutos;
  let cursor = new Date(inicio);

  // Teto de 60 dias: um expediente de duas horas por semana com uma pausa de 100 horas úteis
  // levaria um ano, e um laço sem teto aqui prenderia o processo.
  for (let volta = 0; volta < 60 * 24 && restam > 0; volta++) {
    if (!dentroDoExpediente(expediente, cursor)) {
      const abre = proximaAbertura(expediente, cursor);
      if (!abre) return null;
      cursor = abre;
      continue;
    }

    const faixa = expediente.dias[diaDaSemana(cursor)]!;
    const ateFechar = emMinutos(faixa.ate) - minutosDoDia(cursor);
    if (restam <= ateFechar) {
      return new Date(cursor.getTime() + restam * 60_000);
    }

    // Consome o que resta do dia e continua na próxima abertura.
    restam -= ateFechar;
    cursor = new Date(cursor.getTime() + (ateFechar + 1) * 60_000);
  }

  return restam > 0 ? null : cursor;
}
