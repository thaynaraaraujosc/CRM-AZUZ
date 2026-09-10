/**
 * O que cada canal REALMENTE entrega.
 *
 * Esta tabela existe pra impedir um defeito específico e caro: oferecer na tela um recurso que o
 * canal não tem. Botão clicável no Direct do Instagram não existe; reação por e-mail não existe;
 * TikTok não tem integração nenhuma hoje. Quando o construtor mostra esses blocos assim mesmo, a
 * pessoa monta o fluxo inteiro em volta de um passo que nunca vai acontecer, e o erro só aparece
 * com o lead do outro lado esperando.
 *
 * A regra do produto é uma só: **nada de botão falso**. O construtor lê daqui e simplesmente não
 * mostra o que aquele canal não faz. Uma tabela só, num arquivo só, para que "o Instagram passou a
 * aceitar X" seja a mudança de uma linha, e não uma caçada por condicionais espalhadas.
 *
 * Isto NÃO é a lista de conexões ativas do cliente (isso vem do banco, em `Integracao`). É o que o
 * canal é capaz de fazer quando conectado. As duas perguntas se somam na tela: "existe?" e "está
 * ligado?".
 */

import type { FlowNodeType } from "@/lib/automation-flow/types";

/** Os canais que o CRM conhece. Nível de CONEXÃO, não de conversa. */
export type CanalId = "whatsapp_oficial" | "whatsapp_qrcode" | "instagram" | "tiktok" | "email";

/**
 * Como o disparo em massa se comporta no canal.
 *
 * - `livre`: dá pra iniciar conversa com quem nunca falou (respeitando o ritmo e o opt-in).
 * - `modelo_aprovado`: fora da janela, só com modelo aprovado pelo provedor.
 * - `so_na_janela`: só pra quem falou dentro da janela. É o caso do Direct.
 * - `nao`: o canal não permite disparo em massa de forma legítima.
 */
export type RegraDisparo = "livre" | "modelo_aprovado" | "so_na_janela" | "nao";

export type CapacidadesCanal = {
  id: CanalId;
  label: string;
  /** Frase curta que a tela usa pra explicar o canal. */
  resumo: string;

  /** Existe integração escrita e funcionando? `false` = a conexão nem é oferecida. */
  disponivel: boolean;
  /** Por que não está disponível. Só faz sentido quando `disponivel` é falso. */
  motivoIndisponivel?: string;

  texto: boolean;
  imagem: boolean;
  video: boolean;
  audio: boolean;
  documento: boolean;

  /** Quantas opções clicáveis o provedor aceita numa mensagem. `0` = não existe botão neste canal. */
  botoes: number;
  /**
   * Como aquele canal CHAMA a opção clicável. Não é preciosismo: no WhatsApp oficial é botão de
   * resposta e fica na bolha; no Instagram é resposta rápida, aparece acima do teclado e some
   * depois de usada. Chamar os dois de "botão" faz a tela prometer uma coisa e o canal entregar
   * outra.
   */
  nomeDoBotao: string;
  /** Quantos itens a lista interativa aceita. `0` = não existe lista neste canal. */
  lista: number;
  /** Menu numerado em texto puro. Funciona em qualquer canal que aceite texto. */
  menuNumerado: boolean;

  reacao: boolean;
  /** Responder e ocultar comentário de publicação. */
  comentarios: boolean;

  /**
   * O canal emite eventos que só existem nele (story respondido, menção, publicação
   * compartilhada). É o que faz os gatilhos próprios do Instagram aparecerem só onde acontecem.
   */
  eventosProprios: boolean;
  /** Modelo previamente aprovado pelo provedor, o único jeito de falar fora da janela. */
  modeloAprovado: boolean;
  /** O canal é e-mail: assunto e corpo, sem conversa. */
  ehEmail: boolean;

  /**
   * Janela de envio livre, em horas, contada da última mensagem do contato. `null` = sem janela.
   *
   * É o número que decide se "aguardar 3 dias e cobrar" funciona no canal ou não.
   */
  janelaHoras: number | null;
  /** O que dizer na tela sobre a janela. Vazio quando não há janela. */
  janelaExplicacao: string;

  disparo: RegraDisparo;
};

