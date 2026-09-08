import type { FlowNodeType } from "./types";

/**
 * O que costuma vir DEPOIS de cada bloco. O miolo do "+" contextual.
 *
 * O menu do "+" mostrava sempre a mesma lista fixa. Só que "o que acontece agora?" tem resposta
 * diferente conforme onde você está: depois de uma mensagem, quase sempre é esperar a resposta;
 * depois de uma espera, é decidir o que fazer com ela; depois do gatilho, é falar com a pessoa.
 * Mostrar a lista certa é a diferença entre escolher e procurar.
 *
 * A lista é sugestão, não limite: o botão "Ver todas as ações" continua abrindo a biblioteca
 * inteira logo abaixo.
 */
const DEPOIS_DE_MENSAGEM: FlowNodeType[] = [
  "aguardar",
  "decisao_multipla",
  "mensagem_texto",
  "adicionar_etiqueta",
  "encaminhar_humano",
];

const DEPOIS_DE_ESPERA: FlowNodeType[] = [
  "decisao_multipla",
  "condicao_grupo",
  "mensagem_texto",
  "alterar_etapa",
  "encaminhar_humano",
];

const DEPOIS_DE_GATILHO: FlowNodeType[] = [
  "mensagem_texto",
  "mensagem_botoes",
  "adicionar_etiqueta",
  "alterar_responsavel",
  "alterar_etapa",
  "criar_tarefa",
];

const DEPOIS_DE_DECISAO: FlowNodeType[] = [
  "mensagem_texto",
  "alterar_etapa",
  "adicionar_etiqueta",
  "criar_tarefa",
  "encaminhar_humano",
  "encerrar_fluxo",
];

const PADRAO: FlowNodeType[] = [
  "mensagem_texto",
  "aguardar",
  "decisao_multipla",
  "alterar_etapa",
  "adicionar_etiqueta",
  "criar_tarefa",
];

export function sugestoesApos(tipo: FlowNodeType | undefined, categoria: string | undefined): FlowNodeType[] {
  if (!tipo) return PADRAO;

  if (categoria === "gatilho") return DEPOIS_DE_GATILHO;
  if (tipo === "aguardar") return DEPOIS_DE_ESPERA;
  if (tipo === "condicao_grupo" || tipo === "decisao_multipla" || tipo === "ia_classificar") return DEPOIS_DE_DECISAO;
  if (categoria === "mensagem") return DEPOIS_DE_MENSAGEM;

  return PADRAO;
}

/**
 * Um follow-up é uma espera com prazo + a mensagem que sai quando o prazo vence.
 *
 * O briefing pede FOLLOW-UP como recurso de alto nível, e ao mesmo tempo diz pra não criar um
 * segundo motor. As duas coisas cabem juntas: aqui é só um gerador de nós. Ele monta o par que a
 * pessoa montaria à mão, já ligado e já configurado. O motor não sabe que isso se chama follow-up,
 * e é justamente por isso que funciona sem nenhum código novo de execução.
 *
 * A espera é "até responder OU X horas": quem responder antes sai pelo caminho de cima e NÃO
 * recebe a cobrança: que é o comportamento que a pessoa espera e o que o motor com estado agora
 * sabe fazer.
 */
export function nosDeFollowUp(params: { horas: number; mensagem: string }): {
  espera: { tipo: FlowNodeType; data: Record<string, unknown> };
  mensagem: { tipo: FlowNodeType; data: Record<string, unknown> };
  /** A saída da espera que leva à mensagem: só quem NÃO respondeu recebe o follow-up. */
  saidaDaEspera: string;
} {
  return {
    espera: {
      tipo: "aguardar",
      data: {
        modo: "ate_resposta",
        tempoMaximo: { valor: params.horas, unidade: "horas" },
      },
    },
    mensagem: {
      tipo: "mensagem_texto",
      data: { canal: "whatsapp", texto: params.mensagem },
    },
    saidaDaEspera: "timeout",
  };
}
