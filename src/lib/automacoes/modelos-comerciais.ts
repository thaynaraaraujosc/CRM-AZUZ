import { layoutFluxo } from "@/lib/automation-flow/migracao";
import type {
  ConfiguracoesFluxo,
  FlowEdge,
  FlowNode,
  FlowNodeCategory,
  FlowNodeType,
} from "@/lib/automation-flow/types";
import type { QuandoGatilho } from "@/lib/funil/gatilhos-etapa-tipos";

/**
 * Modelos AZUZ do funil comercial: o robô inteiro já montado, pronto pra trocar o texto e publicar.
 *
 * Mesma ideia dos modelos do Instagram (`src/lib/social/modelos-rapidos.ts`), e pela mesma razão:
 * o canvas em branco é honesto e é uma parede. Quem abre a tela pela primeira vez não sabe que
 * "esperou 24 horas, não respondeu, manda a cobrança e cria tarefa pro vendedor" é possível, e
 * muito menos por onde começar.
 *
 * São os fluxos que qualquer CRM de vendas tem: receber e triar o lead novo, promover quem
 * respondeu, cobrar proposta parada, qualificar por pergunta, cuidar de quem fechou e reativar
 * quem sumiu.
 *
 * Duas regras que valem pros seis:
 *
 * 1. Nascem RASCUNHO. Publicar sozinho ligaria uma automação que ninguém leu, falando com cliente
 *    de verdade com texto de exemplo.
 * 2. Só usam bloco que existe e que o motor executa. Nada aqui é ilustração.
 */

/** O que o modelo precisa saber do funil de destino pra se montar. */
export type ContextoModelo = {
  funilId: string;
  /** Etapas do funil escolhido, na ordem em que aparecem no quadro. */
  etapas: { id: string; titulo: string }[];
  /** A etapa em que este robô vai começar. */
  etapaId: string;
};

export type ModeloComercial = {
  id: string;
  nome: string;
  /** O que ele faz, na frase que alguém diria em voz alta. */
  descricao: string;
  /** O que precisa ser trocado antes de publicar. Nenhum modelo funciona de cara sem isso. */
  ajustar: string;
  /** Em que etapa ele costuma viver. Vira sugestão na tela, não obrigação. */
  ondeCostumaViver: string;
  /**
   * Quando a etapa deve disparar o robô, ou `null` quando o gatilho é um bloco DENTRO do fluxo.
   *
   * "Lead parado na etapa" é o único caso de bloco: passar tempo sem trocar mensagem não é um
   * evento da etapa, é uma varredura por tempo, e ela mora no canvas.
   */
  quandoSugerido: QuandoGatilho | null;
  construir: (ctx: ContextoModelo) => {
    nodes: FlowNode[];
    edges: FlowEdge[];
    configuracoes: ConfiguracoesFluxo;
  };
};

function no<T>(
  id: string,
  type: FlowNodeType,
  category: FlowNodeCategory,
  data: T,
  titulo?: string,
): FlowNode<T> {
  return { id, type, category, position: { x: 0, y: 0 }, titulo, data };
}

function aresta(source: string, target: string, sourceHandle?: string): FlowEdge {
  return {
    id: `${source}->${target}${sourceHandle ? `:${sourceHandle}` : ""}`,
    source,
    target,
    sourceHandle,
  };
}

/**
 * A etapa seguinte à do gatilho, pra onde o lead avança quando reage.
 *
 * Ninguém sabe como a Thaynara ou o cliente dela chamou as colunas do funil, então adivinhar por
 * nome ("Qualificado", "Negociação") daria errado na primeira conta que usa outro vocabulário. A
 * ordem do quadro, essa toda empresa tem: a etapa seguinte é sempre "mais pra frente na venda".
 * Na última etapa não há pra onde avançar e o lead fica onde está.
 */
function proximaEtapa(ctx: ContextoModelo): { id: string; titulo: string } | null {
  const i = ctx.etapas.findIndex((e) => e.id === ctx.etapaId);
  if (i < 0) return ctx.etapas[0] ?? null;
  return ctx.etapas[i + 1] ?? null;
}

function tituloDaEtapa(ctx: ContextoModelo): string {
  return ctx.etapas.find((e) => e.id === ctx.etapaId)?.titulo ?? "";
}

