import { diaDaSemanaEmBrasilia, hojeEmBrasilia, isoDeBrasilia, somarDias } from "@/lib/agenda/fuso";

/**
 * OS HORÁRIOS QUE O FORMULÁRIO OFERECE A QUEM RESPONDE.
 *
 * PRA QUE SERVE: a pessoa está preenchendo o formulário e, ali mesmo, marca a reunião. Hoje isso
 * é uma troca de mensagens que leva dois dias e esfria o interesse de quem acabou de pedir
 * contato.
 *
 * SÃO HORÁRIOS SOLTOS, ESCOLHIDOS A DEDO, e não uma faixa fatiada. "Das 9 às 18" abre dezoito
 * vagas num dia em que a empresa tinha duas; a agenda de quem atende não é um bloco vazio, são as
 * brechas entre os compromissos que já existem. A segunda tem 09:00 e 17:00 porque alguém digitou
 * 09:00 e 17:00.
 *
 * A CONTA É PURA, E TEM TESTE, porque o erro aqui é invisível e caro: um fuso trocado oferece 14h
 * e marca 11h, e quem descobre é o cliente sozinho na chamada. Um intervalo mal fechado oferece
 * duas pessoas no mesmo horário, e aí são dois clientes esperando.
 *
 * TUDO EM HORÁRIO DE BRASÍLIA. O formulário é aberto de qualquer lugar, e "14h" tem que ser as
 * 14h de quem vai atender. Guardar e comparar em UTC, mostrar em Brasília.
 */

export type ConfiguracaoDaAgenda = {
  /**
   * Os horários de cada dia da semana: a chave é o dia (0 = domingo … 6 = sábado) e o valor são
   * as horas que começam uma reunião naquele dia. Dia que não está aqui é dia fechado.
   */
  horarios: Record<string, string[]>;
  /** Minutos de cada reunião. */
  duracao: number;
  /** Até quantos dias à frente dá pra marcar. */
  janelaDias: number;
  /** Antecedência mínima, em horas: ninguém marca pra daqui a dez minutos. */
  antecedenciaHoras: number;
};

/** Um horário de manhã e um de tarde, em dia útil: o suficiente pro campo funcionar assim que é
 *  arrastado pro formulário, e óbvio o bastante pra empresa trocar pelos horários dela. */
const PADRAO_DO_DIA = ["09:00", "14:00"];

export const AGENDA_PADRAO: ConfiguracaoDaAgenda = {
  // Segunda a sexta: oferecer sábado por engano é pior que não oferecer nada — alguém marca e
  // ninguém aparece.
  horarios: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [String(d), [...PADRAO_DO_DIA]])),
  duracao: 30,
  janelaDias: 30,
  antecedenciaHoras: 4,
};

export type Intervalo = { inicio: string; fim: string };

/** Lê a configuração que veio do formulário, caindo no padrão em cada pedaço que não vier. */
export function lerConfiguracao(valor: unknown): ConfiguracaoDaAgenda {
  const bruto = (valor ?? {}) as Record<string, unknown>;
  const duracao = inteiro(bruto.duracao, 10, 240) ?? AGENDA_PADRAO.duracao;

  return {
    horarios: lerHorarios(bruto.horarios) ?? copiar(AGENDA_PADRAO.horarios),
    duracao,
    janelaDias: inteiro(bruto.janelaDias, 1, 180) ?? AGENDA_PADRAO.janelaDias,
    // Zero é uma escolha válida ("pode marcar pra já"), então o piso é 0 e não 1.
    antecedenciaHoras: inteiro(bruto.antecedenciaHoras, 0, 720) ?? AGENDA_PADRAO.antecedenciaHoras,
  };
}

/**
 * Os horários por dia, como vieram do Json do banco.
 *
 * DEVOLVE VAZIO EM VEZ DO PADRÃO quando a empresa apagou tudo: "nenhum horário" é uma escolha, e
 * cair no padrão aqui ofereceria justamente os horários que ela acabou de tirar.
 */
function lerHorarios(valor: unknown): Record<string, string[]> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;

  const saida: Record<string, string[]> = {};
  for (const [chave, lista] of Object.entries(valor as Record<string, unknown>)) {
    const dia = Number(chave);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) continue;
    if (!Array.isArray(lista)) continue;
    const horas = [...new Set(lista.map(hora).filter((h): h is string => h !== null))].sort();
    if (horas.length > 0) saida[String(dia)] = horas;
  }
  return saida;
}

