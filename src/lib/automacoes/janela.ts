import type { DiaSemana } from "@/lib/data";
import type { ConfiguracoesFluxo } from "@/lib/automation-flow/types";

/**
 * A janela de funcionamento da automação — dias ativos e faixa de horário.
 *
 * Isto existia na tela e quase funcionava: "Aguardar próxima janela" tinha o mesmo efeito de
 * "continuar mesmo assim", porque o único caminho possível era deixar passar ou barrar. Com o motor
 * com estado existe uma terceira coisa a fazer — começar a execução e ESTACIONAR até a janela
 * abrir — e é isso que a opção sempre prometeu.
 *
 * Fuso: a conta é feita na hora do servidor. Quando `fusoHorario` estiver configurado, ele é usado
 * pra descobrir que horas são no fuso da empresa — senão uma automação "das 8 às 18" de um cliente
 * em Manaus dispararia pelo relógio de São Paulo.
 */
const DIAS: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export type ForaDaJanela = "aguardar" | "continuar" | "encerrar";

/** O que fazer quando o gatilho acontece fora da janela. "ignorar" é o nome antigo de "encerrar". */
export function comportamentoForaDaJanela(cfg: ConfiguracoesFluxo | null | undefined): ForaDaJanela {
  const valor = cfg?.foraDaJanela;
  if (valor === "continuar") return "continuar";
  if (valor === "encerrar" || valor === "ignorar") return "encerrar";
  return "aguardar";
}

/** Hora e dia da semana no fuso do fluxo. */
function momento(cfg: ConfiguracoesFluxo, agora: Date): { dia: DiaSemana; minutos: number } {
  const fuso = cfg.fusoHorario?.trim();
  const partes = new Intl.DateTimeFormat("pt-BR", {
    ...(fuso ? { timeZone: fuso } : {}),
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);

  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? "0");
  // `formatToParts` devolve o dia como "seg.", "ter."… — o ponto sai fora.
  const rotulo = (partes.find((p) => p.type === "weekday")?.value ?? "").replace(".", "").toLowerCase();
  const dia = (DIAS.find((d) => rotulo.startsWith(d)) ?? DIAS[agora.getDay()]) as DiaSemana;

  return { dia, minutos: hora * 60 + minuto };
}

function paraMinutos(hhmm: string | undefined): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function dentroDaJanela(cfg: ConfiguracoesFluxo | null | undefined, agora: Date): boolean {
  if (!cfg) return true;
  const { dia, minutos } = momento(cfg, agora);

  if (cfg.diasAtivos?.length && !cfg.diasAtivos.includes(dia)) return false;

  if (cfg.usarHorario) {
    const inicio = paraMinutos(cfg.horarioInicio);
    const fim = paraMinutos(cfg.horarioFim);
    if (inicio !== null && fim !== null && (minutos < inicio || minutos > fim)) return false;
  }
  return true;
}

/**
 * Quando a janela abre de novo. Procura minuto a minuto em passos de 15 pelos próximos 8 dias —
 * simples de ler e mais que suficiente pra qualquer configuração de dias/horário.
 *
 * Devolve `null` quando nenhuma abertura existe nos próximos 8 dias: é o caso de uma configuração
 * impossível (nenhum dia ativo), e quem chama trata como "não dá pra esperar".
 */
export function proximaAbertura(cfg: ConfiguracoesFluxo | null | undefined, agora: Date): Date | null {
  if (dentroDaJanela(cfg, agora)) return agora;
  const passo = 15 * 60_000;
  const limite = agora.getTime() + 8 * 24 * 60 * 60_000;
  for (let t = agora.getTime() + passo; t <= limite; t += passo) {
    const candidato = new Date(t);
    if (dentroDaJanela(cfg, candidato)) return candidato;
  }
  return null;
}