/**
 * A tabela. Cada número aqui é do provedor, não é chute.
 */
export const CAPACIDADES: Record<CanalId, CapacidadesCanal> = {
  whatsapp_oficial: {
    id: "whatsapp_oficial",
    label: "WhatsApp oficial (Cloud API)",
    resumo: "Conexão declarada com a Meta. Modelos aprovados, botões e lista.",
    disponivel: true,
    texto: true,
    imagem: true,
    video: true,
    audio: true,
    documento: true,
    // A Cloud API aceita até 3 botões de resposta rápida numa mensagem interativa, e até 10 linhas
    // numa lista. Passar disso a API recusa a mensagem inteira, não corta o excedente.
    botoes: 3,
    nomeDoBotao: "botões de resposta",
    lista: 10,
    menuNumerado: true,
    reacao: true,
    comentarios: false,
    eventosProprios: false,
    modeloAprovado: true,
    ehEmail: false,
    janelaHoras: 24,
    janelaExplicacao:
      "Fora de 24 horas desde a última mensagem do contato, só sai mensagem com modelo aprovado pela Meta.",
    disparo: "modelo_aprovado",
  },

  whatsapp_qrcode: {
    id: "whatsapp_qrcode",
    label: "WhatsApp por QR Code",
    resumo: "O aparelho conectado por leitura de código. Texto e mídia, sem botão confiável.",
    disponivel: true,
    texto: true,
    imagem: true,
    video: true,
    audio: true,
    documento: true,
    // Botão e lista existem no protocolo, mas o comportamento varia com a versão do aplicativo do
    // destinatário: numa parte dos aparelhos a mensagem chega sem os botões e a pessoa fica sem
    // saber o que responder. Oferecer isso aqui seria oferecer um botão que às vezes não existe.
    botoes: 0,
    nomeDoBotao: "",
    lista: 0,
    menuNumerado: true,
    reacao: true,
    comentarios: false,
    eventosProprios: false,
    modeloAprovado: false,
    ehEmail: false,
    janelaHoras: null,
    janelaExplicacao: "",
    disparo: "livre",
  },

  instagram: {
    id: "instagram",
    label: "Instagram",
    resumo: "Direct, comentários, stories e menções.",
    disponivel: true,
    texto: true,
    imagem: true,
    video: true,
    // O Direct aceita áudio como anexo de mídia, mas não a mensagem de voz gravada do aplicativo.
    audio: true,
    // Anexo de documento existe: entra como `file` no anexo do Direct.
    documento: true,
    // Respostas rápidas: até 13, com título de 20 caracteres. São clicáveis de verdade, mas não são
    // o botão do WhatsApp: aparecem acima do teclado e somem depois de usadas. Por isso o nome
    // separado, pra tela dizer o que a pessoa vai ver.
    botoes: 13,
    nomeDoBotao: "respostas rápidas",
    // Lista interativa (um botão que abre um menu) não existe no Direct.
    lista: 0,
    menuNumerado: true,
    reacao: true,
    comentarios: true,
    // Story respondido, menção em story, publicação compartilhada, reação: nenhum outro canal tem.
    eventosProprios: true,
    modeloAprovado: false,
    ehEmail: false,
    janelaHoras: 24,
    janelaExplicacao:
      "O Instagram só deixa enviar mensagem livre por 24 horas depois da última mensagem do contato. Depois disso o envio é recusado.",
    disparo: "so_na_janela",
  },

  tiktok: {
    id: "tiktok",
    label: "TikTok",
    resumo: "Sem integração. A API de mensagens do TikTok não é aberta como a da Meta.",
    // Deliberado: o canal é DECLARADO e marcado como indisponível, em vez de ser escondido. Assim a
    // tela pode dizer por que ele não está lá, o que é honesto, sem oferecer um botão que não faz
    // nada. O dia em que o aplicativo for aprovado, isto vira `true` e o resto já está escrito.
    disponivel: false,
    motivoIndisponivel:
      "Não existe integração com o TikTok. O acesso a mensagens e comentários depende de aplicativo aprovado caso a caso pela plataforma, e ainda não temos.",
    texto: false,
    imagem: false,
    video: false,
    audio: false,
    documento: false,
    botoes: 0,
    nomeDoBotao: "",
    lista: 0,
    menuNumerado: false,
    reacao: false,
    comentarios: false,
    eventosProprios: false,
    modeloAprovado: false,
    ehEmail: false,
    janelaHoras: null,
    janelaExplicacao: "",
    disparo: "nao",
  },

  email: {
    id: "email",
    label: "E-mail",
    resumo: "Assunto e corpo. Sem conversa em tempo real.",
    disponivel: true,
    texto: true,
    imagem: true,
    video: false,
    audio: false,
    documento: true,
    botoes: 0,
    nomeDoBotao: "",
    lista: 0,
    menuNumerado: false,
    reacao: false,
    comentarios: false,
    eventosProprios: false,
    modeloAprovado: false,
    ehEmail: true,
    janelaHoras: null,
    janelaExplicacao: "",
    disparo: "livre",
  },
};

