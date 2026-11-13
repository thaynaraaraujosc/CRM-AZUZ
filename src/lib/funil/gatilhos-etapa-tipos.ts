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
 * Os que NÃO são de entrada na etapa (etiqueta, campo, mensagem) valem pro lead que
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
  | "data_hora"
  | "sem_resposta"
  | "campo_de_data"
  // Conversa
  | "mensagem_recebida"
  // Ações
  | "formulario_enviado";

/**
 * O que a etapa faz quando o gatilho bate.
 *
 * "robo" executa um fluxo inteiro. Os outros são ações diretas, sem robô no meio: é assim que uma
 * etapa troca o responsável sozinha, sem obrigar a criar um fluxo de um passo só pra isso.
 */
export type TipoAcaoGatilho =
  | "robo"
  | "responsavel"
  | "etapa"
  | "etiquetas"
  | "webhook"
  | "mensagem"
  /**
   * Devolver pra plataforma de anúncio que este lead chegou aqui.
   *
   * A etapa do funil é o lugar natural disto: "venda ganha" e "reunião agendada" são mudanças de
   * etapa, e era pra elas que faltava um caminho. A ação não MANDA nada na hora — ela põe na
   * fila, e quem conversa com o Google e com a Meta é a rodada (ver `fila-de-conversoes.ts`).
   */
  | "conversao";

export const ACAO_ROTULO: Record<TipoAcaoGatilho, string> = {
  robo: "Executar robô",
  responsavel: "Alterar responsável do lead",
  etapa: "Mudar a etapa do lead",
  etiquetas: "Editar etiquetas",
  webhook: "Enviar um webhook",
  mensagem: "Enviar mensagem",
  conversao: "Enviar conversão",
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
  /** webhook */
  webhookUrl?: string;
  /** mensagem */
  mensagemTexto?: string;
  /** conversao: pra qual plataforma e qual evento genérico. */
  conversaoPlataforma?: string;
  conversaoEvento?: string;
  /**
   * De onde sai o valor. Vazio = o valor do negócio do lead, que é o que quase toda venda usa.
   * O evento de compra é bloqueado sem valor: ver `motivoParaPular`.
   */
  conversaoMoeda?: string;
};

export type GatilhoEtapaVisao = {
  /**
   * O mesmo gatilho valendo para várias etapas: todas as linhas irmãs têm este id.
   *
   * Nulo = gatilho de uma etapa só. Quem agrupa é a TELA, que desenha as irmãs como uma faixa só;
   * o motor continua achando os gatilhos de uma etapa por `etapaId`, sem saber que existem grupos.
   */
  grupoId?: string | null;
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
  /** Só pro quando = "data_hora": o instante marcado, em hora local ("2026-11-04T22:33"). */
  dataHora?: string | null;
  /** Só pro quando = "sem_resposta": quanto tempo de silêncio, e em que unidade. */
  esperaValor?: number | null;
  esperaUnidade?: string | null;
  /**
   * Só nos gatilhos de ENTRADA na etapa: quantos minutos esperar antes de agir.
   *
   * Nulo ou zero = imediatamente, que é como todo gatilho gravado antes desta coluna se comporta.
   * Ver `atraso-do-gatilho.ts` e a fila `GatilhoAgendado`.
   */
  atrasoMinutos?: number | null;
  /** Só pro quando = "diariamente": "diaria" | "semanal" | "mensal" | "anual". Ver `repeticao-do-gatilho.ts`. */
  repeticao?: string | null;
  /** Só pra repeticao = "mensal": o dia do mês (1–31). */
  diaDoMes?: number | null;
  /** Só pra repeticao = "anual": "MM-DD". */
  dataAnual?: string | null;
  /** Só pro quando = "campo_de_data": o id do campo de data, ou "nascimento". */
  campoDeData?: string | null;
  /** Só pro quando = "campo_de_data": horas antes (negativo) ou depois (positivo). */
  campoOffsetHoras?: number | null;
  ativo: boolean;
  ordem: number;
};

