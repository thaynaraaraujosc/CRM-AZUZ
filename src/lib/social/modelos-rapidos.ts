import { layoutFluxo } from "@/lib/automation-flow/migracao";
import type {
  ConfiguracoesFluxo,
  FlowEdge,
  FlowNode,
  FlowNodeCategory,
  FlowNodeType,
} from "@/lib/automation-flow/types";

/**
 * Automações rápidas do Instagram: o robô já montado, pronto pra ajustar o texto e publicar.
 *
 * O construtor em branco é honesto mas é uma parede: quem abre pela primeira vez não sabe que
 * "comentou a palavra X e recebeu o link no Direct" é possível, muito menos por onde começar. Cada
 * modelo aqui é um fluxo COMPLETO e válido, feito só de gatilhos e blocos que existem de verdade
 * neste canal (a tabela de capacidades é quem diz quais são).
 *
 * Eles nascem RASCUNHO, nunca publicados. Publicar sozinho ligaria uma automação que ninguém leu,
 * respondendo cliente com um texto de exemplo.
 */

export type ModeloSocial = {
  id: string;
  nome: string;
  /** O que ele faz, na frase que alguém diria em voz alta. */
  descricao: string;
  /** O que precisa ser trocado antes de publicar. Some da tela nenhum modelo funciona de cara. */
  ajustar: string;
  construir: () => { nodes: FlowNode[]; edges: FlowEdge[]; configuracoes: ConfiguracoesFluxo };
};

function no<T>(id: string, type: FlowNodeType, category: FlowNodeCategory, data: T, titulo?: string): FlowNode<T> {
  return { id, type, category, position: { x: 0, y: 0 }, titulo, data };
}

function aresta(source: string, target: string, sourceHandle?: string): FlowEdge {
  return { id: `${source}->${target}${sourceHandle ? `:${sourceHandle}` : ""}`, source, target, sourceHandle };
}

/**
 * A configuração comum dos modelos sociais.
 *
 * `naoIniciarSeJaNoFluxo` importa mais aqui do que no comercial: no Instagram a mesma pessoa
 * comenta três vezes seguidas na mesma publicação, e sem isso receberia a mesma mensagem três
 * vezes.
 */
function configuracoesPadrao(): ConfiguracoesFluxo {
  return { motorNovo: true, naoIniciarSeJaNoFluxo: true };
}

function montar(nodes: FlowNode[], edges: FlowEdge[]) {
  layoutFluxo(nodes, edges);
  return { nodes, edges, configuracoes: configuracoesPadrao() };
}