/** Só os canais que existem de verdade. É o que a tela oferece pra conectar. */
export function canaisDisponiveis(): CapacidadesCanal[] {
  return Object.values(CAPACIDADES).filter((c) => c.disponivel);
}

/** Todos, inclusive os indisponíveis, pra tela poder explicar a ausência em vez de escondê-la. */
export function todosOsCanais(): CapacidadesCanal[] {
  return Object.values(CAPACIDADES);
}

/**
 * O recurso que um bloco EXIGE do canal pra funcionar.
 *
 * Só os blocos dependentes de canal entram aqui. Bloco de CRM (mover etapa, criar tarefa) não
 * depende de canal nenhum e por isso está ausente de propósito: ausência significa "vale em
 * qualquer canal", e é o padrão certo, porque a maioria dos blocos é assim.
 */
const RECURSO_EXIGIDO: Partial<Record<FlowNodeType, keyof CapacidadesCanal>> = {
  mensagem_texto: "texto",
  mensagem_imagem: "imagem",
  mensagem_video: "video",
  mensagem_audio: "audio",
  mensagem_documento: "documento",
  mensagem_botoes: "botoes",
  mensagem_lista: "lista",
  reagir_mensagem: "reacao",
  responder_comentario_instagram: "comentarios",
  ocultar_comentario_instagram: "comentarios",
  comentario_instagram: "comentarios",
  instagram_resposta_comentario: "comentarios",
  // O GATILHO de reação é um evento do Instagram, não a capacidade de reagir. O WhatsApp também
  // reage, então mapeá-lo em "reacao" deixava este gatilho aparecer no construtor do funil, onde
  // ele nunca dispara. Quem reage é `reagir_mensagem`, logo abaixo, e esse sim é "reacao".
  instagram_reacao_recebida: "eventosProprios",
  // "Mensagem no Direct" é o gatilho genérico visto pela área social. Marcado como evento próprio
  // do Instagram não porque o Direct seja exclusivo, mas porque este BLOCO é: o funil já tem
  // "Mensagem recebida" pro mesmo acontecimento, e ter os dois lá seria oferecer a mesma coisa
  // duas vezes com nomes diferentes.
  instagram_direct_recebido: "eventosProprios",
  instagram_midia_recebida: "eventosProprios",
  instagram_publicacao_compartilhada: "eventosProprios",
  instagram_story_respondido: "eventosProprios",
  instagram_mencao_story: "eventosProprios",
  mensagem_modelo_whatsapp: "modeloAprovado",
  mensagem_email: "ehEmail",
};

/**
 * O bloco pode aparecer neste canal?
 *
 * `mensagem_botoes` é o caso que exige cuidado: `botoes` é um NÚMERO, e zero quer dizer "não
 * existe". Tratar zero como "tem" seria justamente devolver o botão falso.
 */
export function blocoValeNoCanal(tipo: FlowNodeType, canal: CanalId): boolean {
  const capacidades = CAPACIDADES[canal];
  if (!capacidades.disponivel) return false;

  const recurso = RECURSO_EXIGIDO[tipo];
  if (!recurso) return true;

  const valor = capacidades[recurso];
  if (typeof valor === "number") return valor > 0;
  return valor === true;
}

