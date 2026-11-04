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
  /** Fecha o caminho depois da cobrança. Ver o comentário abaixo. */
  fim: { tipo: FlowNodeType; data: Record<string, unknown> };
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
    // A validação recusa publicar um caminho que termina no ar, e com razão: ninguém sabe o que
    // acontece com o lead depois. Sem este bloco a receita pronta do produto gerava um fluxo que o
    // próprio produto se recusava a publicar, e quem clicou em "Adicionar follow-up" só descobria
    // isso lá na frente, ao tentar publicar.
    fim: {
      tipo: "encerrar_fluxo",
      data: {},
    },
    saidaDaEspera: "timeout",
  };
}

/**
 * O QUE APARECE PRIMEIRO na caixa "Adicionar próximo passo".
 *
 * A lista nascia na ordem em que os blocos estão declarados na biblioteca, e essa ordem é de
 * CATÁLOGO: começa pelas decisões e pelo sorteio, e as mensagens ficavam lá embaixo, depois de
 * rolar. Só que a conta é outra: "o que eu mando pro contato" é o que se escolhe quase toda vez, e
 * "separar caminhos" é o que se escolhe de vez em quando.
 *
 * Escolhido pela Thaynara, na ordem em que ela pediu: "enviar mensagem, enviar texto, enviar
 * imagem, enviar vídeo, enviar contato, localização, mensagem com botões, mensagem com listas,
 * modelo aprovado pelo WhatsApp". Áudio e documento entram junto com os outros envios de mídia,
 * porque é a mesma família — deixá-los depois de "Distribuir" seria uma ordem que só faz sentido
 * pra quem escreveu a lista.
 */
export const PRIMEIROS_NO_PROXIMO_PASSO: FlowNodeType[] = [
  "mensagem_texto",
  "mensagem_imagem",
  "mensagem_video",
  "mensagem_audio",
  "mensagem_documento",
  "mensagem_contato",
  "mensagem_localizacao",
  "mensagem_botoes",
  "mensagem_lista",
  "mensagem_modelo_whatsapp",
];

const POSICAO_DOS_PRIMEIROS = new Map(PRIMEIROS_NO_PROXIMO_PASSO.map((tipo, i) => [tipo, i]));

/**
 * Separa a lista em "os de sempre" e "o resto", preservando a ordem dentro de cada parte.
 *
 * Duas listas, e não uma lista ordenada: entre elas entra o atalho de follow-up, que não é um
 * bloco da biblioteca e por isso não cabe numa ordenação só. E o resto continua na ordem da
 * biblioteca de propósito — ela agrupa por assunto, e reordenar tudo faria blocos parentes se
 * separarem sem motivo.
 */
export function separarPrimeirosPassos<T extends { tipo: FlowNodeType }>(
  blocos: T[],
): { primeiros: T[]; resto: T[] } {
  const primeiros = blocos
    .filter((b) => POSICAO_DOS_PRIMEIROS.has(b.tipo))
    .sort((a, b) => POSICAO_DOS_PRIMEIROS.get(a.tipo)! - POSICAO_DOS_PRIMEIROS.get(b.tipo)!);
  const resto = blocos.filter((b) => !POSICAO_DOS_PRIMEIROS.has(b.tipo));
  return { primeiros, resto };
}
