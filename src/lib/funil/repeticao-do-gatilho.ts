/**
 * DE QUANTO EM QUANTO TEMPO O GATILHO PROGRAMADO VOLTA.
 *
 * "Diariamente, uma vez por semana, uma vez por mês, uma vez por ano."
 *
 * O gatilho programado só sabia repetir TODO DIA. Isso cobre a varredura de follow-up e não cobre
 * o resto: a cobrança de segunda-feira, o fechamento do dia 1º, o aniversário da clínica. Sem
 * isso, a saída era criar um gatilho diário e pôr uma condição de data dentro do robô — o que
 * manda rodar 365 vezes pra agir 1, e esconde a regra num fluxograma.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * CADA REPETIÇÃO LÊ UM CAMPO QUE JÁ EXISTE, em vez de inventar um por período:
 *
 *  - diaria: só a hora (`horarioDiario`).
 *  - semanal: os dias marcados (`diasAtivos`, a mesma lista da janela "Ativo"), mais a hora.
 *  - mensal: `diaDoMes`, mais a hora.
 *  - anual: `dataAnual` em "MM-DD", mais a hora.
 *
 * Nulo quer dizer "diaria": é o que todo gatilho já gravado significa, e a coluna nova não pode
 * mudar o comportamento de automação que ninguém tocou.
 */

export type Repeticao = "diaria" | "semanal" | "mensal" | "anual";

export const REPETICOES: { valor: Repeticao; label: string }[] = [
  { valor: "diaria", label: "Diariamente" },
  { valor: "semanal", label: "Uma vez por semana" },
  { valor: "mensal", label: "Uma vez por mês" },
  { valor: "anual", label: "Uma vez por ano" },
];

export function repeticaoGravada(cru: string | null | undefined): Repeticao {
  const limpa = (cru ?? "").trim() as Repeticao;
  return REPETICOES.some((r) => r.valor === limpa) ? limpa : "diaria";
}

export type ConfiguracaoDaRepeticao = {
  repeticao?: string | null;
  /** "HH:MM". Sem hora, o gatilho não tem quando — e aí não roda. */
  horarioDiario?: string | null;
  /** Domingo = 0. Usado só na semanal. */
  diasAtivos?: number[] | null;
  /** 1 a 31. Usado só na mensal. */
  diaDoMes?: number | null;
  /** "MM-DD". Usado só na anual. */
  dataAnual?: string | null;
};

/** O último dia daquele mês: 28, 29, 30 ou 31. */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

/**
 * Este minuto é o minuto deste gatilho?
 *
 * Trabalha em HORA LOCAL do servidor, igual à varredura que já existe: o horário é o que a pessoa
 * escreveu no relógio dela, não um instante absoluto.
 */
export function deveRodarAgora(cfg: ConfiguracaoDaRepeticao, agora: Date): boolean {
  const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  if (!cfg.horarioDiario || cfg.horarioDiario !== hora) return false;

  switch (repeticaoGravada(cfg.repeticao)) {
    case "diaria":
      return true;

    case "semanal": {
      const dias = Array.isArray(cfg.diasAtivos) ? cfg.diasAtivos : [];
      /*
       * Semanal SEM dia escolhido não roda todo dia.
       *
       * `diasAtivos` vazio quer dizer "todos os dias" na janela de funcionamento — é o que o campo
       * sempre significou ali. Herdar esse sentido aqui transformaria "uma vez por semana" em
       * "todo dia", que é o oposto do que foi pedido. Sem dia marcado, a configuração está pela
       * metade, e metade de uma regra não dispara nada.
       */
      return dias.includes(agora.getDay());
    }

    case "mensal": {
      const escolhido = Number(cfg.diaDoMes);
      if (!Number.isInteger(escolhido) || escolhido < 1 || escolhido > 31) return false;
      const hoje = agora.getDate();
      const ultimo = ultimoDiaDoMes(agora.getFullYear(), agora.getMonth());
      /*
       * DIA 31 EM FEVEREIRO RODA NO DIA 28.
       *
       * O contrário seria "uma vez por mês" pulando quatro meses do ano sem avisar — e quem
       * escolheu 31 quis dizer "no fim do mês", não "só nos meses de 31 dias".
       */
      const alvo = Math.min(escolhido, ultimo);
      return hoje === alvo;
    }

    case "anual": {
      const md = (cfg.dataAnual ?? "").trim();
      if (!/^\d{2}-\d{2}$/.test(md)) return false;
      const [mes, dia] = md.split("-").map(Number);
      if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
      const mesAgora = agora.getMonth() + 1;
      if (mes !== mesAgora) return false;
      const ultimo = ultimoDiaDoMes(agora.getFullYear(), agora.getMonth());
      // 29 de fevereiro em ano comum roda no dia 28, pelo mesmo motivo do dia 31 acima.
      return agora.getDate() === Math.min(dia, ultimo);
    }
  }
}

/** A frase da repetição, pra linha cinza do cartão no funil. */
export function rotuloDaRepeticao(cfg: ConfiguracaoDaRepeticao): string {
  const hora = cfg.horarioDiario ? ` às ${cfg.horarioDiario}` : "";
  switch (repeticaoGravada(cfg.repeticao)) {
    case "diaria":
      return `Diariamente${hora}`;
    case "semanal": {
      const nomes = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
      const dias = (Array.isArray(cfg.diasAtivos) ? cfg.diasAtivos : [])
        .filter((d) => d >= 0 && d <= 6)
        .sort((a, b) => a - b)
        .map((d) => nomes[d]);
      if (!dias.length) return `Semanalmente${hora} (falta escolher o dia)`;
      return `Toda ${dias.join(", ")}${hora}`;
    }
    case "mensal": {
      const dia = Number(cfg.diaDoMes);
      if (!Number.isInteger(dia)) return `Mensalmente${hora} (falta escolher o dia)`;
      return `Todo dia ${dia}${hora}`;
    }
    case "anual": {
      const md = (cfg.dataAnual ?? "").trim();
      if (!/^\d{2}-\d{2}$/.test(md)) return `Anualmente${hora} (falta escolher a data)`;
      const [mes, dia] = md.split("-");
      return `Todo ${dia}/${mes}${hora}`;
    }
  }
}
