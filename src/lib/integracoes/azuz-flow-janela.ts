import { FUSO_BRASILIA } from "@/lib/agenda/fuso";

/**
 * QUANDO a confirmação pode sair.
 *
 * Três regras que se somam, e a ordem entre elas importa:
 *
 *   1. Dentro da janela de horário da empresa (padrão 08:00–21:00, Brasília). Mensagem automática
 *      às 3 da manhã é o que faz alguém denunciar o número — e denúncia é o que bloqueia a conta.
 *   2. Com um atraso aleatório. Intervalo exato e repetido é a assinatura de robô que os sistemas
 *      antifraude procuram. A variação vem de `ritmo.ts`, onde ela já estava escrita pro canal não
 *      oficial, com o porquê ao lado.
 *   3. NUNCA DEPOIS DO INÍCIO DA REUNIÃO. Confirmar uma reunião que já começou não ajuda ninguém, e
 *      é o limite que vence os outros dois: se a janela só abre depois que a reunião começa, não há
 *      envio — há uma recusa dita em voz alta.
 *
 * Puro: recebe o relógio, não o consulta. É o que torna a virada de dia e a madrugada prováveis sem
 * esperar meia-noite.
 */

export type JanelaDeEnvio = {
  /** "08:00" */
  inicio: string;
  /** "21:00" */
  fim: string;
};

export const JANELA_PADRAO: JanelaDeEnvio = { inicio: "08:00", fim: "21:00" };

export type QuandoEnviar =
  | { pode: true; enviarApos: Date }
  | { pode: false; motivo: string };

/** Minutos desde a meia-noite de Brasília, pro instante dado. */
function minutosEmBrasilia(instante: Date): number {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASILIA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? "0");
  return hora * 60 + minuto;
}

/** "08:00" → 480. Valor inválido devolve `null`, e quem chama cai no padrão. */
export function minutosDoRelogio(texto: string): number | null {
  const casou = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!casou) return null;
  const hora = Number(casou[1]);
  const minuto = Number(casou[2]);
  if (hora > 23 || minuto > 59) return null;
  return hora * 60 + minuto;
}

/**
 * O instante em que esta confirmação pode sair.
 *
 * `atrasoMs` entra por parâmetro, e não é sorteado aqui dentro, porque função que sorteia não se
 * testa: o mesmo motivo pelo qual o relógio também entra por parâmetro.
 */
export function quandoEnviar(params: {
  agora: Date;
  janela: JanelaDeEnvio;
  /** Início da reunião. O envio nunca passa daqui. */
  inicioDaReuniao: Date;
  /** O atraso aleatório já sorteado, em milissegundos. Ver `intervaloEntreEnvios` em `ritmo.ts`. */
  atrasoMs: number;
}): QuandoEnviar {
  const { agora, inicioDaReuniao, atrasoMs } = params;

  if (inicioDaReuniao.getTime() <= agora.getTime()) {
    return { pode: false, motivo: "Confirmação não enviada: a reunião já havia começado." };
  }

  const abre = minutosDoRelogio(params.janela.inicio) ?? minutosDoRelogio(JANELA_PADRAO.inicio)!;
  const fecha = minutosDoRelogio(params.janela.fim) ?? minutosDoRelogio(JANELA_PADRAO.fim)!;

  const candidato = new Date(agora.getTime() + atrasoMs);
  const minutos = minutosEmBrasilia(candidato);

  let enviarApos = candidato;

  /*
   * Fora da janela, espera ela abrir.
   *
   * Dois casos, e o segundo é o que erra quem escreve isto rápido: antes de abrir, espera HOJE;
   * depois de fechar, espera AMANHÃ. Somar um dia nos dois casos adiaria em 24h uma mensagem que
   * podia sair daqui a uma hora.
   */
  if (minutos < abre || minutos >= fecha) {
    const faltamParaAbrirHoje = abre - minutos;
    const esperaMinutos = faltamParaAbrirHoje > 0 ? faltamParaAbrirHoje : 24 * 60 - minutos + abre;
    enviarApos = new Date(candidato.getTime() + esperaMinutos * 60_000);
  }

  // O limite que vence os outros: a fila pode esperar a janela abrir, mas não pode ultrapassar a
  // reunião. Quando ultrapassa, não existe hora boa — e isso é uma recusa, não um adiamento.
  if (enviarApos.getTime() >= inicioDaReuniao.getTime()) {
    return {
      pode: false,
      motivo: "Confirmação não enviada: a janela de horário só abriria depois do início da reunião.",
    };
  }

  return { pode: true, enviarApos };
}