function copiar(horarios: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(horarios).map(([d, h]) => [d, [...h]]));
}

function hora(valor: unknown): string | null {
  return typeof valor === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor) ? valor : null;
}

function inteiro(valor: unknown, minimo: number, maximo: number): number | null {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return null;
  const arredondado = Math.round(n);
  return arredondado >= minimo && arredondado <= maximo ? arredondado : null;
}

/** Dois intervalos se encostam? Fim igual a início NÃO é conflito: uma reunião começa quando a
 *  outra acaba, e tratar isso como ocupado comeria metade dos horários do dia. */
export function conflita(a: Intervalo, b: Intervalo): boolean {
  return new Date(a.inicio) < new Date(b.fim) && new Date(b.inicio) < new Date(a.fim);
}

export type HorarioLivre = { inicio: string; fim: string; hora: string };
export type DiaComHorarios = { dia: string; horarios: HorarioLivre[] };

/**
 * Os dias e horários que podem ser escolhidos.
 *
 * `ocupados` são os compromissos que já existem na Agenda do workspace. Sem isso o formulário
 * marcaria por cima do que a empresa já tinha, e ela só descobriria na hora.
 *
 * É ISSO QUE FAZ O HORÁRIO SUMIR depois que alguém marca: a vaga das 9h de segunda vira um
 * compromisso ocupado, e a próxima pessoa que abrir o formulário vê a segunda só com as 17h.
 */
export function horariosLivres(params: {
  config: ConfiguracaoDaAgenda;
  ocupados: Intervalo[];
  agora?: Date;
}): DiaComHorarios[] {
  const { config, ocupados } = params;
  const agora = params.agora ?? new Date();

  // A antecedência mínima vira um instante: antes dele, nada é oferecido.
  const maisCedo = new Date(agora.getTime() + config.antecedenciaHoras * 60 * 60 * 1000);

  const hoje = hojeEmBrasilia(agora);
  const saida: DiaComHorarios[] = [];

  for (let i = 0; i < config.janelaDias; i += 1) {
    const dia = somarDias(hoje, i);
    const diaDaSemana = diaDaSemanaEmBrasilia(dia);
    if (diaDaSemana === null) continue;
    const doDia = config.horarios[String(diaDaSemana)];
    if (!doDia || doDia.length === 0) continue;

    const horarios: HorarioLivre[] = [];
    // Ordenado na hora de mostrar: a empresa digita na ordem que lembrar, e uma lista fora de
    // ordem faz a pessoa achar que a tarde acabou antes da manhã.
    for (const horaDoDia of [...doDia].sort()) {
      const inicio = isoDeBrasilia(dia, horaDoDia);
      const comeco = new Date(inicio);
      if (Number.isNaN(comeco.getTime())) continue;
      if (comeco < maisCedo) continue;
      // O fim sai do instante + duração, e não de "hora + minutos": somar no relógio estoura a
      // meia-noite (23:40 + 30min viraria "24:10", que não é hora nenhuma).
      const fim = new Date(comeco.getTime() + config.duracao * 60 * 1000).toISOString();
      if (ocupados.some((o) => conflita({ inicio, fim }, o))) continue;
      horarios.push({ inicio, fim, hora: horaDoDia });
    }

    if (horarios.length > 0) saida.push({ dia, horarios });
  }

  return saida;
}

/**
 * O horário escolhido ainda vale?
 *
 * CONFERIDO DE NOVO NO ENVIO, e não só quando a lista foi montada: entre abrir o formulário e
 * mandar pode passar meia hora, e nesse tempo outra pessoa marca o mesmo horário. Sem esta
 * segunda conferência, duas pessoas recebem confirmação pro mesmo momento.
 */
export function horarioValido(params: {
  config: ConfiguracaoDaAgenda;
  ocupados: Intervalo[];
  inicio: string;
  agora?: Date;
}): { ok: true; inicio: string; fim: string } | { ok: false; motivo: string } {
  const quando = new Date(params.inicio);
  if (Number.isNaN(quando.getTime())) return { ok: false, motivo: "Horário inválido." };

  const livres = horariosLivres({ config: params.config, ocupados: params.ocupados, agora: params.agora });
  const escolhido = livres
    .flatMap((d) => d.horarios)
    .find((h) => new Date(h.inicio).getTime() === quando.getTime());

  if (!escolhido) return { ok: false, motivo: "Esse horário não está mais livre. Escolha outro." };
  return { ok: true, inicio: escolhido.inicio, fim: escolhido.fim };
}