export const QUANDO_ROTULO: Record<QuandoGatilho, string> = {
  /*
   * SEM A PALAVRA "IMEDIATAMENTE" NO RÓTULO DO EVENTO.
   *
   * "Se lá em Executar está escrito 'imediatamente quando movido para a etapa', eu não tenho como
   * escolher lá embaixo — porque aí um está falando imediatamente e o outro está falando depois
   * de 5 minutos."
   *
   * Estava certo. O rótulo afirmava o TEMPO ("imediatamente") junto do EVENTO ("quando movido"),
   * e quando a espera virou uma escolha própria a tela passou a dizer duas coisas sobre a mesma
   * pergunta. O rótulo agora diz só o evento; o tempo é a outra metade da frase, escolhida ao
   * lado — "Depois de 5 minutos · quando movido para esta etapa" se lê como uma frase só.
   */
  criado: "Quando criado nesta etapa",
  movido: "Quando movido para esta etapa",
  movido_ou_criado: "Quando movido para ou criado nesta etapa",
  saiu: "Quando sair desta etapa",
  responsavel_alterado: "Quando o responsável for alterado",
  etiqueta_adicionada: "Quando uma etiqueta for adicionada",
  etiqueta_removida: "Quando uma etiqueta for removida",
  campo_alterado: "Quando um campo for alterado",
  diariamente: "Numa hora, repetindo",
  data_hora: "Numa data e hora exatas, uma vez",
  sem_resposta: "Quando passar um tempo sem resposta do lead",
  campo_de_data: "Antes ou depois de uma data da ficha",
  mensagem_recebida: "Quando o lead mandar uma mensagem",
  formulario_enviado: "Quando um formulário for enviado",
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
  { titulo: "Gatilhos programados", quandos: ["diariamente", "campo_de_data", "data_hora", "sem_resposta"] },
  { titulo: "Gatilhos de conversação", quandos: ["mensagem_recebida"] },
  { titulo: "Gatilhos baseados em ações", quandos: ["formulario_enviado"] },
];

/**
 * OS GATILHOS QUE O RELÓGIO ACIONA, não um evento.
 *
 * Ninguém move um card nem manda mensagem: alguém precisa PERGUNTAR, de minuto em minuto, se
 * chegou a hora. A lista mora aqui (e não dentro da varredura) porque é a mesma resposta que o
 * teste usa pra cobrar `EVENTO_DO_QUANDO` de todos os OUTROS: um gatilho novo ou está nesta lista,
 * ou tem evento do CRM que o aciona. Fora disso, ele existiria só na tela.
 */
export const QUANDOS_VARRIDOS: QuandoGatilho[] = [
  "diariamente",
  "data_hora",
  "sem_resposta",
  "campo_de_data",
];

/** Os que acontecem quando o lead CHEGA na etapa: o disparo sai de quem moveu o card. */
export const QUANDOS_DE_ENTRADA: QuandoGatilho[] = ["movido", "criado", "movido_ou_criado"];

/**
 * O evento do CRM que aciona cada `quando`, pros gatilhos que NÃO são de entrada na etapa.
 *
 * O que está aqui é o que o servidor emite de verdade. A tabela existe pra o disparador não
 * precisar de um `switch` paralelo que alguém esqueceria de atualizar ao acrescentar um gatilho.
 */
export const EVENTO_DO_QUANDO: Partial<Record<QuandoGatilho, string>> = {
  saiu: "lead_saiu_etapa",
  // A mensagem que chega do lead, em qualquer canal. É o mesmo evento que já aciona o bloco
  // "Mensagem recebida" dos robôs: aqui ele passa a acordar também os gatilhos da etapa em que o
  // lead está, que é o que faz "quando alguém de Follow-up responder, faça X" existir.
  mensagem_recebida: "mensagem_recebida",
  responsavel_alterado: "responsavel_alterado",
  etiqueta_adicionada: "etiqueta_adicionada",
  etiqueta_removida: "etiqueta_removida",
  campo_alterado: "campo_alterado",
  formulario_enviado: "formulario_preenchido",
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


/**
 * Chegou o minuto marcado?
 *
 * O instante é guardado como texto local ("2026-11-04T22:33"), igual ao que o `datetime-local` da
 * tela produz, e a comparação é de MINUTO — a varredura bate a cada minuto, e comparar instantes
 * exatos nunca casaria. Fora aqui ninguém formata esse texto: duas formatações divergiriam, e
 * divergir significa um gatilho que nunca dispara.
 */
export function minutoLocal(agora: Date): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${d(agora.getMonth() + 1)}-${d(agora.getDate())}T${d(agora.getHours())}:${d(agora.getMinutes())}`;
}

export function ehOMinutoMarcado(dataHora: string | null | undefined, agora: Date): boolean {
  if (!dataHora) return false;
  // Aceita com e sem segundos: alguns navegadores mandam "2026-11-04T22:33:00".
  return dataHora.slice(0, 16) === minutoLocal(agora);
}

/**
 * Desde quando o lead está em silêncio pro gatilho valer.
 *
 * Devolve o INSTANTE LIMITE: última mensagem do lead mais antiga que isso = ele sumiu há tempo
 * demais. Sem valor configurado são 2 horas, o mesmo padrão do gatilho de tempo dos robôs.
 */
export function limiteDeSilencio(
  valor: number | null | undefined,
  unidade: string | null | undefined,
  agora: Date,
): Date {
  const quantos = Number(valor) > 0 ? Number(valor) : 2;
  const porUnidade = String(unidade ?? "horas").startsWith("dia") ? 86_400_000 : 3_600_000;
  return new Date(agora.getTime() - quantos * porUnidade);
}