export const MODELOS_SOCIAIS: ModeloSocial[] = [
  {
    id: "comentario-link",
    nome: "Comentou a palavra, recebe o link no Direct",
    descricao:
      "Alguém comenta a palavra combinada numa publicação e recebe o link no Direct. O comentário também é respondido, pra quem vê a publicação entender que funcionou.",
    ajustar: "Troque a palavra, o texto da resposta e o link.",
    construir: () => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];

      nodes.push(
        no(
          "cl-gatilho",
          "comentario_instagram",
          "gatilho",
          {
            canal: "Instagram",
            palavras: ["quero"],
            modoPalavra: "qualquer",
            ignorarAcentos: true,
            publicacaoId: "",
          },
          "Comentou a palavra combinada",
        ),
      );

      // Responder o comentário ANTES do Direct é deliberado: é o que aparece publicamente e o que
      // faz a próxima pessoa comentar também.
      nodes.push(
        no("cl-responde", "responder_comentario_instagram", "acao", {
          texto: "Te mandei no Direct! 💙",
        }),
      );
      edges.push(aresta("cl-gatilho", "cl-responde"));

      nodes.push(
        no("cl-direct", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Oi! Vi seu comentário 💙 Aqui está o que prometi: (cole o link aqui)",
        }),
      );
      edges.push(aresta("cl-responde", "cl-direct"));

      nodes.push(no("cl-etiqueta", "adicionar_etiqueta", "acao", { etiquetaNome: "Veio do Instagram" }));
      edges.push(aresta("cl-direct", "cl-etiqueta"));

      nodes.push(
        no("cl-fim", "encerrar_fluxo", "fim", {
          observacao: "Link entregue por comentário.",
        }),
      );
      edges.push(aresta("cl-etiqueta", "cl-fim"));

      return montar(nodes, edges);
    },
  },

  {
    id: "story-conversa",
    nome: "Respondeu meu story, vira conversa",
    descricao:
      "Quem responde um story recebe uma pergunta com opções e é encaminhado conforme o que escolher. É o jeito de transformar audiência em atendimento.",
    ajustar: "Troque o texto da pergunta e as opções pelo que você vende.",
    construir: () => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];

      nodes.push(
        no(
          "sc-gatilho",
          "instagram_story_respondido",
          "gatilho",
          { canal: "Instagram", palavras: [], modoPalavra: "qualquer", ignorarAcentos: true },
          "Respondeu um story",
        ),
      );

      // Respostas rápidas: o Direct aceita até 13, e duas é o que cabe numa conversa que começou
      // agora. `esperaMinutos` é o que faz a saída "Sem resposta" existir de verdade.
      nodes.push(
        no("sc-pergunta", "mensagem_botoes", "mensagem", {
          canal: "instagram",
          texto: "Oi! Que bom que respondeu 💙 Como posso te ajudar?",
          opcoes: [
            { id: "sc-op-preco", rotulo: "Quero saber preço" },
            { id: "sc-op-duvida", rotulo: "Tenho uma dúvida" },
          ],
          formatoResposta: "botoes",
          esperaMinutos: 120,
        }),
      );
      edges.push(aresta("sc-gatilho", "sc-pergunta"));

      nodes.push(
        no("sc-preco", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Perfeito! Me conta rapidinho o que você procura que eu te passo os valores.",
        }),
      );
      edges.push(aresta("sc-pergunta", "sc-preco", "sc-op-preco"));

      nodes.push(no("sc-humano", "encaminhar_humano", "humano", {}));
      edges.push(aresta("sc-preco", "sc-humano"));

      nodes.push(
        no("sc-duvida", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Pode perguntar! Já já alguém do time te responde por aqui.",
        }),
      );
      edges.push(aresta("sc-pergunta", "sc-duvida", "sc-op-duvida"));
      edges.push(aresta("sc-duvida", "sc-humano"));

      // A saída de quem não respondeu em 2 horas. Sem ela o fluxo ficaria parado pra sempre e a
      // pessoa sumiria do funil sem ninguém saber.
      nodes.push(
        no("sc-sem-resposta", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Respondeu o story mas não continuou a conversa.",
        }),
      );
      edges.push(aresta("sc-pergunta", "sc-sem-resposta", "nao_respondeu"));

      nodes.push(no("sc-fim", "encerrar_fluxo", "fim", { observacao: "Conversa entregue ao time." }));
      edges.push(aresta("sc-humano", "sc-fim"));

      return montar(nodes, edges);
    },
  },

  {
    id: "primeira-dm",
    nome: "Primeira mensagem no Direct, boas-vindas e triagem",
    descricao:
      "Quem escreve no Direct recebe uma saudação e escolhe o assunto. O contato entra no CRM com etiqueta de origem.",
    ajustar: "Troque a saudação e as opções.",
    construir: () => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];

      nodes.push(no("dm-gatilho", "instagram_direct_recebido", "gatilho", { canal: "Instagram" }, "Mandou mensagem no Direct"));

      nodes.push(
        no("dm-pergunta", "mensagem_botoes", "mensagem", {
          canal: "instagram",
          texto: "Oi! Seja bem-vindo(a) 💙 Sobre o que você quer falar?",
          opcoes: [
            { id: "dm-op-comprar", rotulo: "Quero comprar" },
            { id: "dm-op-suporte", rotulo: "Já sou cliente" },
          ],
          formatoResposta: "botoes",
          esperaMinutos: 120,
        }),
      );
      edges.push(aresta("dm-gatilho", "dm-pergunta"));

      nodes.push(no("dm-etq-novo", "adicionar_etiqueta", "acao", { etiquetaNome: "Lead do Instagram" }));
      edges.push(aresta("dm-pergunta", "dm-etq-novo", "dm-op-comprar"));

      nodes.push(no("dm-humano", "encaminhar_humano", "humano", {}));
      edges.push(aresta("dm-etq-novo", "dm-humano"));

      nodes.push(no("dm-etq-cliente", "adicionar_etiqueta", "acao", { etiquetaNome: "Cliente" }));
      edges.push(aresta("dm-pergunta", "dm-etq-cliente", "dm-op-suporte"));
      edges.push(aresta("dm-etq-cliente", "dm-humano"));

      nodes.push(
        no("dm-sem-resposta", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Escreveu no Direct mas não escolheu o assunto.",
        }),
      );
      edges.push(aresta("dm-pergunta", "dm-sem-resposta", "nao_respondeu"));

      nodes.push(no("dm-fim", "encerrar_fluxo", "fim", { observacao: "Triagem feita." }));
      edges.push(aresta("dm-humano", "dm-fim"));

      return montar(nodes, edges);
    },
  },

  {
    id: "mencao-story",
    nome: "Me marcou num story, agradece",
    descricao:
      "Quem marca seu perfil num story recebe um agradecimento no Direct. É o gesto mais barato de relacionamento que existe, e quase ninguém faz à mão.",
    ajustar: "Troque o texto do agradecimento.",
    construir: () => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];

      nodes.push(no("ms-gatilho", "instagram_mencao_story", "gatilho", { canal: "Instagram" }, "Marcou o perfil num story"));

      nodes.push(
        no("ms-msg", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Vi que você nos marcou, muito obrigado! 💙",
        }),
      );
      edges.push(aresta("ms-gatilho", "ms-msg"));

      nodes.push(no("ms-etiqueta", "adicionar_etiqueta", "acao", { etiquetaNome: "Divulgou a marca" }));
      edges.push(aresta("ms-msg", "ms-etiqueta"));

      nodes.push(no("ms-fim", "encerrar_fluxo", "fim", { observacao: "Agradecimento enviado." }));
      edges.push(aresta("ms-etiqueta", "ms-fim"));

      return montar(nodes, edges);
    },
  },
];
