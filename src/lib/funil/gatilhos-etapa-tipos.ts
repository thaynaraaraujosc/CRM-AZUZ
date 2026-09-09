import type { GrupoCondicoes } from "@/lib/automation-flow/types";

/**
 * Os tipos e rótulos dos gatilhos de etapa, sem nada que toque o banco.
 *
 * Separado de `gatilhos-etapa.ts` de propósito: aquele importa o Prisma, e a tela do funil é um
 * componente de cliente. Importar os dois juntos arrastava o driver do MySQL pro pacote do
 * navegador, e a compilação quebrava procurando o módulo `fs`.
 */

/** Quando a etapa executa o robô. */
export type QuandoGatilho = "movido" | "criado" | "movido_ou_criado" | "responsavel_alterado" | "diariamente";

/**
 * O que a etapa faz quando o gatilho bate.
 *
 * "robo" executa um fluxo inteiro. Os outros são ações diretas, sem robô no meio: é assim que uma
 * etapa troca o responsável ou marca uma tarefa sozinha, sem obrigar a criar um fluxo de um passo
 * só pra isso.
 */
export type TipoAcaoGatilho =
  | "robo"
  | "responsavel"
  | "etapa"
  | "etiquetas"
  | "tarefa"
  | "webhook"
  | "mensagem";

export const ACAO_ROTULO: Record<TipoAcaoGatilho, string> = {
  robo: "Executar robô",
  responsavel: "Alterar responsável do lead",
  etapa: "Mudar a etapa do lead",
  etiquetas: "Editar etiquetas",
  tarefa: "Adicionar uma tarefa",
  webhook: "Enviar um webhook",
  mensagem: "Enviar mensagem",
};

/** Os parâmetros de cada ação direta. Só o campo da ação escolhida é lido. */
export type AcaoDados = {
  /** responsavel */
  responsavel?: string;
  /** etapa: pra onde mover (o funil é o mesmo do gatilho, salvo se outro for escolhido) */
  etapaDestinoId?: string;
  /** etiquetas */
  etiquetasAdicionar?: string[];
  etiquetasRemover?: string[];
  /** tarefa */
  tarefaTitulo?: string;
  tarefaResponsavel?: string;
  tarefaPrazoDias?: number;
  /** webhook */
  webhookUrl?: string;
  /** mensagem */
  mensagemTexto?: string;
};

export type GatilhoEtapaVisao = {
  id: string;
  funilId: string;
  etapaId: string;
  quando: QuandoGatilho;
  tipoAcao: TipoAcaoGatilho;
  /** Só quando tipoAcao = "robo". */
  fluxoId: string | null;
  acaoDados?: AcaoDados | null;
  /** Só pra tela: o nome do robô, pra faixa do funil não mostrar um id. */
  fluxoNome?: string;
  condicao?: GrupoCondicoes | null;
  diasAtivos?: number[] | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  horarioDiario?: string | null;
  ativo: boolean;
  ordem: number;
};

export const QUANDO_ROTULO: Record<QuandoGatilho, string> = {
  criado: "Quando criado nesta etapa",
  movido: "Quando movido para esta etapa",
  movido_ou_criado: "Quando movido para ou criado nesta etapa",
  responsavel_alterado: "Quando o responsável do lead é alterado",
  diariamente: "Diariamente",
};

/** Os `quando` que um evento de entrada na etapa satisfaz. */
export function quandoAceitos(evento: "movido" | "criado" | "responsavel_alterado"): QuandoGatilho[] {
  if (evento === "responsavel_alterado") return ["responsavel_alterado"];
  return [evento, "movido_ou_criado"];
}

/**
 * A janela do gatilho ("Ativo: sempre", ou dias da semana das 10:00 às 19:00).
 *
 * Fora da janela o gatilho simplesmente não dispara. É diferente do "fora do horário" das
 * Configurações do fluxo, que pode estacionar a execução até a janela abrir: aqui a etapa decidiu
 * que aquele lead não deveria ter entrado em automação nenhuma naquele momento.
 */
export function dentroDaJanelaDoGatilho(
  gatilho: Pick<GatilhoEtapaVisao, "diasAtivos" | "horaInicio" | "horaFim">,
  agora: Date,
): boolean {
  const dias = gatilho.diasAtivos;
  // Domingo é 0 no JavaScript e 7 na tela (Seg…Dom). Sem esta conversão, marcar "Dom" na tela
  // ligaria a segunda-feira.
  if (dias?.length) {
    const diaDaTela = agora.getDay() === 0 ? 7 : agora.getDay();
    if (!dias.includes(diaDaTela)) return false;
  }

  const inicio = gatilho.horaInicio?.trim();
  const fim = gatilho.horaFim?.trim();
  if (!inicio || !fim) return true;

  const minutos = agora.getHours() * 60 + agora.getMinutes();
  const emMinutos = (hora: string) => {
    const [h, m] = hora.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const de = emMinutos(inicio);
  const ate = emMinutos(fim);
  // Janela que atravessa a meia-noite (22:00 às 06:00): vale dos dois lados do corte.
  return de <= ate ? minutos >= de && minutos <= ate : minutos >= de || minutos <= ate;
}