/**
 * `naoIniciarSeJaNoFluxo` em todos: o lead que volta pra mesma etapa duas vezes no mesmo dia (e
 * isso acontece o tempo todo num funil que é arrastado à mão) receberia a mesma sequência de novo.
 */
function configuracoesPadrao(): ConfiguracoesFluxo {
  return { motorNovo: true, naoIniciarSeJaNoFluxo: true };
}

function montar(nodes: FlowNode[], edges: FlowEdge[]) {
  layoutFluxo(nodes, edges);
  return { nodes, edges, configuracoes: configuracoesPadrao() };
}

/** Espera com dois caminhos: quem respondeu e quem deixou o tempo acabar. */
function espera(id: string, valor: number, unidade: "horas" | "dias", titulo: string) {
  return no(
    id,
    "aguardar",
    "espera",
    { modo: "ate_resposta", tempoMaximo: { valor, unidade }, somenteExpediente: true },
    titulo,
  );
}

export const MODELOS_COMERCIAIS: ModeloComercial[] = [
  /* ---------------------------------------------------------------- 1 ----- */
  {
    id: "boas-vindas-triagem",
    nome: "Boas-vindas e triagem do lead novo",
    descricao:
      "O lead novo recebe uma saudação e escolhe o assunto. Quem quer preço avança de etapa e cai no time; quem só pesquisa fica marcado e sai do caminho.",
    ajustar: "Troque a saudação, as três opções e o nome da empresa.",
    ondeCostumaViver: "A primeira etapa do funil",
    quandoSugerido: "movido_ou_criado",
    construir: (ctx) => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];
      const avancar = proximaEtapa(ctx);

      // Três opções, não quatro: é o limite do que o WhatsApp oficial entrega como botão. Acima
      // disso a pergunta vira lista e perde metade da taxa de resposta.
      nodes.push(
        no(
          "bv-pergunta",
          "mensagem_botoes",
          "mensagem",
          {
            canal: "whatsapp",
            texto:
              "Oi {primeiro_nome}! Tudo bem? Recebi seu contato por aqui 💙\n\nPra eu te ajudar do jeito certo, me diz: o que você precisa agora?",
            opcoes: [
              { id: "bv-op-preco", rotulo: "Quero saber preço" },
              { id: "bv-op-duvida", rotulo: "Tenho uma dúvida" },
              { id: "bv-op-pesquisa", rotulo: "Só pesquisando" },
            ],
            formatoResposta: "botoes",
            esperaMinutos: 1440,
          },
          "Boas-vindas e pergunta",
        ),
      );

      nodes.push(no("bv-etq-quente", "adicionar_etiqueta", "acao", { etiquetaNome: "Quer preço" }));
      edges.push(aresta("bv-pergunta", "bv-etq-quente", "bv-op-preco"));

      if (avancar) {
        nodes.push(
          no("bv-avanca", "alterar_etapa", "acao", {
            funilId: ctx.funilId,
            etapaTitulo: avancar.titulo,
          }),
        );
        edges.push(aresta("bv-etq-quente", "bv-avanca"));
      }

      nodes.push(no("bv-humano", "encaminhar_humano", "humano", {}, "Passa pro time"));
      edges.push(aresta(avancar ? "bv-avanca" : "bv-etq-quente", "bv-humano"));

      // Dúvida também é gente com interesse: vai pro time igual, só não avança de etapa sozinho.
      nodes.push(
        no("bv-duvida", "mensagem_texto", "mensagem", {
          canal: "whatsapp",
          texto: "Pode perguntar! Já já alguém do time responde por aqui.",
        }),
      );
      edges.push(aresta("bv-pergunta", "bv-duvida", "bv-op-duvida"));
      edges.push(aresta("bv-duvida", "bv-humano"));

      nodes.push(
        no("bv-pesquisa", "mensagem_texto", "mensagem", {
          canal: "whatsapp",
          texto:
            "Perfeito, {primeiro_nome}. Fico por aqui: quando quiser ver valores é só mandar uma mensagem 💙",
        }),
      );
      edges.push(aresta("bv-pergunta", "bv-pesquisa", "bv-op-pesquisa"));

      nodes.push(no("bv-etq-frio", "adicionar_etiqueta", "acao", { etiquetaNome: "Só pesquisando" }));
      edges.push(aresta("bv-pesquisa", "bv-etq-frio"));

      nodes.push(
        no("bv-fim-frio", "encerrar_fluxo", "fim", {
          motivo: "concluido",
          observacao: "Lead disse que só está pesquisando.",
        }),
      );
      edges.push(aresta("bv-etq-frio", "bv-fim-frio"));

      // Quem não respondeu em 24 horas não some: fica marcado e vira trabalho de alguém.
      nodes.push(no("bv-etq-mudo", "adicionar_etiqueta", "acao", { etiquetaNome: "Sem resposta" }));
      edges.push(aresta("bv-pergunta", "bv-etq-mudo", "nao_respondeu"));

      nodes.push(
        no("bv-tarefa-mudo", "criar_tarefa", "acao", {
          titulo: "Ligar pro lead que não respondeu no WhatsApp",
          modoResponsavel: "atual",
          modoPrazo: "depois_de",
          prazoValor: 1,
          prazoUnidade: "dias",
          prioridade: "normal",
          relacionarA: "ambos",
        }),
      );
      edges.push(aresta("bv-etq-mudo", "bv-tarefa-mudo"));

      nodes.push(
        no("bv-fim-mudo", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Não respondeu a saudação em 24 horas.",
        }),
      );
      edges.push(aresta("bv-tarefa-mudo", "bv-fim-mudo"));

      nodes.push(
        no("bv-fim", "encerrar_fluxo", "fim", {
          motivo: "transferido",
          observacao: "Conversa entregue ao time.",
        }),
      );
      edges.push(aresta("bv-humano", "bv-fim"));

      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 2 ----- */
  {
    id: "respondeu-vira-qualificado",
    nome: "Respondeu, vira qualificado",
    descricao:
      "Manda a primeira abordagem e espera. Quem responder é marcado, avança de etapa e vira tarefa pro vendedor. Quem não responder recebe uma segunda tentativa antes de sair do caminho.",
    ajustar: "Troque a abordagem e a segunda tentativa.",
    ondeCostumaViver: "A etapa de lead novo",
    quandoSugerido: "movido_ou_criado",
    construir: (ctx) => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];
      const avancar = proximaEtapa(ctx);

      nodes.push(
        no(
          "rq-abordagem",
          "mensagem_texto",
          "mensagem",
          {
            canal: "whatsapp",
            texto:
              "Oi {primeiro_nome}! Aqui é da equipe 💙\n\nVi que você se interessou pelo que a gente faz. Me conta rapidinho o que você está procurando?",
          },
          "Primeira abordagem",
        ),
      );

      nodes.push(espera("rq-espera-1", 24, "horas", "Espera a resposta (24h)"));
      edges.push(aresta("rq-abordagem", "rq-espera-1"));

      // O caminho de quem respondeu é um só: as duas esperas terminam nele. É o que faz a segunda
      // tentativa valer a pena em vez de virar um ramo paralelo que ninguém acompanha.
      nodes.push(no("rq-etq-respondeu", "adicionar_etiqueta", "acao", { etiquetaNome: "Respondeu" }));
      edges.push(aresta("rq-espera-1", "rq-etq-respondeu", "ok"));

      if (avancar) {
        nodes.push(
          no("rq-avanca", "alterar_etapa", "acao", {
            funilId: ctx.funilId,
            etapaTitulo: avancar.titulo,
          }),
        );
        edges.push(aresta("rq-etq-respondeu", "rq-avanca"));
      }

      nodes.push(
        no("rq-tarefa", "criar_tarefa", "acao", {
          titulo: "Falar com o lead que respondeu",
          modoResponsavel: "atual",
          modoPrazo: "imediatamente",
          prioridade: "alta",
          relacionarA: "ambos",
        }),
      );
      edges.push(aresta(avancar ? "rq-avanca" : "rq-etq-respondeu", "rq-tarefa"));

      nodes.push(no("rq-humano", "encaminhar_humano", "humano", {}, "Passa pro vendedor"));
      edges.push(aresta("rq-tarefa", "rq-humano"));

      nodes.push(
        no("rq-fim-ok", "encerrar_fluxo", "fim", {
          motivo: "transferido",
          observacao: "Lead respondeu e foi qualificado.",
        }),
      );
      edges.push(aresta("rq-humano", "rq-fim-ok"));

      nodes.push(
        no("rq-segunda", "mensagem_texto", "mensagem", {
          canal: "whatsapp",
          texto:
            "Oi {primeiro_nome}, passando aqui de novo 🙂\n\nSe agora não for uma boa hora, tudo bem. Só me diz um sim ou um não que eu me organizo.",
        }),
      );
      edges.push(aresta("rq-espera-1", "rq-segunda", "timeout"));

      nodes.push(espera("rq-espera-2", 2, "dias", "Espera a resposta (2 dias)"));
      edges.push(aresta("rq-segunda", "rq-espera-2"));
      edges.push(aresta("rq-espera-2", "rq-etq-respondeu", "ok"));

      nodes.push(no("rq-etq-mudo", "adicionar_etiqueta", "acao", { etiquetaNome: "Sem resposta" }));
      edges.push(aresta("rq-espera-2", "rq-etq-mudo", "timeout"));

      nodes.push(
        no("rq-fim-mudo", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Duas tentativas sem resposta.",
        }),
      );
      edges.push(aresta("rq-etq-mudo", "rq-fim-mudo"));

      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 3 ----- */
  {
    id: "proposta-follow-up",
    nome: "Proposta enviada, follow-up em três toques",
    descricao:
      "Depois da proposta, cobra três vezes com intervalos crescentes. Qualquer resposta interrompe a sequência e chama o vendedor. No fim sem resposta, vira tarefa de ligação.",
    ajustar: "Troque os três textos de cobrança pelo seu tom.",
    ondeCostumaViver: "A etapa de proposta ou negociação",
    quandoSugerido: "movido",
    construir: () => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];

      nodes.push(
        no(
          "pf-aviso",
          "mensagem_texto",
          "mensagem",
          {
            canal: "whatsapp",
            texto:
              "Oi {primeiro_nome}! Sua proposta está a caminho 💙\n\nQualquer dúvida sobre valores ou prazo, me chama por aqui.",
          },
          "Avisa que a proposta foi enviada",
        ),
      );

      // O caminho de quem responde é único e todas as esperas caem nele: é o que garante que
      // ninguém que já respondeu continue recebendo cobrança.
      nodes.push(no("pf-humano", "encaminhar_humano", "humano", {}, "Respondeu: chama o vendedor"));
      nodes.push(
        no("pf-fim-ok", "encerrar_fluxo", "fim", {
          motivo: "transferido",
          observacao: "Respondeu a proposta.",
        }),
      );
      edges.push(aresta("pf-humano", "pf-fim-ok"));

      const toques: { id: string; valor: number; unidade: "horas" | "dias"; texto: string }[] = [
        {
          id: "1",
          valor: 1,
          unidade: "dias",
          texto:
            "Oi {primeiro_nome}, conseguiu dar uma olhada na proposta? Se ficou alguma dúvida eu explico por aqui mesmo.",
        },
        {
          id: "2",
          valor: 2,
          unidade: "dias",
          texto:
            "{primeiro_nome}, tudo certo? Se o valor ou o prazo forem o ponto, me fala que eu vejo o que dá pra fazer.",
        },
        {
          id: "3",
          valor: 3,
          unidade: "dias",
          texto:
            "Oi {primeiro_nome}! Última vez que insisto, prometo 🙂 Se ainda faz sentido, é só responder. Se não fizer, me avisa que eu encerro por aqui.",
        },
      ];

      let anterior = "pf-aviso";
      toques.forEach((t, i) => {
        const idEspera = `pf-espera-${t.id}`;
        nodes.push(espera(idEspera, t.valor, t.unidade, `Espera ${t.valor} ${t.unidade}`));
        edges.push(aresta(anterior, idEspera));
        edges.push(aresta(idEspera, "pf-humano", "ok"));

        // O terceiro toque é a mensagem de despedida: depois dele não há mais espera, vai direto
        // pra tarefa de ligação.
        const idMsg = `pf-toque-${t.id}`;
        nodes.push(
          no(idMsg, "mensagem_texto", "mensagem", { canal: "whatsapp", texto: t.texto }, `Toque ${i + 1}`),
        );
        edges.push(aresta(idEspera, idMsg, "timeout"));
        anterior = idMsg;
      });

      nodes.push(no("pf-etq", "adicionar_etiqueta", "acao", { etiquetaNome: "Proposta sem resposta" }));
      edges.push(aresta(anterior, "pf-etq"));

      nodes.push(
        no("pf-tarefa", "criar_tarefa", "acao", {
          titulo: "Ligar: proposta sem resposta há uma semana",
          modoResponsavel: "atual",
          modoPrazo: "imediatamente",
          prioridade: "alta",
          relacionarA: "ambos",
        }),
      );
      edges.push(aresta("pf-etq", "pf-tarefa"));

      nodes.push(
        no("pf-fim", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Três cobranças sem resposta. Decisão vai pro vendedor.",
        }),
      );
      edges.push(aresta("pf-tarefa", "pf-fim"));

      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 4 ----- */
  {
    id: "qualificacao-duas-perguntas",
    nome: "Qualificar com duas perguntas",
    descricao:
      "Duas perguntas curtas: o que a pessoa procura e pra quando ela precisa. A urgência decide a etiqueta, se avança de etapa e se vira tarefa na hora.",
    ajustar: "Troque as opções da primeira pergunta pelo que você vende.",
    ondeCostumaViver: "A etapa de lead qualificado",
    quandoSugerido: "movido",
    construir: (ctx) => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];
      const avancar = proximaEtapa(ctx);

      nodes.push(
        no(
          "qd-p1",
          "mensagem_botoes",
          "mensagem",
          {
            canal: "whatsapp",
            texto: "Oi {primeiro_nome}! Pra eu te passar a informação certa: o que você procura?",
            opcoes: [
              { id: "qd-p1-a", rotulo: "Serviço principal" },
              { id: "qd-p1-b", rotulo: "Outro serviço" },
              { id: "qd-p1-c", rotulo: "Ainda não sei" },
            ],
            formatoResposta: "botoes",
            esperaMinutos: 1440,
          },
          "Pergunta 1: o que procura",
        ),
      );

      // As três opções caem na mesma segunda pergunta de propósito: o que muda a decisão é o
      // PRAZO, não qual serviço. Ramificar aqui triplicaria o desenho sem mudar o que acontece.
      nodes.push(
        no(
          "qd-p2",
          "mensagem_botoes",
          "mensagem",
          {
            canal: "whatsapp",
            texto: "Entendi! E pra quando você precisa disso?",
            opcoes: [
              { id: "qd-p2-agora", rotulo: "Essa semana" },
              { id: "qd-p2-mes", rotulo: "Este mês" },
              { id: "qd-p2-depois", rotulo: "Sem pressa" },
            ],
            formatoResposta: "botoes",
            esperaMinutos: 1440,
          },
          "Pergunta 2: pra quando",
        ),
      );
      edges.push(aresta("qd-p1", "qd-p2", "qd-p1-a"));
      edges.push(aresta("qd-p1", "qd-p2", "qd-p1-b"));
      edges.push(aresta("qd-p1", "qd-p2", "qd-p1-c"));

      nodes.push(no("qd-etq-urgente", "adicionar_etiqueta", "acao", { etiquetaNome: "Urgente" }));
      edges.push(aresta("qd-p2", "qd-etq-urgente", "qd-p2-agora"));

      nodes.push(
        no("qd-tarefa", "criar_tarefa", "acao", {
          titulo: "Atender agora: lead com urgência para esta semana",
          modoResponsavel: "atual",
          modoPrazo: "imediatamente",
          prioridade: "urgente",
          relacionarA: "ambos",
        }),
      );
      edges.push(aresta("qd-etq-urgente", "qd-tarefa"));

      nodes.push(no("qd-humano", "encaminhar_humano", "humano", {}, "Passa pro vendedor"));
      edges.push(aresta("qd-tarefa", "qd-humano"));

      nodes.push(no("qd-etq-mes", "adicionar_etiqueta", "acao", { etiquetaNome: "Este mês" }));
      edges.push(aresta("qd-p2", "qd-etq-mes", "qd-p2-mes"));

      if (avancar) {
        nodes.push(
          no("qd-avanca", "alterar_etapa", "acao", {
            funilId: ctx.funilId,
            etapaTitulo: avancar.titulo,
          }),
        );
        edges.push(aresta("qd-etq-mes", "qd-avanca"));
        edges.push(aresta("qd-avanca", "qd-humano"));
      } else {
        edges.push(aresta("qd-etq-mes", "qd-humano"));
      }

      nodes.push(no("qd-etq-frio", "adicionar_etiqueta", "acao", { etiquetaNome: "Sem pressa" }));
      edges.push(aresta("qd-p2", "qd-etq-frio", "qd-p2-depois"));

      nodes.push(
        no("qd-frio-msg", "mensagem_texto", "mensagem", {
          canal: "whatsapp",
          texto:
            "Combinado, {primeiro_nome}! Vou te deixar em paz e volto a falar mais pra frente. Se antecipar, é só chamar 💙",
        }),
      );
      edges.push(aresta("qd-etq-frio", "qd-frio-msg"));

      nodes.push(
        no("qd-fim-frio", "encerrar_fluxo", "fim", {
          motivo: "concluido",
          observacao: "Lead qualificado como sem pressa.",
        }),
      );
      edges.push(aresta("qd-frio-msg", "qd-fim-frio"));

      // As duas perguntas têm prazo, então as duas têm saída de quem não respondeu. Sem isso o
      // lead ficava parado dentro do robô pra sempre, sem aparecer em lugar nenhum.
      nodes.push(no("qd-etq-mudo", "adicionar_etiqueta", "acao", { etiquetaNome: "Sem resposta" }));
      edges.push(aresta("qd-p1", "qd-etq-mudo", "nao_respondeu"));
      edges.push(aresta("qd-p2", "qd-etq-mudo", "nao_respondeu"));

      nodes.push(
        no("qd-fim-mudo", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Parou de responder no meio da qualificação.",
        }),
      );
      edges.push(aresta("qd-etq-mudo", "qd-fim-mudo"));

      nodes.push(
        no("qd-fim", "encerrar_fluxo", "fim", {
          motivo: "transferido",
          observacao: "Lead qualificado e entregue ao vendedor.",
        }),
      );
      edges.push(aresta("qd-humano", "qd-fim"));

      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 5 ----- */
  {
    id: "pos-venda-indicacao",
    nome: "Fechou: agradece, pede avaliação e pede indicação",
    descricao:
      "Agradece na hora, pede avaliação depois de uma semana e pede indicação depois de um mês. É a parte que quase todo mundo deixa de fazer à mão.",
    ajustar: "Troque os três textos e cole o link da sua avaliação.",
    ondeCostumaViver: "A etapa de venda fechada",
    quandoSugerido: "movido",
    construir: () => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];

      nodes.push(
        no(
          "pv-obrigado",
          "mensagem_texto",
          "mensagem",
          {
            canal: "whatsapp",
            texto:
              "{primeiro_nome}, obrigado pela confiança! 💙\n\nQualquer coisa que precisar, é só chamar por aqui.",
          },
          "Agradece na hora",
        ),
      );

      nodes.push(no("pv-etq", "adicionar_etiqueta", "acao", { etiquetaNome: "Cliente" }));
      edges.push(aresta("pv-obrigado", "pv-etq"));

      // Espera de tempo puro, sem `tempoMaximo`: aqui não interessa se a pessoa respondeu ou não,
      // interessa a data. Uma espera com dois caminhos só complicaria o desenho.
      nodes.push(
        no("pv-espera-7", "aguardar", "espera", { modo: "dias", valor: 7, somenteExpediente: true }, "Espera 7 dias"),
      );
      edges.push(aresta("pv-etq", "pv-espera-7"));

      nodes.push(
        no("pv-avaliacao", "mensagem_texto", "mensagem", {
          canal: "whatsapp",
          texto:
            "Oi {primeiro_nome}! Uma semana depois: como está sendo a experiência?\n\nSe puder deixar uma avaliação rápida, ajuda demais: (cole aqui o link da avaliação)",
        }),
      );
      edges.push(aresta("pv-espera-7", "pv-avaliacao"));

      nodes.push(
        no("pv-espera-30", "aguardar", "espera", { modo: "dias", valor: 23, somenteExpediente: true }, "Espera até um mês"),
      );
      edges.push(aresta("pv-avaliacao", "pv-espera-30"));

      nodes.push(
        no("pv-indicacao", "mensagem_texto", "mensagem", {
          canal: "whatsapp",
          texto:
            "{primeiro_nome}, um mês já! 💙\n\nConhece alguém que também precisaria disso? Se quiser, me passa o contato que eu falo com carinho, igual falei com você.",
        }),
      );
      edges.push(aresta("pv-espera-30", "pv-indicacao"));

      nodes.push(
        no("pv-tarefa", "criar_tarefa", "acao", {
          titulo: "Conferir satisfação do cliente e pedir indicação",
          modoResponsavel: "atual",
          modoPrazo: "imediatamente",
          prioridade: "normal",
          relacionarA: "contato",
        }),
      );
      edges.push(aresta("pv-indicacao", "pv-tarefa"));

      nodes.push(
        no("pv-fim", "encerrar_fluxo", "fim", {
          motivo: "concluido",
          observacao: "Pós-venda concluído.",
        }),
      );
      edges.push(aresta("pv-tarefa", "pv-fim"));

      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 6 ----- */
  {
    id: "lead-parado-reativacao",
    nome: "Lead parado, tentativa de reativação",
    descricao:
      "Depois de alguns dias parado na etapa sem trocar mensagem, o lead recebe uma tentativa de retomada. Quem voltar a falar cai no time; quem não voltar fica marcado e vira decisão de alguém.",
    ajustar: "Troque o texto e o tempo de parado, hoje em três dias.",
    ondeCostumaViver: "Qualquer etapa do meio do funil",
    // O gatilho é um bloco no canvas, não a etapa: passar tempo parado não é um evento da etapa, é
    // uma varredura por tempo, e ela precisa do bloco pra existir.
    quandoSugerido: null,
    construir: (ctx) => {
      const nodes: FlowNode[] = [];
      const edges: FlowEdge[] = [];

      nodes.push(
        no(
          "lp-gatilho",
          "lead_parado_etapa",
          "gatilho",
          { funilId: ctx.funilId, etapaId: ctx.etapaId, tempoValor: 3, tempoUnidade: "dias" },
          `Parado 3 dias em "${tituloDaEtapa(ctx)}"`,
        ),
      );

      nodes.push(
        no("lp-msg", "mensagem_texto", "mensagem", {
          canal: "whatsapp",
          texto:
            "Oi {primeiro_nome}! Faz uns dias que a gente não fala 🙂\n\nIsso que conversamos ainda faz sentido pra você? Pode responder com um sim ou um não, eu entendo os dois.",
        }),
      );
      edges.push(aresta("lp-gatilho", "lp-msg"));

      nodes.push(espera("lp-espera", 2, "dias", "Espera a resposta (2 dias)"));
      edges.push(aresta("lp-msg", "lp-espera"));

      nodes.push(no("lp-etq-voltou", "adicionar_etiqueta", "acao", { etiquetaNome: "Reativado" }));
      edges.push(aresta("lp-espera", "lp-etq-voltou", "ok"));

      nodes.push(no("lp-humano", "encaminhar_humano", "humano", {}, "Passa pro vendedor"));
      edges.push(aresta("lp-etq-voltou", "lp-humano"));

      nodes.push(
        no("lp-fim-ok", "encerrar_fluxo", "fim", {
          motivo: "transferido",
          observacao: "Lead voltou a responder.",
        }),
      );
      edges.push(aresta("lp-humano", "lp-fim-ok"));

      nodes.push(no("lp-etq-frio", "adicionar_etiqueta", "acao", { etiquetaNome: "Esfriou" }));
      edges.push(aresta("lp-espera", "lp-etq-frio", "timeout"));

      nodes.push(
        no("lp-tarefa", "criar_tarefa", "acao", {
          titulo: "Decidir: seguir insistindo ou marcar como perdido",
          modoResponsavel: "atual",
          modoPrazo: "depois_de",
          prazoValor: 2,
          prazoUnidade: "dias",
          prioridade: "normal",
          relacionarA: "ambos",
        }),
      );
      edges.push(aresta("lp-etq-frio", "lp-tarefa"));

      nodes.push(
        no("lp-fim-frio", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Não voltou a responder depois da reativação.",
        }),
      );
      edges.push(aresta("lp-tarefa", "lp-fim-frio"));

      return montar(nodes, edges);
    },
  },
];
