import { layoutFluxo } from "@/lib/automation-flow/migracao";
import type {
  ConfiguracoesFluxo,
  FlowEdge,
  FlowNode,
  FlowNodeCategory,
  FlowNodeType,
} from "@/lib/automation-flow/types";
import { CANAIS_DA_AREA, type AreaAutomacao, type CanalId } from "@/lib/canais/capacidades";

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
  /**
   * EM QUAL GALERIA ELE APARECE — e isto é sobre QUEM DISPARA, não sobre canal.
   *
   * "Instagram é num lugar e a automação do WhatsApp é em outro."
   *
   * O recorte por canal sozinho não dava conta, e dava errado dos dois lados:
   *
   * - "comercial": o robô NÃO tem bloco de gatilho. Quem dispara é a etapa do funil ("quando o
   *   lead entrar em Follow-up, execute este robô"). Posto no Social Seller, onde não existe
   *   etapa, ele nasceria sem ninguém pra acionar — e o editor diria, com razão, que nada dispara
   *   aquela automação.
   * - "social": o robô CARREGA o próprio gatilho (comentou, respondeu o story, marcou num story,
   *   mandou Direct). Esses eventos não são etapa de funil, e nenhuma etapa sabe deles. Posto na
   *   automação do funil, ele aparecia na lista e nunca tinha como rodar.
   *
   * O teste do catálogo cobra as duas metades: social tem gatilho, comercial não tem.
   */
  area: AreaAutomacao;
  ilustracao: IlustracaoDoModelo;
  /** O que precisa ser trocado antes de publicar. Nenhum modelo funciona de cara sem isso. */
  ajustar?: string;
  construir: () => { nodes: FlowNode[]; edges: FlowEdge[]; configuracoes: ConfiguracoesFluxo };
};

/**
 * OS MODELOS QUE APARECEM EM CADA ÁREA.
 *
 * "Todos que forem do Instagram, nós vamos colocar dentro do Social Seller. Não vai ficar na
 * automação do funil, porque Instagram é num lugar e a automação do WhatsApp é em outro."
 *
 * O recorte sai do canal declarado em cada modelo, e não de uma segunda lista escrita à mão:
 * duas listas divergem na primeira vez que alguém acrescenta um modelo e lembra de uma só.
 *
 * Quem fala nos DOIS lados continua nos dois (um bot de boas-vindas é bot de boas-vindas no
 * WhatsApp e no Direct). O que a separação resolve é o contrário: "Responda a palavras-chave nos
 * comentários" deixa de aparecer na automação do funil, onde ela nunca teve como rodar.
 */
export function modelosDaArea(area: AreaAutomacao): ModeloDeRobo[] {
  return MODELOS_DE_ROBO.filter((m) => m.area === area);
}

/** Os canais que o filtro da galeria daquela área oferece. Um canal só = não há o que filtrar. */
export function canaisDoFiltro(area: AreaAutomacao): CanalId[] {
  const daArea = CANAIS_DA_AREA[area];
  const usados = new Set(modelosDaArea(area).flatMap((m) => m.canais));
  return daArea.filter((c) => usados.has(c));
}

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

/**
 * Espera um tempo, MAS segue na hora se a pessoa responder antes.
 *
 * É o bloco de todo follow-up: o ponto é justamente descobrir se houve retorno. Com uma pausa
 * pura, o robô mandaria "vi que você não respondeu" pra quem respondeu dez minutos depois — que é
 * o jeito mais rápido de a automação parecer burra pro cliente.
 *
 * Saídas: `ok` (respondeu antes do tempo) e `timeout` (não respondeu).
 */
