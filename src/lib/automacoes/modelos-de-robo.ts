import { layoutFluxo } from "@/lib/automation-flow/migracao";
import type {
  ConfiguracoesFluxo,
  FlowEdge,
  FlowNode,
  FlowNodeCategory,
  FlowNodeType,
} from "@/lib/automation-flow/types";
import type { CanalId } from "@/lib/canais/capacidades";

/**
 * A GALERIA DE MODELOS DE ROBÔ — o "Criar um bot" com os fluxos prontos.
 *
 * "Recriar o pop-up 'Criar um bot' do Kommo no meu CRM, incluindo a galeria de modelos prontos."
 *
 * O canvas em branco é honesto e é uma parede. Quem abre o editor pela primeira vez não sabe que
 * "manda o menu, espera cinco minutos, cobra quem não respondeu e avisa a equipe" é possível — e
 * muito menos por onde começar. O modelo responde as duas coisas de uma vez: mostra o que dá pra
 * fazer e já entrega feito.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O QUE ENTROU, E O QUE NÃO ENTROU E POR QUÊ.
 *
 * A referência tem 29 modelos. Nove deles são de canais que este CRM NÃO TEM: oito de TikTok e um
 * de transmissões do Messenger (`CANAIS_DA_AREA` em `canais/capacidades.ts`: WhatsApp oficial,
 * WhatsApp QR Code, Instagram e e-mail — não há TikTok, Telegram, Messenger nem chat ao vivo).
 *
 * Esses nove ficaram de fora, e isto é a mesma regra que o resto do módulo já segue: um modelo que
 * a galeria oferece e o motor nunca executa é pior do que não ter o modelo, porque a pessoa monta
 * a automação, publica, e fica esperando. Oferecer "Responda aos comentários do TikTok" numa conta
 * sem TikTok é vender um botão que não liga em lugar nenhum.
 *
 * Os outros vinte estão aqui, com os textos da referência e usando SÓ bloco que existe e que o
 * motor executa.
 */

export type CategoriaDeModelo = "gerar_leads" | "informacoes" | "engajar" | "reduzir_retrabalho";

export const CATEGORIAS: { valor: CategoriaDeModelo; label: string }[] = [
  { valor: "gerar_leads", label: "Gerar leads" },
  { valor: "informacoes", label: "Informações comerciais" },
  { valor: "engajar", label: "Engajar leads" },
  { valor: "reduzir_retrabalho", label: "Reduzir retrabalho" },
];

/**
 * A ILUSTRAÇÃO DO CARTÃO, descrita como DADO e não desenhada uma a uma.
 *
 * Vinte ilustrações à mão seriam vinte arquivos pra manter e vinte chances de uma delas ficar
 * diferente das outras. Aqui cada cartão diz a cor de fundo, as bolhas de conversa que aparecem e
 * um selo opcional — e um componente só desenha todos. É o que mantém a galeria parecendo uma
 * galeria, e não vinte desenhos que por acaso estão na mesma tela.
 */
export type IlustracaoDoModelo = {
  /** Uma das cinco pastéis da referência. */
  fundo: "verde" | "rosa" | "laranja" | "lilas" | "azul";
  /** As bolhas, de cima pra baixo. `eu` é a bolha escura (a marca); `ele` é a clara (o lead). */
  bolhas: { texto: string; de: "eu" | "ele" }[];
  /** As pílulas de resposta rápida desenhadas embaixo da última bolha. */
  botoes?: string[];
  /** O selo do canto, pra modelo que começa por palavra-chave. */
  selo?: string;
  /** O emoji grande do canto, que é o que dá a cara do cartão de relance. */
  emoji?: string;
};

export type ModeloDeRobo = {
  id: string;
  nome: string;
  /** O que ele faz, na frase que alguém diria em voz alta. Vira o título do cartão no editor. */
  objetivo: string;
  categorias: CategoriaDeModelo[];
  /** Em quais canais deste CRM ele funciona. Vazio nunca: modelo sem canal não aparece. */
  canais: CanalId[];
  ilustracao: IlustracaoDoModelo;
  construir: () => { nodes: FlowNode[]; edges: FlowEdge[]; configuracoes: ConfiguracoesFluxo };
};

/* ------------------------------------------------------------------ ajuda -- */

function no<T>(id: string, type: FlowNodeType, category: FlowNodeCategory, data: T, titulo?: string): FlowNode<T> {
  return { id, type, category, position: { x: 0, y: 0 }, titulo, data };
}

function aresta(source: string, target: string, sourceHandle?: string): FlowEdge {
  return { id: `${source}->${target}${sourceHandle ? `:${sourceHandle}` : ""}`, source, target, sourceHandle };
}

/**
 * `naoIniciarSeJaNoFluxo` em todos: o lead que entra duas vezes no mesmo dia — e isso acontece o
 * tempo todo num funil arrastado à mão — receberia a sequência inteira de novo.
 */
function configuracoesPadrao(): ConfiguracoesFluxo {
  return { motorNovo: true, naoIniciarSeJaNoFluxo: true };
}

function montar(nodes: FlowNode[], edges: FlowEdge[]) {
  // As posições saem do layout automático: um modelo com x/y escritos à mão envelhece no dia em
  // que um bloco muda de altura, e aí nasce torto.
  layoutFluxo(nodes, edges);
  return { nodes, edges, configuracoes: configuracoesPadrao() };
}

/** Mensagem simples. `canal: null` = sai pelo canal da conversa, que é o certo pra quase tudo. */
function msg(id: string, texto: string, titulo?: string) {
  return no(id, "mensagem_texto", "mensagem", { canal: null, texto }, titulo);
}

/** Mensagem com botões de resposta rápida. Cada opção vira uma saída do bloco. */
function botoes(id: string, texto: string, opcoes: { id: string; rotulo: string }[], titulo?: string) {
  return no(
    id,
    "mensagem_botoes",
    "mensagem",
    { canal: null, texto, opcoes, formatoResposta: "botoes", esperaMinutos: 1440 },
    titulo,
  );
}