/**
 * O formato de pergunta que este canal aguenta, em ordem de preferência.
 *
 * Menu numerado vem primeiro sempre que existe: é texto puro, chega igual em toda conexão, e o
 * casamento da resposta já aceita número e texto. Botão e lista só entram onde o provedor garante.
 */
export function formatosDePergunta(canal: CanalId): ("menu_numerado" | "botoes" | "lista_interativa" | "texto_livre")[] {
  const c = CAPACIDADES[canal];
  const formatos: ("menu_numerado" | "botoes" | "lista_interativa" | "texto_livre")[] = [];
  if (c.menuNumerado) formatos.push("menu_numerado");
  if (c.botoes > 0) formatos.push("botoes");
  if (c.lista > 0) formatos.push("lista_interativa");
  if (c.texto) formatos.push("texto_livre");
  return formatos;
}

/**
 * A espera cabe na janela do canal?
 *
 * Serve pra tela avisar ENQUANTO a pessoa monta, e não depois com o lead esperando. "Aguardar 3
 * dias" num fluxo de Instagram é um passo que vai falhar por construção: a janela fecha em 24h.
 */
export function esperaCabeNaJanela(
  canal: CanalId,
  minutos: number,
): { cabe: true } | { cabe: false; aviso: string } {
  const c = CAPACIDADES[canal];
  if (c.janelaHoras === null) return { cabe: true };
  if (minutos <= c.janelaHoras * 60) return { cabe: true };

  const dica =
    c.disparo === "modelo_aprovado"
      ? " Depois desse prazo, use um modelo aprovado pra retomar a conversa."
      : "";
  return {
    cabe: false,
    aviso: `A janela do ${c.label} é de ${c.janelaHoras} horas. Uma espera maior que isso faz a mensagem seguinte ser recusada.${dica}`,
  };
}