function pausaOuResponde(id: string, modo: "horas" | "dias", valor: number, titulo?: string) {
  return no(id, "aguardar", "espera", { modo, valor, interromperSeResponder: true }, titulo);
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

/**
 * OS GATILHOS DO INSTAGRAM, que são o que torna um modelo social capaz de rodar.
 *
 * No funil quem dispara é a etapa, e por isso aqueles modelos não têm bloco de gatilho. Aqui não
 * existe etapa: "alguém comentou", "alguém marcou você num story" são eventos da rede, e o robô
 * precisa carregar o próprio começo. Sem isto, os modelos de Instagram apareciam na galeria e
 * nunca tinham como ser acionados.
 */
function gatilhoComentario(id: string, palavras: string[], titulo = "Comentou a palavra combinada") {
  return no(
    id,
    "comentario_instagram",
    "gatilho",
    { canal: "Instagram", palavras, modoPalavra: "qualquer", ignorarAcentos: true, publicacaoId: "" },
    titulo,
  );
}

function gatilhoMencaoStory(id: string, titulo = "Marcou o perfil num story") {
  return no(id, "instagram_mencao_story", "gatilho", { canal: "Instagram" }, titulo);
}

function gatilhoDirect(id: string, titulo = "Mandou mensagem no Direct") {
  return no(id, "instagram_direct_recebido", "gatilho", { canal: "Instagram" }, titulo);
}

function gatilhoStoryRespondido(id: string, titulo = "Respondeu um story") {
  return no(id, "instagram_story_respondido", "gatilho", { canal: "Instagram" }, titulo);
}

/** Aviso interno pra equipe — o "Enviar mensagem interna" da referência. */
function avisoInterno(id: string, mensagem: string, titulo?: string) {
  return no(id, "notificacao_interna", "mensagem", { mensagem }, titulo);
}

/* ------------------------------------------------------------- os modelos -- */

const TODOS_OS_CANAIS: CanalId[] = ["whatsapp_oficial", "whatsapp_qrcode", "instagram"];
const SO_WHATSAPP: CanalId[] = ["whatsapp_oficial", "whatsapp_qrcode"];
const SO_INSTAGRAM: CanalId[] = ["instagram"];

/**
 * OS DOIS WHATSAPPS SEPARADOS, que em follow-up é a diferença que decide o fluxo.
 *
 * "Pode fazer umas 2 opções de follow-up, 2 para WhatsApp normal e 2 para WhatsApp API oficial."
 * Não é preferência de canal: é uma regra da Meta. Na API oficial, passadas 24 horas da última
 * mensagem DO CLIENTE, texto livre não sai — só modelo aprovado. E follow-up é exatamente o que
 * acontece depois do silêncio, ou seja, quase sempre fora dessa janela.
 *
 * Por isso o par oficial é diferente do par do QR Code, e não uma cópia com outro nome: um fica
 * DENTRO da janela de propósito, e o outro usa modelo aprovado pra poder falar fora dela.
 */
const SO_WHATSAPP_QRCODE: CanalId[] = ["whatsapp_qrcode"];
const SO_WHATSAPP_OFICIAL: CanalId[] = ["whatsapp_oficial"];

export const MODELOS_DE_ROBO: ModeloDeRobo[] = [
  /* ------------------------------------------------------------------ 1 --- */
  {
    id: "bot-de-boas-vindas",
    nome: "Bot de boas-vindas",
    objetivo: "Menu inicial com três caminhos e uma cobrança automática pra quem não responder.",
    categorias: ["informacoes"],
    canais: TODOS_OS_CANAIS,
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "social",
    ilustracao: {
      fundo: "laranja",
      bolhas: [{ texto: "Use PROMOCOD20 👇", de: "eu" }],
      selo: "STORY",
      emoji: "📸",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        gatilhoMencaoStory("ms-gatilho"),
        msg(
          "ms-cupom",
          "Obrigado por nos mencionar no seu story! 🙌 Use este código promocional para obter 20% de desconto no seu primeiro pedido: PROMOCOD20. Acesse nosso site e aproveite agora 👇\n\nhttps://www.seusite.com",
          "Cupom e link",
        ),
        fim("ms-fim"),
      ];
      return montar(nodes, [aresta("ms-gatilho", "ms-cupom"), aresta("ms-cupom", "ms-fim")]);
    },
  },

  /* ------------------------------------------------------------------ 6 --- */
  {
    id: "palavra-chave-nos-comentarios",
    nome: "Responda a palavras-chave nos comentários",
    objetivo: "Comentário com a palavra-chave ganha resposta pública e o cupom vai no Direct.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    area: "social",
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
      /*
       * A PALAVRA-CHAVE MORA NO GATILHO, e não numa condição logo depois dele.
       *
       * Era uma condição com só o ramo "sim" ligado: quem comentasse qualquer outra coisa entrava
       * no robô e parava no primeiro bloco, sem saída. Com a palavra no gatilho, quem não
       * comentou a palavra nem começa — que é o que a pessoa quis dizer ao escrever a palavra.
       */
      const nodes: FlowNode[] = [
        gatilhoComentario("pc-gatilho", ["TERDESCONTO"], "Comentou TERDESCONTO"),
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
        aresta("pc-gatilho", "pc-responde"),
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
    area: "social",
    ilustracao: {
      fundo: "azul",
      bolhas: [{ texto: "Agradecemos! 🥰", de: "eu" }],
      selo: "MENÇÃO",
      emoji: "❤️",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        gatilhoMencaoStory("rm-gatilho"),
        no("rm-coracao", "reagir_mensagem", "mensagem", { emoji: "❤️" }, "Reage com ❤️"),
        msg("rm-obrigado", "Agradecemos pela sua mensagem! Seu apoio significa muito 🥰"),
        fim("rm-fim"),
      ];
      return montar(nodes, [
        aresta("rm-gatilho", "rm-coracao"),
        aresta("rm-coracao", "rm-obrigado"),
        aresta("rm-obrigado", "rm-fim"),
      ]);
    },
  },

  /* ------------------------------------------------------------------ 8 --- */
  {
    id: "recompensa-para-seguidores",
    nome: "Compartilhe recompensas exclusivas com seguidores",
    objetivo: "Comentário com a palavra-chave pede que a pessoa siga, e aí entrega o material.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    area: "social",
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
        gatilhoComentario("rs-gatilho", ["BRINDE"], "Comentou BRINDE"),
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
        aresta("rs-gatilho", "rs-pede"),
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
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
  /* ---------------------------------------------------------------- 21 --- */
  /*
   * OS QUATRO MODELOS DE FOLLOW-UP.
   *
   * "Aquele modelo onde você pergunta se a pessoa ainda tem interesse, vê que ela não respondeu…
   * quando a pessoa não dá retorno. Pode fazer umas 2 opções de follow-up, 2 para WhatsApp normal
   * e 2 para WhatsApp API oficial."
   *
   * Os quatro começam pelo mesmo bloco: uma espera que PARA assim que a pessoa responde. Sem
   * isso, o robô manda "vi que você não me deu retorno" pra quem acabou de responder — e aí o
   * follow-up vira motivo de desculpa em vez de venda.
   *
   * Nenhum deles insiste no vazio: todo caminho acaba etiquetando o lead e, quando vale a pena,
   * avisando a equipe. Follow-up que só manda mensagem e não marca nada deixa a pessoa
   * descobrindo pelo histórico quem sumiu.
   */
  {
    id: "follow-up-ainda-tem-interesse",
    nome: "Follow-up: sumiu, ainda tem interesse?",
    objetivo: "Espera um dia. Se o lead não respondeu, pergunta se ainda há interesse e separa quem disse que sim.",
    categorias: ["engajar"],
    canais: SO_WHATSAPP_QRCODE,
    area: "comercial",
    ilustracao: {
      fundo: "laranja",
      bolhas: [
        { texto: "Vi que você não me deu retorno…", de: "eu" },
        { texto: "Ainda tem interesse?", de: "eu" },
      ],
      botoes: ["Ainda tenho interesse", "Agora não"],
      emoji: "👋",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        pausaOuResponde("fi-espera", "dias", 1, "Espera 1 dia pela resposta"),
        /*
         * NO QR CODE ISTO CHEGA COMO MENU NUMERADO, não como botão.
         *
         * A conexão por QR Code não tem botão confiável (`CAPACIDADES.whatsapp_qrcode.botoes` é
         * zero: em parte dos aparelhos a mensagem chega sem os botões). O envio resolve sozinho e
         * manda "1 · Ainda tenho interesse / 2 · Agora não", e o casamento da resposta aceita o
         * número e o texto. O desenho do fluxo é o mesmo; o que muda é a cara da mensagem.
         */
        botoes(
          "fi-pergunta",
          "Oi {primeiro_nome}, tudo bem? 😊 Percebi que você não me deu retorno por aqui e fiquei na dúvida se ainda faz sentido pra você neste momento.\n\nMe diz rapidinho:",
          [
            { id: "fi-sim", rotulo: "Ainda tenho interesse" },
            { id: "fi-depois", rotulo: "Agora não é o momento" },
          ],
          "Ainda tem interesse?",
        ),
        etiqueta("fi-quente", "Quer retomar", "Marca como quente"),
        avisoInterno(
          "fi-avisa",
          "{primeiro_nome} respondeu o follow-up e disse que AINDA TEM INTERESSE. Chama agora, enquanto está quente.",
          "Avisa a equipe",
        ),
        msg("fi-retoma", "Que bom! 🙌 Já vou te passar pra alguém da equipe continuar daqui.", "Confirma pro lead"),
        etiqueta("fi-depois-tag", "Retomar depois", "Guarda pra depois"),
        msg(
          "fi-despede",
          "Sem problema, {primeiro_nome}! 👍 Vou deixar anotado e te procuro mais pra frente. Se mudar de ideia antes, é só me chamar por aqui.",
          "Despedida sem pressão",
        ),
        /*
         * QUEM NÃO RESPONDE NEM O FOLLOW-UP é informação, não falha. Etiquetar separa a lista de
         * quem ainda vale a pena chamar da de quem já ignorou duas vezes — e é essa lista que
         * decide onde a equipe gasta a hora dela.
         */
        etiqueta("fi-mudo", "Sem resposta", "Marca que sumiu de vez"),
        fim("fi-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("fi-espera", "fi-fim", "ok"),
        aresta("fi-espera", "fi-pergunta", "timeout"),
        aresta("fi-pergunta", "fi-quente", "fi-sim"),
        aresta("fi-quente", "fi-avisa"),
        aresta("fi-avisa", "fi-retoma"),
        aresta("fi-retoma", "fi-fim"),
        aresta("fi-pergunta", "fi-depois-tag", "fi-depois"),
        aresta("fi-depois-tag", "fi-despede"),
        aresta("fi-despede", "fi-fim"),
        aresta("fi-pergunta", "fi-mudo", "nao_respondeu"),
        aresta("fi-mudo", "fi-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 22 --- */
  {
    id: "follow-up-tres-toques",
    nome: "Follow-up em 3 toques: 1 dia, 3 dias, 7 dias",
    objetivo: "Três lembretes cada vez mais espaçados, e para no instante em que o lead responde.",
    categorias: ["engajar"],
    canais: SO_WHATSAPP_QRCODE,
    area: "comercial",
    ilustracao: {
      fundo: "azul",
      bolhas: [
        { texto: "Conseguiu ver minha proposta?", de: "eu" },
        { texto: "Passando pra lembrar 🙂", de: "eu" },
        { texto: "Último toque por aqui!", de: "eu" },
      ],
      selo: "3 TOQUES",
      emoji: "⏳",
    },
    construir: () => {
      /*
       * OS INTERVALOS CRESCEM: 1, depois 2, depois 4 dias (1, 3 e 7 no calendário).
       *
       * Três mensagens com o mesmo espaçamento lêem-se como cobrança automática, e é aí que vem o
       * bloqueio. Espaçar cada vez mais é o que faz a terceira parecer "última chance" e não
       * "esse robô não para".
       *
       * Este é o par do QR Code de propósito: três toques ao longo de uma semana passa da janela
       * de 24 horas da API oficial, onde texto livre simplesmente não sai.
       */
      const nodes: FlowNode[] = [
        pausaOuResponde("f3-e1", "dias", 1, "Espera 1 dia"),
        msg(
          "f3-t1",
          "Oi {primeiro_nome}! 😊 Passando pra saber se você chegou a ver o que te mandei. Qualquer dúvida é só responder por aqui.",
          "1º toque",
        ),
        pausaOuResponde("f3-e2", "dias", 2, "Espera mais 2 dias"),
        msg(
          "f3-t2",
          "Oi {primeiro_nome}, tudo certo? Percebi que você não me deu retorno e não quero te atrapalhar. Ainda faz sentido a gente conversar sobre isso?",
          "2º toque",
        ),
        pausaOuResponde("f3-e3", "dias", 4, "Espera mais 4 dias"),
        msg(
          "f3-t3",
          "{primeiro_nome}, esse é o meu último toque por aqui pra não ficar insistindo. 🙏 Vou deixar tudo anotado — se quiser retomar, me chama a qualquer momento que eu respondo.",
          "3º toque (último)",
        ),
        etiqueta("f3-esfriou", "Esfriou", "Marca que esfriou"),
        avisoInterno(
          "f3-avisa",
          "{primeiro_nome} não respondeu nenhum dos 3 follow-ups em uma semana. Decidam se vale uma ligação ou se o lead sai da lista.",
          "Avisa a equipe",
        ),
        fim("f3-fim"),
      ];
      const edges: FlowEdge[] = [
        // Respondeu em qualquer uma das esperas: o robô sai de cena na hora.
        aresta("f3-e1", "f3-fim", "ok"),
        aresta("f3-e1", "f3-t1", "timeout"),
        aresta("f3-t1", "f3-e2"),
        aresta("f3-e2", "f3-fim", "ok"),
        aresta("f3-e2", "f3-t2", "timeout"),
        aresta("f3-t2", "f3-e3"),
        aresta("f3-e3", "f3-fim", "ok"),
        aresta("f3-e3", "f3-t3", "timeout"),
        aresta("f3-t3", "f3-esfriou"),
        aresta("f3-esfriou", "f3-avisa"),
        aresta("f3-avisa", "f3-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 23 --- */
  {
    id: "follow-up-janela-24h",
    nome: "Follow-up na mesma conversa (API oficial, dentro das 24h)",
    objetivo: "Cobra o retorno em 4 horas, ainda dentro da janela em que a API oficial deixa mandar texto livre.",
    categorias: ["engajar"],
    canais: SO_WHATSAPP_OFICIAL,
    area: "comercial",
    ilustracao: {
      fundo: "verde",
      bolhas: [
        { texto: "Ainda consigo te ajudar?", de: "eu" },
        { texto: "Pode me responder por aqui 🙂", de: "eu" },
      ],
      botoes: ["Sim, me ajuda", "Depois eu volto"],
      selo: "DENTRO DA JANELA",
      emoji: "🕓",
    },
    construir: () => {
      /*
       * QUATRO HORAS, E ISSO É A REGRA DA META, NÃO GOSTO PESSOAL.
       *
       * Na API oficial, texto livre só sai dentro de 24 horas contadas da última mensagem DO
       * CLIENTE. Esperar um dia pra cobrar o retorno cairia bem na borda — e o que acontece lá é
       * o envio ser recusado, sem a automação ter como avisar que o cliente nunca recebeu nada.
       *
       * Quatro horas ficam folgadas dentro da janela e ainda são tempo suficiente pra pessoa ter
       * saído pra almoçar e voltado. Pra falar DEPOIS da janela existe o modelo aprovado, que é o
       * outro modelo deste par.
       */
      const nodes: FlowNode[] = [
        pausaOuResponde("fj-espera", "horas", 4, "Espera 4 horas (dentro da janela)"),
        botoes(
          "fj-pergunta",
          "Oi {primeiro_nome}! Vi que a gente parou no meio da conversa. 🙂 Ainda consigo te ajudar com isso?",
          [
            { id: "fj-sim", rotulo: "Sim, me ajuda" },
            { id: "fj-depois", rotulo: "Depois eu volto" },
          ],
          "Ainda consigo ajudar?",
        ),
        avisoInterno(
          "fj-avisa",
          "{primeiro_nome} voltou a responder no follow-up e pediu ajuda. A janela de 24h está aberta: dá pra responder em texto livre agora.",
          "Avisa a equipe",
        ),
        msg("fj-retoma", "Perfeito! Já estou chamando alguém da equipe pra continuar com você. 🤝", "Confirma pro lead"),
        etiqueta("fj-depois-tag", "Retomar depois", "Guarda pra depois"),
        msg("fj-ok", "Combinado, {primeiro_nome}! Fico por aqui quando você quiser retomar. 👍", "Despedida"),
        /*
         * Quem não respondeu NEM dentro da janela só pode ser alcançado por modelo aprovado. A
         * etiqueta é o que liga este robô no outro: ela é o filtro da lista de reativação.
         */
        etiqueta("fj-fora", "Fora da janela", "Marca pra reativar por modelo"),
        fim("fj-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("fj-espera", "fj-fim", "ok"),
        aresta("fj-espera", "fj-pergunta", "timeout"),
        aresta("fj-pergunta", "fj-avisa", "fj-sim"),
        aresta("fj-avisa", "fj-retoma"),
        aresta("fj-retoma", "fj-fim"),
        aresta("fj-pergunta", "fj-depois-tag", "fj-depois"),
        aresta("fj-depois-tag", "fj-ok"),
        aresta("fj-ok", "fj-fim"),
        aresta("fj-pergunta", "fj-fora", "nao_respondeu"),
        aresta("fj-fora", "fj-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  /* ---------------------------------------------------------------- 24 --- */
  {
    id: "follow-up-modelo-aprovado",
    nome: "Reativação por modelo aprovado (API oficial, depois das 24h)",
    objetivo: "Passado um dia de silêncio, chama de volta com um modelo aprovado — o único jeito de falar fora da janela.",
    categorias: ["engajar"],
    canais: SO_WHATSAPP_OFICIAL,
    area: "comercial",
    ilustracao: {
      fundo: "lilas",
      bolhas: [
        { texto: "Modelo aprovado 📋", de: "eu" },
        { texto: "Ainda quer continuar?", de: "eu" },
      ],
      selo: "FORA DA JANELA",
      emoji: "📨",
    },
    construir: () => {
      /*
       * ESTE MODELO NASCE COM UM CAMPO VAZIO DE PROPÓSITO, e o editor vai acusar isso.
       *
       * O bloco "Modelo aprovado do WhatsApp" precisa de um template que a Meta aprovou NA CONTA
       * dela — e isso não tem como vir pronto de fábrica: o texto é aprovado por conta, por idioma
       * e por categoria. Preencher com um id inventado daria um robô que publica, roda, e falha no
       * envio sem ninguém entender por quê.
       *
       * Então o bloco vem vazio e o painel de problemas do editor diz "está sem modelo escolhido".
       * É um recado, não um defeito: é a única coisa que precisa ser feita antes de publicar.
       */
      const nodes: FlowNode[] = [
        pausaOuResponde("fm-espera", "dias", 1, "Espera 1 dia pela resposta"),
        no(
          "fm-modelo",
          "mensagem_modelo_whatsapp",
          "mensagem",
          { templateId: "" },
          "Escolha aqui o seu modelo aprovado",
        ),
        /*
         * Depois do modelo, a conversa só reabre se a pessoa responder — e responder é o que
         * reabre a janela de 24 horas. Por isso a espera aqui é "até responder", com prazo: se
         * ela voltar, texto livre volta a valer e a equipe assume.
         */
        pausaAteResponder("fm-volta", "Espera a resposta (reabre a janela)"),
        etiqueta("fm-reativado", "Reativado", "Marca como reativado"),
        avisoInterno(
          "fm-avisa",
          "{primeiro_nome} respondeu o modelo de reativação. A janela de 24h reabriu: dá pra falar em texto livre agora, e só agora.",
          "Avisa a equipe",
        ),
        msg("fm-oi", "Que bom te ver de volta, {primeiro_nome}! 🙌 Me conta em que posso ajudar.", "Retoma a conversa"),
        etiqueta("fm-frio", "Não reativou", "Marca que não voltou"),
        fim("fm-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("fm-espera", "fm-fim", "ok"),
        aresta("fm-espera", "fm-modelo", "timeout"),
        aresta("fm-modelo", "fm-volta"),
        aresta("fm-volta", "fm-reativado", "ok"),
        aresta("fm-reativado", "fm-avisa"),
        aresta("fm-avisa", "fm-oi"),
        aresta("fm-oi", "fm-fim"),
        aresta("fm-volta", "fm-frio", "timeout"),
        aresta("fm-frio", "fm-fim"),
      ];
      return montar(nodes, edges);
    },
  },
  /* ------------------------------------------------------- 25 a 28: social -- */
  /*
   * OS QUATRO MODELOS QUE VIERAM DO SOCIAL SELLER (do antigo `lib/social/modelos-rapidos.ts`).
   *
   * Eram um catálogo paralelo, com outro formato, alimentando outra tela. Agora que a galeria é
   * a mesma dos dois lados, dois catálogos só criariam a chance de um modelo existir num lugar e
   * não no outro — que é exatamente o tipo de divergência que ninguém percebe até precisar.
   *
   * Vieram inteiros, com os mesmos textos e os mesmos blocos: quem já usava reconhece.
   */
  {
    id: "comentario-link",
    nome: "Comentou a palavra, recebe o link no Direct",
    objetivo: "Quem comenta a palavra combinada recebe uma resposta pública e o link no Direct.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    area: "social",
    ajustar: "Troque a palavra, o texto da resposta e o link.",
    ilustracao: {
      fundo: "verde",
      bolhas: [
        { texto: "quero", de: "ele" },
        { texto: "Te mandei no Direct! 💙", de: "eu" },
      ],
      selo: "COMENTÁRIO",
      emoji: "🔗",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        gatilhoComentario("cl-gatilho", ["quero"]),
        // Responder o comentário ANTES do Direct é deliberado: é o que aparece publicamente e o
        // que faz a próxima pessoa comentar também.
        no("cl-responde", "responder_comentario_instagram", "acao", { texto: "Te mandei no Direct! 💙" }),
        no("cl-direct", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Oi! Vi seu comentário 💙 Aqui está o que prometi: (cole o link aqui)",
        }),
        etiqueta("cl-etiqueta", "Veio do Instagram"),
        fim("cl-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("cl-gatilho", "cl-responde"),
        aresta("cl-responde", "cl-direct"),
        aresta("cl-direct", "cl-etiqueta"),
        aresta("cl-etiqueta", "cl-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  {
    id: "story-conversa",
    nome: "Respondeu meu story, vira conversa",
    objetivo: "Quem responde um story recebe uma pergunta com opções e cai com a pessoa certa do time.",
    categorias: ["engajar"],
    canais: SO_INSTAGRAM,
    area: "social",
    ajustar: "Troque o texto da pergunta e as opções pelo que você vende.",
    ilustracao: {
      fundo: "rosa",
      bolhas: [{ texto: "Que bom que respondeu 💙", de: "eu" }],
      botoes: ["Quero saber preço", "Tenho uma dúvida"],
      selo: "STORY",
      emoji: "💬",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        gatilhoStoryRespondido("sc-gatilho"),
        // O Direct aceita até 13 respostas rápidas; duas é o que cabe numa conversa que começou
        // agora. `esperaMinutos` é o que faz a saída "Sem resposta" existir de verdade.
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
        no("sc-preco", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Perfeito! Me conta rapidinho o que você procura que eu te passo os valores.",
        }),
        no("sc-duvida", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Pode perguntar! Já já alguém do time te responde por aqui.",
        }),
        no("sc-humano", "encaminhar_humano", "humano", {}),
        // A saída de quem não respondeu em 2 horas. Sem ela o fluxo ficaria parado pra sempre e a
        // pessoa sumiria do funil sem ninguém saber.
        no("sc-sem-resposta", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Respondeu o story mas não continuou a conversa.",
        }),
        no("sc-fim", "encerrar_fluxo", "fim", { observacao: "Conversa entregue ao time." }),
      ];
      const edges: FlowEdge[] = [
        aresta("sc-gatilho", "sc-pergunta"),
        aresta("sc-pergunta", "sc-preco", "sc-op-preco"),
        aresta("sc-preco", "sc-humano"),
        aresta("sc-pergunta", "sc-duvida", "sc-op-duvida"),
        aresta("sc-duvida", "sc-humano"),
        aresta("sc-pergunta", "sc-sem-resposta", "nao_respondeu"),
        aresta("sc-humano", "sc-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  {
    id: "primeira-dm",
    nome: "Primeira mensagem no Direct, boas-vindas e triagem",
    objetivo: "Quem escreve no Direct é recebido, escolhe o assunto e entra no CRM já etiquetado.",
    categorias: ["gerar_leads"],
    canais: SO_INSTAGRAM,
    area: "social",
    ajustar: "Troque a saudação e as opções.",
    ilustracao: {
      fundo: "azul",
      bolhas: [{ texto: "Seja bem-vindo(a) 💙", de: "eu" }],
      botoes: ["Quero comprar", "Já sou cliente"],
      emoji: "👋",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        gatilhoDirect("dm-gatilho"),
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
        etiqueta("dm-etq-novo", "Lead do Instagram"),
        etiqueta("dm-etq-cliente", "Cliente"),
        no("dm-humano", "encaminhar_humano", "humano", {}),
        no("dm-sem-resposta", "encerrar_fluxo", "fim", {
          motivo: "sem_resposta",
          observacao: "Escreveu no Direct mas não escolheu o assunto.",
        }),
        no("dm-fim", "encerrar_fluxo", "fim", { observacao: "Triagem feita." }),
      ];
      const edges: FlowEdge[] = [
        aresta("dm-gatilho", "dm-pergunta"),
        aresta("dm-pergunta", "dm-etq-novo", "dm-op-comprar"),
        aresta("dm-etq-novo", "dm-humano"),
        aresta("dm-pergunta", "dm-etq-cliente", "dm-op-suporte"),
        aresta("dm-etq-cliente", "dm-humano"),
        aresta("dm-pergunta", "dm-sem-resposta", "nao_respondeu"),
        aresta("dm-humano", "dm-fim"),
      ];
      return montar(nodes, edges);
    },
  },

  {
    id: "mencao-story",
    nome: "Me marcou num story, agradece",
    objetivo: "Quem marca seu perfil num story recebe um agradecimento no Direct e fica etiquetado.",
    categorias: ["engajar"],
    canais: SO_INSTAGRAM,
    area: "social",
    ajustar: "Troque o texto do agradecimento.",
    ilustracao: {
      fundo: "laranja",
      bolhas: [{ texto: "Vi que você nos marcou, obrigado! 💙", de: "eu" }],
      selo: "MENÇÃO",
      emoji: "🙏",
    },
    construir: () => {
      const nodes: FlowNode[] = [
        gatilhoMencaoStory("mn-gatilho"),
        no("mn-msg", "mensagem_texto", "mensagem", {
          canal: "instagram",
          texto: "Vi que você nos marcou, muito obrigado! 💙",
        }),
        etiqueta("mn-etiqueta", "Divulgou a marca"),
        fim("mn-fim"),
      ];
      const edges: FlowEdge[] = [
        aresta("mn-gatilho", "mn-msg"),
        aresta("mn-msg", "mn-etiqueta"),
        aresta("mn-etiqueta", "mn-fim"),
      ];
      return montar(nodes, edges);
    },
  },
];
