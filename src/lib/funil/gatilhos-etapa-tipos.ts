import type { GrupoCondicoes } from "@/lib/automation-flow/types";

/**
 * Os tipos e rótulos dos gatilhos de etapa, sem nada que toque o banco.
 *
 * Separado de `gatilhos-etapa.ts` de propósito: aquele importa o Prisma, e a tela do funil é um
 * componente de cliente. Importar os dois juntos arrastava o driver do MySQL pro pacote do
 * navegador, e a compilação quebrava procurando o módulo `fs`.
 */

/**
 * Quando a etapa dispara.
 *
 * Todos são eventos que o CRM já emite hoje: nenhum está aqui "pra parecer completo". Um gatilho
 * que a etapa oferece e o servidor nunca aciona é pior do que não ter o gatilho, porque a pessoa
 * monta a automação e fica esperando.
 *
 * Os que NÃO são de entrada na etapa (etiqueta, campo, tarefa, mensagem) valem pro lead que
 * estiver NAQUELA etapa no momento do evento. É assim que a etapa continua sendo a dona: "quando
 * mudarem a etiqueta de alguém que está em Follow-up, faça X".
 */
export type QuandoGatilho =
  // Pipeline
  | "movido"
  | "criado"
  | "movido_ou_criado"
  | "saiu"
  | "responsavel_alterado"
  | "etiqueta_adicionada"
  | "etiqueta_removida"
  | "campo_alterado"
  // Programados
  | "diariamente"
  // Ações
  | "formulario_enviado"
  | "tarefa_criada"
  | "tarefa_concluida";

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
  criado: "Imediatamente quando criado nesta etapa",
  movido: "Imediatamente quando movido para esta etapa",
  movido_ou_criado: "Imediatamente quando movido para ou criado nesta etapa",
  saiu: "Quando sair desta etapa",
  responsavel_alterado: "Quando o responsável for alterado",
  etiqueta_adicionada: "Quando uma etiqueta for adicionada",
  etiqueta_removida: "Quando uma etiqueta for removida",
  campo_alterado: "Quando um campo for alterado",
  diariamente: "Diariamente",
  formulario_enviado: "Quando um formulário for enviado",
  tarefa_criada: "Quando uma tarefa for criada",
  tarefa_concluida: "Quando uma tarefa for concluída",
};

/** As categorias do menu, na ordem em que aparecem. É a organização do Kommo. */
export const CATEGORIAS_GATILHO: { titulo: string; quandos: QuandoGatilho[] }[] = [
  {
    titulo: "Gatilhos do pipeline",
    quandos: [
      "movido",
      "criado",
      "movido_ou_criado",
      "saiu",
      "responsavel_alterado",
      "etiqueta_adicionada",
      "etiqueta_removida",
      "campo_alterado",
    ],
  },
  { titulo: "Gatilhos programados", quandos: ["diariamente"] },
  { titulo: "Gatilhos baseados em ações", quandos: ["formulario_enviado", "tarefa_criada", "tarefa_concluida"] },
];

/**
 * O evento do CRM que aciona cada `quando`, pros gatilhos que NÃO são de entrada na etapa.
 *
 * O que está aqui é o que o servidor emite de verdade. A tabela existe pra o disparador não
 * precisar de um `switch` paralelo que alguém esqueceria de atualizar ao acrescentar um gatilho.
 */
export const EVENTO_DO_QUANDO: Partial<Record<QuandoGatilho, string>> = {
  saiu: "lead_saiu_etapa",
  responsavel_alterado: "responsavel_alterado",
  etiqueta_adicionada: "etiqueta_adicionada",
  etiqueta_removida: "etiqueta_removida",
  campo_alterado: "campo_alterado",
  formulario_enviado: "formulario_preenchido",
  tarefa_criada: "tarefa_criada",
  tarefa_concluida: "tarefa_concluida",
};

/**
 * Os `quando` que um evento satisfaz.
 *
 * Entrar na etapa satisfaz o gatilho específico E o combinado ("movido ou criado"), porque são
 * duas formas de dizer a mesma coisa e quem monta escolhe a que faz sentido. Todo o resto
 * satisfaz só a si mesmo.
 */
export function quandoAceitos(evento: QuandoGatilho): QuandoGatilho[] {
  if (evento === "movido" || evento === "criado") return [evento, "movido_ou_criado"];
  return [evento];
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