/** O canal da CONVERSA (como o webhook grava) traduzido pro canal desta tabela. */
export function canalDaConexao(contaCanal: string | null | undefined): CanalId | null {
  if (!contaCanal) return null;
  if (contaCanal.startsWith("meta_instagram")) return "instagram";
  if (contaCanal.startsWith("whatsapp_nao_oficial") || contaCanal.startsWith("whatsapp_baileys")) {
    return "whatsapp_qrcode";
  }
  if (contaCanal.startsWith("meta_whatsapp")) return "whatsapp_oficial";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Áreas do produto                                                          */
/* -------------------------------------------------------------------------- */

/**
 * As duas áreas de automação: comercial (funil, WhatsApp, e-mail) e social (Instagram, e um dia
 * TikTok).
 *
 * São áreas, NÃO motores. O motor é o mesmo, as execuções são as mesmas, o versionamento é o
 * mesmo. O que muda é o conjunto de canais em jogo, e portanto o conjunto de blocos que faz
 * sentido oferecer. Um robô de comentário do Instagram e um robô de funil rodam pelo mesmo código;
 * o que os separa é onde começam e o que podem fazer.
 */
export type AreaAutomacao = "comercial" | "social";

export const CANAIS_DA_AREA: Record<AreaAutomacao, CanalId[]> = {
  comercial: ["whatsapp_oficial", "whatsapp_qrcode", "email"],
  social: ["instagram", "tiktok"],
};

/**
 * Os grupos da biblioteca que cada área mostra, na ordem em que aparecem.
 *
 * Não é filtro de capacidade, é de ASSUNTO, e por isso mora aqui e não na tabela de canais: os
 * gatilhos genéricos ("lead criado", "lead entrou na etapa") funcionariam tecnicamente num robô
 * social, mas não é assim que se pensa uma automação de Instagram. Lá o começo é sempre um evento
 * pontual da rede: alguém comentou, respondeu um story, mandou uma menção. Oferecer as duas
 * famílias de gatilho na mesma tela faz a pessoa montar um robô de funil achando que montou um de
 * Instagram.
 *
 * No social o grupo do Instagram vem PRIMEIRO, porque é por ele que toda automação daquela área
 * começa. No comercial ele não aparece: aquele robô nunca recebe evento de Instagram.
 */
export const GRUPOS_DA_AREA: Record<AreaAutomacao, string[]> = {
  comercial: [
    "gatilhos",
    "mensagens",
    "aguardar",
    "decisoes",
    "followup",
    "whatsapp",
    "whatsapp_oficial",
    "crm",
    "agenda",
    "humano",
    "ia",
    "integracoes",
    "encerramento",
  ],
  /*
   * O social é uma lista CURTA de propósito.
   *
   * O Instagram não tem funil, e por isso não tem etapa pra mover, negócio pra criar nem valor pra
   * atualizar: o grupo "Ações do CRM" inteiro era dezesseis blocos que ou não fazem sentido ali ou
   * levam o robô a mexer num quadro onde aquele contato nem está. "Agenda e tarefas" sai pela
   * mesma razão.
   *
   * O que sobra é o que um robô de rede social realmente faz: reage a um evento do Instagram,
   * responde, espera, decide, insiste, passa pra uma pessoa e termina.
   */
  social: [
    "instagram",
    "mensagens",
    "aguardar",
    "decisoes",
    "followup",
    "humano",
    "ia",
    "integracoes",
    "encerramento",
  ],
};

/** O grupo aparece nesta área? */
export function grupoValeNaArea(grupo: string, area: AreaAutomacao): boolean {
  return GRUPOS_DA_AREA[area].includes(grupo);
}

/**
 * De que grupo pode vir o GATILHO de cada área.
 *
 * O grupo "Agenda e tarefas" traz ação (criar tarefa, marcar consulta) e gatilho (tarefa vencida,
 * cliente não compareceu) no mesmo saco. A ação é útil nas duas áreas; o gatilho, não: um robô de
 * Instagram não começa porque uma tarefa venceu, começa porque alguém comentou. Sem esta regra, a
 * biblioteca do Instagram oferecia sete gatilhos de agenda que, escolhidos, montariam um robô que
 * nunca dispara — o botão falso que este arquivo existe pra impedir.
 *
 * No comercial não há restrição: lá o gatilho vem de onde fizer sentido.
 */
const GRUPO_DE_GATILHO_DA_AREA: Record<AreaAutomacao, string[] | null> = {
  comercial: null,
  social: ["instagram"],
};

/** O bloco de GATILHO pode ser oferecido nesta área? Ver `GRUPO_DE_GATILHO_DA_AREA`. */
export function grupoDeGatilhoValeNaArea(grupo: string, area: AreaAutomacao): boolean {
  const permitidos = GRUPO_DE_GATILHO_DA_AREA[area];
  return permitidos === null || permitidos.includes(grupo);
}

/** Os canais daquela área que existem de verdade hoje. É o que a tela pode oferecer. */
export function canaisDaArea(area: AreaAutomacao): CapacidadesCanal[] {
  return CANAIS_DA_AREA[area].map((id) => CAPACIDADES[id]).filter((c) => c.disponivel);
}

/**
 * O bloco pode aparecer nesta área?
 *
 * Vale se ALGUM canal disponível da área entrega o recurso. É de propósito que seja "algum" e não
 * "todos": na área comercial a mesma automação atende conexão oficial e QR Code, e o envio já
 * escolhe o melhor formato que a conexão do contato aceita (botão vira menu numerado sozinho).
 * Exigir "todos" apagaria o bloco de botões da área inteira por causa do QR Code, e o oficial
 * perderia um recurso que ele tem.
 */
export function blocoValeNaArea(tipo: FlowNodeType, area: AreaAutomacao): boolean {
  return CANAIS_DA_AREA[area].some((canal) => blocoValeNoCanal(tipo, canal));
}

/**
 * O que dizer sobre um bloco que só funciona em parte dos canais da área.
 *
 * Esconder seria pior: o cliente com conexão oficial perderia o recurso. Mostrar sem dizer nada
 * também: o cliente com QR Code montaria contando com o botão. A saída é mostrar e avisar.
 */
export function ressalvaDoBloco(tipo: FlowNodeType, area: AreaAutomacao): string | null {
  const canais = canaisDaArea(area);
  const suportam = canais.filter((c) => blocoValeNoCanal(tipo, c.id));
  if (!suportam.length || suportam.length === canais.length) return null;
  const nomes = suportam.map((c) => c.label).join(" e ");
  return `Só em ${nomes}. Nas outras conexões desta área o passo sai em texto.`;
}