/** O fim de um caminho. Todo ramo termina num, como na referência ("Parar robô"). */
function fim(id: string, titulo = "Parar robô") {
  return no(id, "encerrar_fluxo", "fim", {}, titulo);
}

/** Pausa de relógio puro. */
function pausa(id: string, minutos: number, titulo?: string) {
  return no(id, "aguardar", "espera", { modo: "minutos", valor: minutos }, titulo);
}

/** Pausa que termina quando a pessoa responde — o "até a mensagem recebida" da referência. */
function pausaAteResponder(id: string, titulo?: string) {
  return no(id, "aguardar", "espera", { modo: "ate_resposta", tempoMaximo: { valor: 1, unidade: "dias" } }, titulo);
}

/** Condição de uma regra só, que é o formato de quase toda verificação de palavra-chave. */
function condicao(
  id: string,
  campo: string,
  operador: string,
  valor: string,
  titulo?: string,
) {
  return no(
    id,
    "condicao_grupo",
    "condicao",
    {
      grupo: {
        id: `${id}-g`,
        tipo: "E",
        regras: [{ id: `${id}-r`, campo, operador, valor, fonteValor: "manual" }],
        subgrupos: [],
      },
    },
    titulo,
  );
}


/** Etiqueta no contato. */
function etiqueta(id: string, nome: string, titulo?: string) {
  return no(id, "adicionar_etiqueta", "acao", { etiquetaNome: nome }, titulo);
}

/** Aviso interno pra equipe — o "Enviar mensagem interna" da referência. */
function avisoInterno(id: string, mensagem: string, titulo?: string) {
  return no(id, "notificacao_interna", "mensagem", { mensagem }, titulo);
}

/* ------------------------------------------------------------- os modelos -- */

const TODOS_OS_CANAIS: CanalId[] = ["whatsapp_oficial", "whatsapp_qrcode", "instagram"];
const SO_WHATSAPP: CanalId[] = ["whatsapp_oficial", "whatsapp_qrcode"];
const SO_INSTAGRAM: CanalId[] = ["instagram"];

export const MODELOS_DE_ROBO: ModeloDeRobo[] = [
  /* ------------------------------------------------------------------ 1 --- */
  {
    id: "bot-de-boas-vindas",
    nome: "Bot de boas-vindas",
    objetivo: "Menu inicial com três caminhos e uma cobrança automática pra quem não responder.",
    categorias: ["informacoes"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "verde",
      bolhas: [{ texto: "No que te ajudo?", de: "eu" }],
      botoes: ["Dúvida sobre produto", "Ajuda com pedido"],
      emoji: "👋",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "bv-menu",
          "Olá! Como podemos ajudar?",
          [
            { id: "bv-produto", rotulo: "Dúvida sobre produto" },
            { id: "bv-pedido", rotulo: "Ajuda com pedido" },
            { id: "bv-equipe", rotulo: "Fale conosco" },
          ],
          "Menu de boas-vindas",
        ),
        msg("bv-r-produto", "Em qual produto você tem interesse?"),
        msg("bv-r-pedido", "Por favor, compartilhe o número do pedido e faça sua pergunta. 🛒"),
        msg(
          "bv-r-equipe",
          "Um membro da nossa equipe está vindo. 🤝 Enquanto você espera, conta pra gente como podemos ajudar.",
        ),
        msg("bv-r-outra", "Um membro da nossa equipe está vindo. 🤝"),
        pausa("bv-espera", 5, "Espera 5 minutos"),
        msg("bv-r-silencio", "Ainda estamos aqui se precisar de alguma coisa! 🌟"),
        fim("bv-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("bv-menu", "bv-r-produto", "bv-produto"),
        aresta("bv-menu", "bv-r-pedido", "bv-pedido"),
        aresta("bv-menu", "bv-r-equipe", "bv-equipe"),
        aresta("bv-menu", "bv-r-outra", "outra"),
        aresta("bv-menu", "bv-espera", "timeout"),
        aresta("bv-espera", "bv-r-silencio"),
        aresta("bv-r-produto", "bv-fim"),
        aresta("bv-r-pedido", "bv-fim"),
        aresta("bv-r-equipe", "bv-fim"),
        aresta("bv-r-outra", "bv-fim"),
        aresta("bv-r-silencio", "bv-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ------------------------------------------------------------------ 2 --- */
  {
    id: "confirme-agendamentos",
    nome: "Confirme agendamentos",
    objetivo: "Lembrete do horário com confirmar, reagendar ou cancelar — e aviso pra equipe.",
    categorias: ["informacoes"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "rosa",
      bolhas: [{ texto: "Você ainda vem amanhã?", de: "eu" }],
      botoes: ["Confirmar", "Reagendar"],
      emoji: "⏰",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "ca-lembrete",
          "Oi! Apenas um lembrete amigável de que o seu horário agendado está chegando. Por favor, confirme sua presença. Se você não puder comparecer, pode reagendar ou cancelar.",
          [
            { id: "ca-confirmar", rotulo: "Confirmar" },
            { id: "ca-reagendar", rotulo: "Reagendar" },
            { id: "ca-cancelar", rotulo: "Cancelar" },
          ],
          "Lembrete do agendamento",
        ),
        msg("ca-r-confirmou", "Ótimo! Estamos animados para te receber."),
        msg("ca-r-reagendar", "Para quando você gostaria de reagendar?"),
        avisoInterno("ca-aviso-reagendar", "Deseja reagendar", "Avisa quem atende"),
        msg("ca-r-cancelar", "Seu agendamento foi cancelado. Sinta-se à vontade para nos dizer o motivo."),
        avisoInterno("ca-aviso-cancelar", "Agendamento cancelado", "Avisa a equipe"),
        msg("ca-r-outra", "Um membro da nossa equipe está vindo. 🤝"),
        pausa("ca-espera", 5, "Espera 5 minutos"),
        msg(
          "ca-cobranca",
          "Avisa pra gente se vai poder comparecer. 🌟 Você também pode reagendar ou cancelar se não conseguir neste horário.",
        ),
        pausaAteResponder("ca-espera2", "Espera a resposta"),
        msg("ca-r-equipe", "Um membro da nossa equipe está vindo. 🤝"),
        fim("ca-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("ca-lembrete", "ca-r-confirmou", "ca-confirmar"),
        aresta("ca-lembrete", "ca-r-reagendar", "ca-reagendar"),
        aresta("ca-lembrete", "ca-r-cancelar", "ca-cancelar"),
        aresta("ca-lembrete", "ca-r-outra", "outra"),
        aresta("ca-lembrete", "ca-espera", "timeout"),
        aresta("ca-r-reagendar", "ca-aviso-reagendar"),
        aresta("ca-r-cancelar", "ca-aviso-cancelar"),
        aresta("ca-espera", "ca-cobranca"),
        aresta("ca-cobranca", "ca-espera2"),
        aresta("ca-espera2", "ca-r-equipe"),
        aresta("ca-r-confirmou", "ca-fim"),
        aresta("ca-aviso-reagendar", "ca-fim"),
        aresta("ca-aviso-cancelar", "ca-fim"),
        aresta("ca-r-outra", "ca-fim"),
        aresta("ca-r-equipe", "ca-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ------------------------------------------------------------------ 3 --- */
  {
    id: "receba-agendamentos",
    nome: "Receba agendamentos",
    objetivo: "Separa quem já é paciente de quem é a primeira vez, e coleta e-mail e preferência de horário.",
    categorias: ["gerar_leads"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "laranja",
      bolhas: [{ texto: "Você já veio aqui?", de: "eu" }],
      botoes: ["Sim", "Não, primeira vez"],
      emoji: "✅",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "ra-pergunta",
          "Oi! Você já marcou um horário com a gente antes?",
          [
            { id: "ra-sim", rotulo: "Sim" },
            { id: "ra-nao", rotulo: "Não, primeira vez" },
          ],
          "Já é paciente?",
        ),
        etiqueta("ra-etq", "Confirmação de agendamento", "Marca o lead"),
        msg("ra-quando", "Para quando você gostaria de agendar seu próximo horário?"),
        pausaAteResponder("ra-espera-quando", "Espera a resposta"),
        msg("ra-ok", "Ok, ótimo! Um membro da nossa equipe entrará em contato em breve."),
        msg("ra-email", "Ótimo! Você pode enviar seu email para gente poder agendar o horário? ✉️"),
        pausaAteResponder("ra-espera-email", "Espera o e-mail"),
        condicao("ra-valida", "mensagem", "contem", "@", "O que veio parece um e-mail?"),
        no("ra-grava", "atualizar_campo", "acao", { campoNome: "email", valor: "{mensagem}" }, "Grava o e-mail"),
        msg("ra-quando2", "Obrigado! Para quando você gostaria de agendar sua consulta?"),
        pausaAteResponder("ra-espera-quando2", "Espera a resposta"),
        msg("ra-ok2", "Um membro da nossa equipe entrará em contato em breve."),
        msg("ra-humano", "Um membro da nossa equipe está vindo. 🤝"),
        msg("ra-r-outra", "Um membro da nossa equipe está vindo. 🤝"),
        pausa("ra-espera-silencio", 5, "Espera 5 minutos"),
        msg("ra-silencio", "Ainda estamos aqui se precisar de alguma coisa! 🌟"),
        fim("ra-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("ra-pergunta", "ra-etq", "ra-sim"),
        aresta("ra-etq", "ra-quando"),
        aresta("ra-quando", "ra-espera-quando"),
        aresta("ra-espera-quando", "ra-ok"),
        aresta("ra-pergunta", "ra-email", "ra-nao"),
        aresta("ra-email", "ra-espera-email"),
        aresta("ra-espera-email", "ra-valida"),
        aresta("ra-valida", "ra-grava", "sim"),
        aresta("ra-grava", "ra-quando2"),
        aresta("ra-quando2", "ra-espera-quando2"),
        aresta("ra-espera-quando2", "ra-ok2"),
        aresta("ra-valida", "ra-humano", "nao"),
        aresta("ra-pergunta", "ra-r-outra", "outra"),
        aresta("ra-pergunta", "ra-espera-silencio", "timeout"),
        aresta("ra-espera-silencio", "ra-silencio"),
        aresta("ra-ok", "ra-fim"),
        aresta("ra-ok2", "ra-fim"),
        aresta("ra-humano", "ra-fim"),
        aresta("ra-r-outra", "ra-fim"),
        aresta("ra-silencio", "ra-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ------------------------------------------------------------------ 4 --- */
  {
    id: "capture-leads-que-querem-chamada",
    nome: "Capture leads que desejam uma chamada",
    objetivo: "Palavra-chave abre a escolha entre ligar agora (coleta o telefone) ou agendar — e cria a tarefa.",
    categorias: ["gerar_leads"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "verde",
      bolhas: [
        { texto: "Qual seu número de telefone?", de: "eu" },
        { texto: "+55 11 3363-2895", de: "ele" },
      ],
      selo: "VAMOSCONVERSAR",
      emoji: "📞",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        condicao("cc-chave", "mensagem", "contem", "VAMOSCONVERSAR", "Palavra-chave"),
        botoes(
          "cc-quando",
          "Olá, agradecemos o interesse! 🙌 Quando você quer conversar?",
          [
            { id: "cc-ja", rotulo: "📲 Fazer ligação JÁ" },
            { id: "cc-agendar", rotulo: "📅 Agendar ligação" },
          ],
          "Agora ou depois?",
        ),
        msg("cc-pede-fone", "📞 Ok, qual o seu número de telefone?"),
        pausaAteResponder("cc-espera-fone", "Espera o telefone"),
        condicao("cc-valida", "mensagem", "contem", "9", "Parece um telefone?"),
        msg("cc-ok", "Entendido, ligaremos para você em breve!"),
        no(
          "cc-tarefa",
          "criar_tarefa",
          "acao",
          { titulo: "Ligar para cliente", prazo: "hoje", tipo: "Acompanhar" },
          "Tarefa: ligar",
        ),
        msg("cc-erro", "Algo não parece certo... por favor, tente digitar seu número novamente."),
        msg("cc-link", "📅 Agende uma reunião comigo aqui: www.link.com"),
        no(
          "cc-tarefa2",
          "criar_tarefa",
          "acao",
          { titulo: "Checar se a ligação foi agendada", prazo: "hoje", tipo: "Acompanhar" },
          "Tarefa: checar",
        ),
        fim("cc-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("cc-chave", "cc-quando", "sim"),
        aresta("cc-quando", "cc-pede-fone", "cc-ja"),
        aresta("cc-pede-fone", "cc-espera-fone"),
        aresta("cc-espera-fone", "cc-valida"),
        aresta("cc-valida", "cc-ok", "sim"),
        aresta("cc-ok", "cc-tarefa"),
        aresta("cc-valida", "cc-erro", "nao"),
        aresta("cc-erro", "cc-espera-fone"),
        aresta("cc-quando", "cc-link", "cc-agendar"),
        aresta("cc-link", "cc-tarefa2"),
        aresta("cc-tarefa", "cc-fim"),
        aresta("cc-tarefa2", "cc-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ------------------------------------------------------------------ 5 --- */
  {
    id: "promo-para-mencao-em-story",
    nome: "Compartilhe códigos promocionais para menções em story",
    objetivo: "Quem menciona a marca no story recebe o cupom e o link do site.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    ilustracao: {
      fundo: "laranja",
      bolhas: [{ texto: "Use PROMOCOD20 👇", de: "eu" }],
      selo: "STORY",
      emoji: "📸",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        msg(
          "ms-cupom",
          "Obrigado por nos mencionar no seu story! 🙌 Use este código promocional para obter 20% de desconto no seu primeiro pedido: PROMOCOD20. Acesse nosso site e aproveite agora 👇\n\nhttps://www.seusite.com",
          "Cupom e link",
        ),
        fim("ms-fim"),
      ];
      return montar(nodes, [aresta("ms-cupom", "ms-fim")]);
    },
  },

  /* ------------------------------------------------------------------ 6 --- */
  {
    id: "palavra-chave-nos-comentarios",
    nome: "Responda a palavras-chave nos comentários",
    objetivo: "Comentário com a palavra-chave ganha resposta pública e o cupom vai no Direct.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    ilustracao: {
      fundo: "lilas",
      bolhas: [
        { texto: "QUERODESCONTO", de: "ele" },
        { texto: "Seu código: PROMOCOD20", de: "eu" },
      ],
      selo: "COMENTÁRIO",
      emoji: "💬",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        condicao("pc-chave", "comentario", "igual", "TERDESCONTO", "Palavra-chave no comentário"),
        no(
          "pc-responde",
          "responder_comentario_instagram",
          "acao",
          { texto: "Por favor, cheque suas DMs! 😉" },
          "Responde o comentário",
        ),
        msg("pc-dm", "Oi {primeiro_nome}! Consiga 20% de desconto na sua próxima compra ➡️ PROMOCOD20", "Manda no Direct"),
        fim("pc-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("pc-chave", "pc-responde", "sim"),
        aresta("pc-responde", "pc-dm"),
        aresta("pc-dm", "pc-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ------------------------------------------------------------------ 7 --- */
  {
    id: "reaja-a-mencao-em-story",
    nome: "Reaja às menções em stories com um coração e mensagem",
    objetivo: "Curte a menção no story e agradece por Direct.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    ilustracao: {
      fundo: "azul",
      bolhas: [{ texto: "Agradecemos! 🥰", de: "eu" }],
      selo: "MENÇÃO",
      emoji: "❤️",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        no("rm-coracao", "reagir_mensagem", "mensagem", { emoji: "❤️" }, "Reage com ❤️"),
        msg("rm-obrigado", "Agradecemos pela sua mensagem! Seu apoio significa muito 🥰"),
        fim("rm-fim"),
      ];
      return montar(nodes, [aresta("rm-coracao", "rm-obrigado"), aresta("rm-obrigado", "rm-fim")]);
    },
  },

  /* ------------------------------------------------------------------ 8 --- */
  {
    id: "recompensa-para-seguidores",
    nome: "Compartilhe recompensas exclusivas com seguidores",
    objetivo: "Comentário com a palavra-chave pede que a pessoa siga, e aí entrega o material.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    ilustracao: {
      fundo: "rosa",
      bolhas: [
        { texto: "BRINDE", de: "ele" },
        { texto: "Seu guia gratuito 👇", de: "eu" },
      ],
      selo: "SEGUIDORES",
      emoji: "🎁",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        condicao("rs-chave", "comentario", "igual", "BRINDE", "Palavra-chave no comentário"),
        botoes(
          "rs-pede",
          "Oi! Obrigado pelo interesse no meu guia 🥰 Eu compartilho ele exclusivamente com os meus seguidores, então certifique-se de me seguir, e eu te enviarei via DM!",
          [{ id: "rs-segui", rotulo: "Estou te seguindo ✅" }],
          "Pede pra seguir",
        ),
        msg(
          "rs-entrega",
          "Ihu! Que felicidade ter você como seguidor 🥰 Como um agradecimento especial, aqui está o acesso exclusivo ao meu guia 👇\n\nhttps://www.seulink.com",
          "Entrega o guia",
        ),
        fim("rs-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("rs-chave", "rs-pede", "sim"),
        aresta("rs-pede", "rs-entrega", "rs-segui"),
        aresta("rs-entrega", "rs-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ------------------------------------------------------------------ 9 --- */
  {
    id: "email-promocional-agendado",
    nome: "Agende mensagens promocionais sobre eventos e ofertas",
    objetivo: "Dispara um e-mail promocional pra quem está na etapa.",
    categorias: ["reduzir_retrabalho"],
    canais: ["email"],
    ilustracao: {
      fundo: "laranja",
      bolhas: [{ texto: "Você vai amar isto!", de: "eu" }],
      selo: "E-MAIL",
      emoji: "🔔",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        no(
          "ep-email",
          "mensagem_email",
          "mensagem",
          { assunto: "Uma novidade que você vai gostar", texto: "Oi {primeiro_nome},\n\nEscreva aqui a sua oferta.\n\nAté breve!" },
          "E-mail promocional",
        ),
        fim("ep-fim"),
      ];
      return montar(nodes, [aresta("ep-email", "ep-fim")]);
    },
  },

  /* ----------------------------------------------------------------- 10 --- */
  {
    id: "cupom-por-palavra-chave",
    nome: "Envie códigos promocionais com base em palavras-chave",
    objetivo: "A palavra-chave combinada devolve o cupom na hora.",
    categorias: ["gerar_leads"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "laranja",
      bolhas: [
        { texto: "DESCONTO", de: "ele" },
        { texto: "Quer um desconto?", de: "eu" },
      ],
      selo: "DESCONTO",
      emoji: "🛍️",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        condicao("cv-chave", "mensagem", "contem", "DESCONTO", "Palavra-chave"),
        msg("cv-cupom", "Aqui está o seu código de 20% de desconto: PROMOCOD20 🎉 Aproveite na sua próxima compra!"),
        fim("cv-fim"),
      ];
      return montar(nodes, [aresta("cv-chave", "cv-cupom", "sim"), aresta("cv-cupom", "cv-fim")]);
    },
  },

  /* ----------------------------------------------------------------- 11 --- */
  {
    id: "cumprimente-com-menu",
    nome: "Cumprimente leads com uma mensagem personalizada",
    objetivo: "Menu principal com catálogo, contato e mais opções — e volta ao menu em todos os caminhos.",
    categorias: ["informacoes"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "lilas",
      bolhas: [{ texto: "Muito bom ter você aqui!", de: "eu" }],
      botoes: ["Ver catálogo 📖", "Entrar em contato ✉️"],
      emoji: "👻",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        /*
         * A SAUDAÇÃO É UM BLOCO À PARTE, e isso não é enfeite: é o que faz o robô ter começo.
         *
         * O motor acha o início pelo único bloco em que NINGUÉM entra. Os três "Menu principal"
         * voltam pro menu — é o laço que faz um menu ser um menu —, e com o menu sendo também o
         * primeiro bloco ele passava a ter entrada. Aí não sobrava nenhum bloco sem entrada, o
         * motor não tinha por onde começar e o robô simplesmente não rodava.
         *
         * Com a saudação na frente, ela é o começo e o laço volta pro menu, que é o lugar certo
         * pra voltar de qualquer jeito: quem já foi cumprimentado não precisa ser de novo.
         */
        msg("cm-ola", "Oi! 😊 Que bom ter você aqui!", "Saudação"),
        botoes(
          "cm-menu",
          "O que você quer fazer hoje?",
          [
            { id: "cm-catalogo", rotulo: "Ver catálogo 📖" },
            { id: "cm-contato", rotulo: "Entrar em contato ✉️" },
            { id: "cm-mais", rotulo: "Mais opções" },
          ],
          "Menu principal",
        ),
        msg("cm-r-catalogo", "Confira nosso catálogo mais recente aqui: 👇\n\nhttps://www.seusite.com"),
        botoes(
          "cm-r-contato",
          "Estamos abertos de segunda a sexta, das 8h às 18h. Você pode entrar em contato conosco em:\n📞 (00) 0000-0000\n✉️ contato@exemplo.com\n\nSe você quiser nos visitar pessoalmente, estamos na Rua, Número 100, Cidade. 🚶",
          [{ id: "cm-voltar1", rotulo: "Menu principal" }],
          "Contato",
        ),
        botoes(
          "cm-r-mais",
          "Por favor, escolha uma opção ou faça uma pergunta pra gente.",
          [
            { id: "cm-faq", rotulo: "Ler FAQs 🙋" },
            { id: "cm-voltar2", rotulo: "Menu principal" },
          ],
          "Mais opções",
        ),
        botoes(
          "cm-r-faq",
          "Procurando respostas rápidas? Confira nossas FAQs:\n1. Pergunta 1? — Resposta\n2. Pergunta 2? — Resposta\n3. Pergunta 3? — Resposta",
          [{ id: "cm-voltar3", rotulo: "Menu principal" }],
          "FAQs",
        ),
        fim("cm-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("cm-ola", "cm-menu"),
        aresta("cm-menu", "cm-r-catalogo", "cm-catalogo"),
        aresta("cm-menu", "cm-r-contato", "cm-contato"),
        aresta("cm-menu", "cm-r-mais", "cm-mais"),
        /* Os três "Menu principal" voltam pro mesmo bloco: é o laço que a referência desenha, e é
           o que faz o menu ser um menu em vez de três becos sem saída. */
        aresta("cm-r-contato", "cm-menu", "cm-voltar1"),
        aresta("cm-r-mais", "cm-menu", "cm-voltar2"),
        aresta("cm-r-mais", "cm-r-faq", "cm-faq"),
        aresta("cm-r-faq", "cm-menu", "cm-voltar3"),
        aresta("cm-r-catalogo", "cm-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 12 --- */
  {
    id: "inscricoes-para-webinar",
    nome: "Colete inscrições para webinars",
    objetivo: "Palavra-chave coleta e-mail e telefone, manda o link e marca a etiqueta de inscrito.",
    categorias: ["engajar"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "lilas",
      bolhas: [
        { texto: "email@endereco.com", de: "ele" },
        { texto: "Reservamos seu lugar!", de: "eu" },
      ],
      selo: "WEBINAR",
      emoji: "✉️",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        condicao("wb-chave", "mensagem", "contem", "WEBINAR", "Palavra-chave"),
        msg("wb-email", "Oi, {primeiro_nome}! Vamos te registrar! É só digitar seu endereço de email 📧 e pronto 👍"),
        pausaAteResponder("wb-espera-email", "Espera o e-mail"),
        msg("wb-fone", "Perfeito! Vou te enviar o link 1 hora antes do webinário. 📞 Qual o seu número de telefone?"),
        pausaAteResponder("wb-espera-fone", "Espera o telefone"),
        msg(
          "wb-link",
          "Ótimo! Seu lugar está reservado. Lembre-se de trazer suas perguntas para a sessão de Q&A no final.\n\nAqui está o link: https://www.seulink.com\n\nNos vemos em breve! 🎉",
        ),
        etiqueta("wb-etq", "Registrado no webinar", "Marca como inscrito"),
        fim("wb-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("wb-chave", "wb-email", "sim"),
        aresta("wb-email", "wb-espera-email"),
        aresta("wb-espera-email", "wb-fone"),
        aresta("wb-fone", "wb-espera-fone"),
        aresta("wb-espera-fone", "wb-link"),
        aresta("wb-link", "wb-etq"),
        aresta("wb-etq", "wb-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 13 --- */
  {
    id: "brinde-por-palavra-chave",
    nome: "Envie brindes com base em palavras-chave",
    objetivo: "A palavra-chave confirma o interesse e entrega o link do material.",
    categorias: ["gerar_leads"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "azul",
      bolhas: [
        { texto: "GUIAGRATIS", de: "ele" },
        { texto: "Veio pelo guia grátis!", de: "eu" },
      ],
      selo: "GUIAGRATIS",
      emoji: "🎁",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        condicao("bg-chave", "mensagem", "igual", "GUIAGRATIS", "Palavra-chave"),
        botoes(
          "bg-confirma",
          "Parece que você está aqui pelo guia gratuito! 😇",
          [{ id: "bg-quero", rotulo: "Ebaa!! 🙌" }],
          "Confirma",
        ),
        msg("bg-entrega", "Prontinho! 🎁\n\nhttps://www.seulink.com"),
        fim("bg-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("bg-chave", "bg-confirma", "sim"),
        aresta("bg-confirma", "bg-entrega", "bg-quero"),
        aresta("bg-entrega", "bg-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 14 --- */
  {
    id: "encaminhe-para-especialista",
    nome: "Encaminhe solicitações para os especialistas certos",
    objetivo: "Triagem por botão e troca do responsável do lead.",
    categorias: ["reduzir_retrabalho"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "rosa",
      bolhas: [{ texto: "Como podemos te ajudar?", de: "eu" }],
      botoes: ["Produto", "Faturamento"],
      emoji: "✅",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "ee-triagem",
          "Olá! Como podemos te ajudar? Vou te colocar em contato com a pessoa certa.",
          [
            { id: "ee-produto", rotulo: "Pergunta sobre o produto" },
            { id: "ee-faturamento", rotulo: "Pergunta sobre faturamento" },
            { id: "ee-outra", rotulo: "Outra coisa" },
          ],
          "Triagem",
        ),
        no("ee-resp-produto", "alterar_responsavel", "acao", { responsavel: "" }, "Responsável de produto"),
        no("ee-resp-fatur", "alterar_responsavel", "acao", { responsavel: "" }, "Responsável de faturamento"),
        no("ee-resp-outra", "alterar_responsavel", "acao", { responsavel: "" }, "Responsável geral"),
        msg("ee-pergunta", "Ótimo, qual é a sua pergunta?"),
        msg("ee-ajuda", "Tudo bem, como podemos te ajudar?"),
        fim("ee-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("ee-triagem", "ee-resp-produto", "ee-produto"),
        aresta("ee-triagem", "ee-resp-fatur", "ee-faturamento"),
        aresta("ee-triagem", "ee-resp-outra", "ee-outra"),
        aresta("ee-resp-produto", "ee-pergunta"),
        aresta("ee-resp-fatur", "ee-pergunta"),
        aresta("ee-resp-outra", "ee-ajuda"),
        aresta("ee-pergunta", "ee-fim"),
        aresta("ee-ajuda", "ee-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 15 --- */
  {
    id: "pesquisa-rapida",
    nome: "Saiba mais sobre leads com uma pesquisa rápida",
    objetivo: "Quatro perguntas de botão e um cupom de agradecimento no fim.",
    categorias: ["engajar"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "verde",
      bolhas: [{ texto: "Como ouviu falar da gente?", de: "eu" }],
      botoes: ["Redes sociais", "Boca a boca"],
      emoji: "🔍",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "pr-p1",
          "Olá, {primeiro_nome}! 😊 Gostaríamos muito de ouvir sua opinião! Isso vai nos ajudar a te atender melhor e, como agradecimento, você ganha 10% de desconto no seu próximo pedido. 💸\n\nComo você prefere comprar? 🛒",
          [
            { id: "pr-online", rotulo: "Online 💻" },
            { id: "pr-loja", rotulo: "Na loja 🚶" },
          ],
          "1. Como compra",
        ),
        botoes(
          "pr-p2",
          "O que é mais importante para você ao escolher uma marca?",
          [
            { id: "pr-preco", rotulo: "Preço 💵" },
            { id: "pr-qualidade", rotulo: "Qualidade 🏆" },
            { id: "pr-avaliacoes", rotulo: "Avaliações 📝" },
          ],
          "2. O que importa",
        ),
        botoes(
          "pr-p3",
          "Como você ficou sabendo de nós?",
          [
            { id: "pr-social", rotulo: "Mídias sociais 📢" },
            { id: "pr-boca", rotulo: "Boca a boca 💬" },
            { id: "pr-busca", rotulo: "Pesquisa online 💻" },
          ],
          "3. Como nos achou",
        ),
        botoes(
          "pr-p4",
          "Você nos recomendaria?",
          [
            { id: "pr-sim", rotulo: "Com certeza! 😁" },
            { id: "pr-talvez", rotulo: "Talvez 😐" },
            { id: "pr-nao", rotulo: "Não ☹️" },
          ],
          "4. Recomendaria",
        ),
        msg("pr-cupom", "Agradecemos seu feedback! Aqui está seu código de desconto de 10%: PESQUISA10"),
        msg("pr-porque", "Não está feliz? Conte pra gente o porquê — vamos resolver!"),
        pausaAteResponder("pr-espera", "Espera o motivo"),
        fim("pr-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("pr-p1", "pr-p2", "pr-online"),
        aresta("pr-p1", "pr-p2", "pr-loja"),
        aresta("pr-p2", "pr-p3", "pr-preco"),
        aresta("pr-p2", "pr-p3", "pr-qualidade"),
        aresta("pr-p2", "pr-p3", "pr-avaliacoes"),
        aresta("pr-p3", "pr-p4", "pr-social"),
        aresta("pr-p3", "pr-p4", "pr-boca"),
        aresta("pr-p3", "pr-p4", "pr-busca"),
        aresta("pr-p4", "pr-cupom", "pr-sim"),
        aresta("pr-p4", "pr-cupom", "pr-talvez"),
        aresta("pr-p4", "pr-porque", "pr-nao"),
        aresta("pr-porque", "pr-espera"),
        aresta("pr-espera", "pr-cupom"),
        aresta("pr-cupom", "pr-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 16 --- */
  {
    id: "feedback-com-emojis",
    nome: "Colete feedback com emojis",
    objetivo: "Avaliação do atendimento por emoji, com etiqueta da última reação e aviso interno quando é ruim.",
    categorias: ["engajar", "reduzir_retrabalho"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "azul",
      bolhas: [{ texto: "Como foi nossa ajuda?", de: "eu" }],
      botoes: ["☹️", "😐", "😄"],
      emoji: "😀",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "fe-pergunta",
          "Quão útil foi nossa ajuda hoje?",
          [
            { id: "fe-ruim", rotulo: "☹️" },
            { id: "fe-neutro", rotulo: "😐" },
            { id: "fe-bom", rotulo: "😄" },
          ],
          "Pergunta a nota",
        ),
        etiqueta("fe-etq-ruim", "Última reação: Ruim", "Marca ruim"),
        avisoInterno("fe-aviso", "Nova reação: Ruim", "Avisa a equipe"),
        etiqueta("fe-etq-neutro", "Última reação: Neutra", "Marca neutra"),
        etiqueta("fe-etq-bom", "Última reação: Boa", "Marca boa"),
        msg("fe-obrigado", "Obrigado por compartilhar sua experiência"),
        fim("fe-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("fe-pergunta", "fe-etq-ruim", "fe-ruim"),
        aresta("fe-etq-ruim", "fe-aviso"),
        aresta("fe-aviso", "fe-obrigado"),
        aresta("fe-pergunta", "fe-etq-neutro", "fe-neutro"),
        aresta("fe-etq-neutro", "fe-obrigado"),
        aresta("fe-pergunta", "fe-etq-bom", "fe-bom"),
        aresta("fe-etq-bom", "fe-obrigado"),
        aresta("fe-obrigado", "fe-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 17 --- */
  {
    id: "newsletter-opt-in",
    nome: "Inscreva leads em sua newsletter de email",
    objetivo: "Opt-in com validação do e-mail e gravação no campo do contato.",
    categorias: ["engajar"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "verde",
      bolhas: [
        { texto: "joao@exemplo.com", de: "ele" },
        { texto: "Você foi inscrito!", de: "eu" },
      ],
      selo: "NEWSLETTER",
      emoji: "✔️",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "nl-pergunta",
          "Você deseja se inscrever para receber novidades?",
          [
            { id: "nl-sim", rotulo: "Sim" },
            { id: "nl-nao", rotulo: "Não, obrigado" },
          ],
          "Quer receber?",
        ),
        etiqueta("nl-etq-sim", "opt-in", "Marca opt-in"),
        msg("nl-pede-email", "Perfeito, qual é o seu endereço de email?"),
        pausaAteResponder("nl-espera", "Espera o e-mail"),
        condicao("nl-valida", "mensagem", "contem", "@", "Parece um e-mail?"),
        no("nl-grava", "atualizar_campo", "acao", { campoNome: "email", valor: "{mensagem}" }, "Grava o e-mail"),
        msg("nl-ok", "Muito bem! Você está inscrito ;)"),
        msg("nl-erro", "Tem algo errado com esse endereço de email. Por favor, tente novamente."),
        etiqueta("nl-etq-nao", "opt-out", "Marca opt-out"),
        msg("nl-sem-problema", "Sem problemas :)"),
        pausa("nl-pausa", 1, "Espera 1 minuto"),
        msg("nl-mais", "Podemos te ajudar em algo mais?"),
        fim("nl-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("nl-pergunta", "nl-etq-sim", "nl-sim"),
        aresta("nl-etq-sim", "nl-pede-email"),
        aresta("nl-pede-email", "nl-espera"),
        aresta("nl-espera", "nl-valida"),
        aresta("nl-valida", "nl-grava", "sim"),
        aresta("nl-grava", "nl-ok"),
        aresta("nl-ok", "nl-pausa"),
        aresta("nl-valida", "nl-erro", "nao"),
        aresta("nl-erro", "nl-espera"),
        aresta("nl-pergunta", "nl-etq-nao", "nl-nao"),
        aresta("nl-etq-nao", "nl-sem-problema"),
        aresta("nl-sem-problema", "nl-pausa"),
        aresta("nl-pausa", "nl-mais"),
        aresta("nl-mais", "nl-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 18 --- */
  {
    id: "recado-fora-do-expediente",
    nome: "Receba recados quando estiver offline",
    objetivo: "Resposta automática fora do horário de atendimento.",
    categorias: ["informacoes"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "azul",
      bolhas: [
        { texto: "Olá!", de: "ele" },
        { texto: "Voltaremos às 9h00.", de: "eu" },
      ],
      emoji: "⏱️",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        msg(
          "fo-recado",
          "Oi! 😊 Nossa equipe não está disponível no momento. Estamos aqui de segunda a sexta-feira, das 8h às 18h. 🤓\n\nDeixe um recado e entraremos em contato com você o mais breve possível! 💬",
          "Resposta de fora do horário",
        ),
        fim("fo-fim"),
      ];
      return montar(nodes, [aresta("fo-recado", "fo-fim")]);
    },
  },

  /* ----------------------------------------------------------------- 19 --- */
  {
    id: "qualificar-pedido",
    nome: "Ajude a equipe de vendas a conhecer o lead e suas preferências",
    objetivo: "Coleta o que a pessoa quer comprar, nome, telefone e e-mail, e grava tudo na ficha.",
    categorias: ["gerar_leads"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "azul",
      bolhas: [{ texto: "Fazer pedido 🛒", de: "ele" }],
      selo: "PEDIDO",
      emoji: "🛒",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        botoes(
          "qp-inicio",
          "Olá! Você está querendo fazer um pedido?",
          [
            { id: "qp-sim", rotulo: "Sim, fazer pedido" },
            { id: "qp-outra", rotulo: "Outra coisa" },
          ],
          "É pedido?",
        ),
        msg("qp-ajuda", "Certo, como posso ajudar?"),
        msg("qp-o-que", "Legal! Vamos começar 🤗 Conte pra gente o que você está querendo comprar!"),
        pausaAteResponder("qp-espera-o-que", "Espera a resposta"),
        no("qp-nota", "nota_interna", "acao", { texto: "Quer comprar: {mensagem}" }, "Anota na ficha"),
        msg("qp-nome", "Qual é o seu nome?"),
        pausaAteResponder("qp-espera-nome", "Espera o nome"),
        no("qp-grava-nome", "atualizar_campo", "acao", { campoNome: "nome", valor: "{mensagem}" }, "Grava o nome"),
        msg("qp-fone", "Pode passar seu número de telefone? 📞"),
        pausaAteResponder("qp-espera-fone", "Espera o telefone"),
        no("qp-grava-fone", "atualizar_campo", "acao", { campoNome: "telefone", valor: "{mensagem}" }, "Grava o telefone"),
        msg("qp-email", "Qual é seu endereço de email? ✉️"),
        pausaAteResponder("qp-espera-email", "Espera o e-mail"),
        no("qp-grava-email", "atualizar_campo", "acao", { campoNome: "email", valor: "{mensagem}" }, "Grava o e-mail"),
        msg("qp-fim-msg", "Legal! Entraremos em contato em breve para te ajudar. 🤝"),
        fim("qp-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("qp-inicio", "qp-o-que", "qp-sim"),
        aresta("qp-inicio", "qp-ajuda", "qp-outra"),
        aresta("qp-o-que", "qp-espera-o-que"),
        aresta("qp-espera-o-que", "qp-nota"),
        aresta("qp-nota", "qp-nome"),
        aresta("qp-nome", "qp-espera-nome"),
        aresta("qp-espera-nome", "qp-grava-nome"),
        aresta("qp-grava-nome", "qp-fone"),
        aresta("qp-fone", "qp-espera-fone"),
        aresta("qp-espera-fone", "qp-grava-fone"),
        aresta("qp-grava-fone", "qp-email"),
        aresta("qp-email", "qp-espera-email"),
        aresta("qp-espera-email", "qp-grava-email"),
        aresta("qp-grava-email", "qp-fim-msg"),
        aresta("qp-fim-msg", "qp-fim"),
        aresta("qp-ajuda", "qp-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ----------------------------------------------------------------- 20 --- */
  {
    id: "rodizio-entre-atendentes",
    nome: "Encaminhe conversas para a equipe em rodízio",
    objetivo: "Distribui a conversa entre os atendentes da equipe, um de cada vez.",
    categorias: ["reduzir_retrabalho"],
    canais: TODOS_OS_CANAIS,
    ilustracao: {
      fundo: "lilas",
      bolhas: [{ texto: "Próximo da fila…", de: "eu" }],
      emoji: "🔁",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        /*
         * `encaminhar_equipe` É O RODÍZIO DESTE CRM, e não três blocos de "mudar responsável" em
         * fila como na referência. Ele já distribui entre os membros da equipe e já guarda de quem
         * foi a vez — três blocos à mão precisariam de um quarto só pra lembrar onde a fila parou,
         * e esse quarto não existe.
         */
        no("rd-equipe", "encaminhar_equipe", "acao", { equipeNome: "" }, "Rodízio da equipe"),
        msg("rd-aviso", "Já estou te passando pra pessoa que vai cuidar do seu atendimento. 🤝"),
        fim("rd-fim"),
      ];
      return montar(nodes, [aresta("rd-equipe", "rd-aviso"), aresta("rd-aviso", "rd-fim")]);
    },
  },
];
