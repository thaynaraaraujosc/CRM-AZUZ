/**
 * Registro de todos os blocos disponíveis pra paleta do construtor visual.
 * Um item por `FlowNodeType`. `dataPadrao()` é o `data` inicial de um nó recém
 * arrastado pro canvas (sempre chamada de novo, nunca compartilha objeto entre
 * dois nós soltos na mesma sessão).
 */

import type { FlowNodeCategory, FlowNodeType } from "./types";

/**
 * Onde o bloco aparece NA BIBLIOTECA. Separado de `categoria`, que é a natureza do bloco pro
 * motor e pra cor do nó no canvas.
 *
 * São duas perguntas diferentes e por isso dois campos. `categoria` responde "que tipo de coisa é
 * isto?" (mensagem, ação, espera) e governa cor e comportamento. `grupo` responde "onde a pessoa
 * vai procurar isto?": e a resposta muda: quem quer responder um comentário do Instagram procura
 * em INSTAGRAM, não em "Ações"; quem quer um lembrete de consulta procura em AGENDA, não em
 * "Gatilhos" e "Ações" separados. Com um campo só, a biblioteca ficava organizada pela lógica do
 * programa em vez da lógica de quem usa.
 */
export type GrupoBiblioteca =
  | "gatilhos"
  | "mensagens"
  | "aguardar"
  | "decisoes"
  | "followup"
  | "whatsapp"
  | "whatsapp_oficial"
  | "instagram"
  | "crm"
  | "agenda"
  | "humano"
  | "ia"
  | "integracoes"
  | "encerramento";

export type BlocoDefinicao = {
  tipo: FlowNodeType;
  categoria: FlowNodeCategory;
  grupo: GrupoBiblioteca;
  label: string;
  descricao: string;
  icone: string;
  corClasse: string;
  dataPadrao: () => object;
};

/**
 * Os grupos da biblioteca, na ordem em que aparecem.
 *
 * A ordem não é alfabética nem por quantidade: segue a frase que a pessoa está montando.
 * QUANDO (gatilhos) → FAÇA (mensagens) → AGUARDE → SE (decisões) → e daí os canais e o resto.
 * Quem está construindo lê de cima pra baixo e encontra o próximo passo onde espera encontrar.
 */
export const GRUPOS_BIBLIOTECA: {
  id: GrupoBiblioteca;
  label: string;
  ajuda: string;
  /** Qual cor de categoria representa o grupo. A bolinha do cabeçalho e da barra recolhida. */
  cor: FlowNodeCategory;
}[] = [
  { id: "gatilhos", label: "Gatilhos", ajuda: "Quando a automação começa", cor: "gatilho" },
  { id: "mensagens", label: "Mensagens", ajuda: "O que enviar pro contato", cor: "mensagem" },
  { id: "aguardar", label: "Aguardar", ajuda: "Esperar tempo, resposta ou evento", cor: "espera" },
  { id: "decisoes", label: "Decisões", ajuda: "Separar caminhos conforme o que aconteceu", cor: "condicao" },
  { id: "followup", label: "Follow-up", ajuda: "Insistir com quem não respondeu", cor: "espera" },
  { id: "whatsapp", label: "WhatsApp", ajuda: "Recursos que só existem no WhatsApp", cor: "mensagem" },
  { id: "whatsapp_oficial", label: "WhatsApp Oficial / Meta", ajuda: "Modelos aprovados e janela de 24 horas", cor: "mensagem" },
  { id: "instagram", label: "Instagram", ajuda: "Direct, comentários e stories", cor: "gatilho" },
  { id: "crm", label: "Ações do CRM", ajuda: "Mexer no lead, no funil e no responsável", cor: "acao" },
  { id: "agenda", label: "Agenda e tarefas", ajuda: "Consultas, lembretes e tarefas", cor: "acao" },
  { id: "humano", label: "Atendimento humano", ajuda: "Passar a conversa pra uma pessoa", cor: "humano" },
  { id: "ia", label: "IA", ajuda: "Responder e classificar com inteligência artificial", cor: "integracao" },
  { id: "integracoes", label: "Integrações", ajuda: "Falar com sistemas de fora", cor: "integracao" },
  { id: "encerramento", label: "Encerramento", ajuda: "Terminar o fluxo", cor: "fim" },
];

/** Cor por categoria: usada tanto na paleta quanto no nó desenhado no canvas. */
export const CATEGORIAS_BLOCOS: {
  id: FlowNodeCategory;
  label: string;
  cor: string;
  corClasse: string;
}[] = [
  { id: "gatilho", label: "Gatilhos", cor: "azul", corClasse: "bg-blue-100 text-blue-700" },
  { id: "condicao", label: "Condições", cor: "roxo", corClasse: "bg-purple-100 text-purple-700" },
  { id: "mensagem", label: "Mensagens", cor: "verde", corClasse: "bg-green-100 text-green-700" },
  { id: "espera", label: "Esperas", cor: "laranja", corClasse: "bg-orange-100 text-orange-700" },
  { id: "acao", label: "Ações", cor: "amarelo", corClasse: "bg-yellow-100 text-yellow-800" },
  { id: "humano", label: "Humano", cor: "rosa", corClasse: "bg-pink-100 text-pink-700" },
  { id: "integracao", label: "Integrações", cor: "cinza-azulado", corClasse: "bg-slate-200 text-slate-700" },
  { id: "fim", label: "Encerramento", cor: "vermelho", corClasse: "bg-red-100 text-red-700" },
];

function corDaCategoria(categoria: FlowNodeCategory): string {
  return CATEGORIAS_BLOCOS.find((c) => c.id === categoria)?.corClasse ?? "bg-gray-100 text-gray-700";
}

/**
 * FORA DA BIBLIOTECA, de propósito: gatilhos sem nenhuma fonte que os acione hoje:
 *
 * - `pagamento_aprovado`, `pagamento_pendente`, `pagamento_vencido`: a integração com a Asaas que
 *   existe é da MENSALIDADE DO CRM (o cliente pagando pelo sistema), não dos pagamentos que ele
 *   recebe dos clientes dele. São coisas diferentes, e ligar uma na outra faria a automação
 *   disparar no momento errado.
 * - `comentario_tiktok`: não há integração com o TikTok.
 * - `lead_anuncio`: não há webhook de formulário de anúncio da Meta.
 * - `webhook_recebido`, `integracao_externa`: não existe endereço público que receba esses eventos.
 * - `executar_integracao`: não existe um catálogo de integrações com ações executáveis. "Chamar
 *   webhook" cobre o caso real de falar com um sistema de fora, e esse funciona.
 *
 * O `FlowNodeType` de cada um continua existindo, então fluxo já salvo com eles não quebra. Eles
 * só deixam de ser oferecíveis. Um bloco que nunca dispara é pior que bloco nenhum: a pessoa monta
 * a automação inteira em volta dele e fica esperando, sem nenhum erro na tela.
 */
export const BLOCOS_DISPONIVEIS: BlocoDefinicao[] = [
  // -------------------------------------------------------------- gatilho --
  {
    tipo: "lead_criado",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Lead criado",
    descricao: "Dispara quando um novo contato entra no CRM.",
    icone: "UserPlus",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "lead_entrou_etapa",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Lead entrou na etapa",
    descricao: "Dispara quando o lead entra numa etapa do funil.",
    icone: "LogIn",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ funilId: "", etapaId: "", disparoImediato: true }),
  },
  {
    tipo: "lead_saiu_etapa",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Lead saiu da etapa",
    descricao: "Dispara quando o lead sai de uma etapa do funil.",
    icone: "LogOut",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ funilId: "", etapaId: "", disparoImediato: true }),
  },
  {
    tipo: "lead_parado_etapa",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Lead parado na etapa",
    descricao: "Dispara quando o lead passa um tempo na etapa sem trocar mensagem.",
    icone: "Clock",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ funilId: "", etapaId: "", tempoValor: 2, tempoUnidade: "dias" }),
  },
  {
    tipo: "lead_respondeu",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Lead respondeu",
    descricao: "Dispara quando o lead responde uma mensagem.",
    icone: "MessageSquareReply",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "lead_nao_respondeu",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Lead não respondeu",
    descricao: "Dispara quando a última mensagem da conversa é nossa e o lead não respondeu no prazo.",
    icone: "MessageSquareOff",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ tempoValor: 2, tempoUnidade: "horas" }),
  },
  {
    tipo: "palavra_chave",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Palavra-chave recebida",
    descricao: "Dispara quando a mensagem recebida contém uma palavra-chave.",
    icone: "Hash",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ palavra: "" }),
  },
  {
    tipo: "mensagem_recebida",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Mensagem recebida",
    descricao: "Dispara em qualquer mensagem recebida no canal escolhido.",
    icone: "Inbox",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ canal: "whatsapp" }),
  },
  {
    tipo: "etiqueta_adicionada",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Etiqueta adicionada",
    descricao: "Dispara quando uma etiqueta é adicionada ao contato.",
    icone: "Tag",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ etiquetaNome: "" }),
  },
  {
    tipo: "etiqueta_removida",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Etiqueta removida",
    descricao: "Dispara quando uma etiqueta é removida do contato.",
    icone: "TagOff",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ etiquetaNome: "" }),
  },
  {
    tipo: "campo_alterado",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Campo alterado",
    descricao: "Dispara quando um campo do contato muda de valor.",
    icone: "PencilLine",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ campoNome: "" }),
  },
  {
    tipo: "responsavel_alterado",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Responsável alterado",
    descricao: "Dispara quando o atendente responsável muda.",
    icone: "UserCog",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "tarefa_criada",
    categoria: "gatilho",
    grupo: "agenda",
    label: "Tarefa criada",
    descricao: "Dispara quando uma tarefa é criada pro contato.",
    icone: "ListPlus",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ filtroModo: "qualquer" }),
  },
  {
    tipo: "tarefa_concluida",
    categoria: "gatilho",
    grupo: "agenda",
    label: "Tarefa concluída",
    descricao: "Dispara quando uma tarefa do contato é concluída.",
    icone: "ListChecks",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ filtroModo: "qualquer" }),
  },
  {
    tipo: "tarefa_vencida",
    categoria: "gatilho",
    grupo: "agenda",
    label: "Tarefa vencida",
    descricao: "Dispara quando uma tarefa do contato vence sem ser concluída.",
    icone: "AlarmClockOff",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "consulta_agendada",
    categoria: "gatilho",
    grupo: "agenda",
    label: "Consulta agendada",
    descricao: "Dispara quando uma consulta é agendada.",
    icone: "CalendarPlus",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "consulta_confirmada",
    categoria: "gatilho",
    grupo: "agenda",
    label: "Consulta confirmada",
    descricao: "Dispara quando o lead confirma presença na consulta.",
    icone: "CalendarCheck",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "consulta_cancelada",
    categoria: "gatilho",
    grupo: "agenda",
    label: "Consulta cancelada",
    descricao: "Dispara quando uma consulta é cancelada.",
    icone: "CalendarX",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "cliente_nao_compareceu",
    categoria: "gatilho",
    grupo: "agenda",
    label: "Cliente não compareceu",
    descricao: "Dispara quando o lead falta a uma consulta agendada.",
    icone: "UserX",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "formulario_preenchido",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Formulário preenchido",
    descricao: "Dispara quando o lead preenche um formulário do CRM.",
    icone: "FileText",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "aniversario",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Aniversário do contato",
    descricao: "Dispara na data de nascimento do contato, no horário escolhido.",
    icone: "Cake",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ horario: "09:00" }),
  },
  {
    tipo: "data_personalizada",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Data personalizada",
    descricao: "Dispara uma vez, numa data marcada, pra quem estiver na etapa escolhida.",
    icone: "CalendarClock",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ data: "", horario: "09:00", funilId: "", etapaId: "" }),
  },
  {
    tipo: "horario_programado",
    categoria: "gatilho",
    grupo: "gatilhos",
    label: "Horário programado",
    descricao: "Dispara todo dia (ou nos dias escolhidos) num horário fixo, pra quem estiver na etapa.",
    icone: "Timer",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ horario: "09:00", funilId: "", etapaId: "" }),
  },
  /*
   * ------------------------------------------------------------- instagram --
   *
   * O Instagram não é um WhatsApp com outro nome, e este grupo é escrito assim de propósito.
   *
   * No WhatsApp existe uma coisa só que acontece: chegou mensagem. Por isso o gatilho de lá é
   * genérico e o resto é filtro. No Instagram o que acontece tem NOME: a pessoa comentou num reel,
   * respondeu um story, mencionou o perfil, reagiu a uma mensagem, encaminhou uma publicação.
   * Cada um desses é um momento diferente, com uma resposta diferente e um valor diferente.
   * Amontoar tudo em "mensagem recebida" perde justamente a informação que faz a automação social
   * valer a pena.
   *
   * Por isso a ordem aqui é a do EVENTO, não a alfabética, e está agrupada por onde acontece:
   * primeiro o Direct, depois a publicação, depois o perfil. É a ordem em que a pessoa pensa
   * quando vai montar o robô ("quando alguém me responder um story…").
   *
   * O rótulo não repete "(Instagram)". Nesta área não existe outro canal: o sufixo só ocupava
   * espaço e empurrava o nome do evento pra fora do card.
   */

  // --- no Direct ---
  {
    tipo: "instagram_direct_recebido",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Mensagem no Direct",
    descricao:
      "Dispara quando chega uma mensagem de texto no Direct. Sem palavra configurada, qualquer mensagem serve.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({
      canal: "Instagram",
      palavras: [] as string[],
      modoPalavra: "qualquer",
      ignorarAcentos: true,
    }),
  },
  {
    tipo: "instagram_story_respondido",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Resposta a um story seu",
    descricao:
      "Dispara quando alguém responde um story seu. A resposta chega no Direct, e é a pessoa mais quente que o Instagram entrega.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({
      canal: "Instagram",
      palavras: [] as string[],
      modoPalavra: "qualquer",
      ignorarAcentos: true,
    }),
  },
  {
    tipo: "instagram_midia_recebida",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Foto, vídeo ou áudio no Direct",
    descricao: "Dispara quando a pessoa manda mídia em vez de texto. Não tem palavra pra filtrar.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ canal: "Instagram" }),
  },
  {
    tipo: "instagram_publicacao_compartilhada",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Publicação encaminhada pra você",
    descricao:
      "Dispara quando a pessoa encaminha uma publicação ou reel pelo Direct. Costuma vir com uma pergunta junto.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ canal: "Instagram" }),
  },
  {
    tipo: "instagram_reacao_recebida",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Reação a uma mensagem sua",
    descricao:
      "Dispara quando alguém reage com emoji a uma mensagem sua no Direct. É sinal de leitura, não de resposta.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ canal: "Instagram" }),
  },

  // --- na publicação ---
  {
    tipo: "comentario_instagram",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Comentário numa publicação",
    descricao:
      "Dispara quando alguém comenta num post ou reel. Dá pra filtrar por palavra e restringir a uma publicação.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    // `palavras` vazio = qualquer comentário dispara. `publicacaoId` vazio = qualquer publicação.
    // "qualquer" compara palavra inteira: uma automação de "quero" não deve disparar em "não quero".
    dataPadrao: () => ({
      canal: "Instagram",
      palavras: [] as string[],
      modoPalavra: "qualquer",
      ignorarAcentos: true,
      publicacaoId: "",
    }),
  },
  {
    tipo: "instagram_resposta_comentario",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Resposta a um comentário",
    descricao: "Dispara quando alguém responde a um comentário já existente na sua publicação.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({
      canal: "Instagram",
      palavras: [] as string[],
      modoPalavra: "qualquer",
      ignorarAcentos: true,
      publicacaoId: "",
    }),
  },

  // --- no perfil ---
  {
    tipo: "instagram_mencao_story",
    categoria: "gatilho",
    grupo: "instagram",
    label: "Menção do seu perfil num story",
    descricao: "Dispara quando alguém marca seu @ num story. Serve pra agradecer ou repostar na hora.",
    icone: "Instagram",
    corClasse: corDaCategoria("gatilho"),
    dataPadrao: () => ({ canal: "Instagram" }),
  },

  // ------------------------------------------------------------- condicao --
  {
    tipo: "condicao_grupo",
    categoria: "condicao",
    grupo: "decisoes",
    // "Condição atendida / não atendida" é linguagem de programa. Quem monta a automação está
    // decidindo um caminho, e o nome do bloco passa a dizer isso.
    label: "Decisão: sim ou não",
    descricao: "Verifica uma informação do lead e separa em dois caminhos: sim e não.",
    icone: "GitBranch",
    corClasse: corDaCategoria("condicao"),
    dataPadrao: () => ({ grupo: { id: `grupo-${Date.now()}`, tipo: "E", regras: [], subgrupos: [] } }),
  },
  {
    tipo: "decisao_multipla",
    categoria: "condicao",
    grupo: "decisoes",
    label: "Decisão: vários caminhos",
    descricao: "Uma pergunta, quantas respostas você precisar. Cada resposta vira uma saída do bloco.",
    icone: "GitBranch",
    corClasse: corDaCategoria("condicao"),
    dataPadrao: () => ({
      // Nasce com a decisão mais comum já montada. Responder um menu numerado. Bloco novo em
      // branco obriga a pessoa a adivinhar o formato antes de conseguir experimentar.
      campo: "mensagem",
      operador: "igual",
      caminhos: [
        { id: `cam-${Date.now()}-1`, rotulo: "Opção 1", valor: "1" },
        { id: `cam-${Date.now()}-2`, rotulo: "Opção 2", valor: "2" },
      ],
    }),
  },

  // ------------------------------------------------------------- mensagem --
  {
    tipo: "mensagem_texto",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar texto",
    descricao: "Envia uma mensagem de texto simples.",
    icone: "MessageSquare",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ canal: "whatsapp", texto: "" }),
  },
  {
    tipo: "mensagem_imagem",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar imagem",
    descricao: "Envia uma imagem com legenda opcional.",
    icone: "Image",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ canal: "whatsapp" }),
  },
  {
    tipo: "mensagem_video",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar vídeo",
    descricao: "Envia um vídeo com legenda opcional.",
    icone: "Video",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ canal: "whatsapp" }),
  },
  {
    tipo: "mensagem_audio",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar áudio",
    descricao: "Envia um áudio gravado ou escolhido.",
    icone: "Mic",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ canal: "whatsapp" }),
  },
  {
    tipo: "mensagem_documento",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar documento",
    descricao: "Envia um arquivo (PDF, etc).",
    icone: "FileText",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ canal: "whatsapp" }),
  },
  {
    tipo: "mensagem_contato",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar contato",
    descricao: "Envia um cartão de contato.",
    icone: "Contact",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({
      origemContato: "atual",
      camposCompartilhados: ["nome", "telefone", "email"],
      destinoModo: "conversa_atual",
    }),
  },
  {
    tipo: "mensagem_localizacao",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar localização",
    descricao: "Envia uma localização (endereço da clínica, etc).",
    icone: "MapPin",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ origem: "salva" }),
  },
  {
    tipo: "mensagem_botoes",
    categoria: "mensagem",
    grupo: "whatsapp",
    label: "Mensagem com botões",
    descricao: "Envia texto com opções de resposta em botões. Ramifica o fluxo.",
    icone: "ListTodo",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ canal: "whatsapp", texto: "", opcoes: [] }),
  },
  {
    tipo: "mensagem_lista",
    categoria: "mensagem",
    grupo: "whatsapp",
    label: "Mensagem com lista",
    descricao: "Envia texto com opções de resposta em lista. Ramifica o fluxo.",
    icone: "List",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ canal: "whatsapp", texto: "", opcoes: [] }),
  },
  {
    tipo: "mensagem_modelo_whatsapp",
    categoria: "mensagem",
    grupo: "whatsapp_oficial",
    label: "Modelo aprovado do WhatsApp",
    descricao: "Envia um template pré-aprovado da API oficial do WhatsApp.",
    icone: "FileCheck",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ templateId: "" }),
  },
  {
    tipo: "mensagem_email",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar e-mail",
    descricao: "Envia um e-mail pro contato.",
    icone: "Mail",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({
      destinatarioModo: "contato_email",
      remetente: "",
      assunto: "",
      corpo: "",
      quandoModo: "imediato",
      seSemEmail: "continuar",
    }),
  },
  {
    tipo: "notificacao_interna",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Notificação interna",
    descricao: "Notifica alguém da equipe dentro do CRM.",
    icone: "BellRing",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ mensagem: "" }),
  },
  {
    tipo: "enviar_formulario",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Enviar formulário",
    descricao: "Envia um formulário interno do CRM ou um link externo.",
    icone: "ClipboardList",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ formularioOrigem: "interno" }),
  },

  // --------------------------------------------------------------- espera --
  {
    tipo: "aguardar",
    categoria: "espera",
    grupo: "aguardar",
    label: "Aguardar",
    descricao: "Pausa o fluxo por um tempo ou até uma condição acontecer.",
    icone: "Clock3",
    corClasse: corDaCategoria("espera"),
    dataPadrao: () => ({ modo: "horas", valor: 1 }),
  },

  // ----------------------------------------------------------------- acao --
  {
    tipo: "adicionar_etiqueta",
    categoria: "acao",
    grupo: "crm",
    label: "Adicionar etiqueta",
    descricao: "Adiciona uma etiqueta ao contato.",
    icone: "TagPlus",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ etiquetaNome: "" }),
  },
  {
    tipo: "remover_etiqueta",
    categoria: "acao",
    grupo: "crm",
    label: "Remover etiqueta",
    descricao: "Remove uma etiqueta do contato.",
    icone: "TagMinus",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ etiquetaNome: "" }),
  },
  {
    tipo: "alterar_etapa",
    categoria: "acao",
    grupo: "crm",
    label: "Mover pra outra etapa",
    descricao: "Move o lead pra outra etapa do mesmo funil.",
    icone: "MoveRight",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ funilId: "", etapaTitulo: "" }),
  },
  {
    tipo: "alterar_funil",
    categoria: "acao",
    grupo: "crm",
    label: "Mover pra outro funil",
    descricao: "Move o lead pra outro funil.",
    icone: "Shuffle",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ funilId: "" }),
  },
  {
    tipo: "alterar_responsavel",
    categoria: "acao",
    grupo: "crm",
    label: "Atribuir responsável",
    descricao: "Atribui o lead a um atendente da equipe.",
    icone: "UserCheck",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ atendenteNome: "" }),
  },
  {
    tipo: "encaminhar_equipe",
    categoria: "acao",
    grupo: "crm",
    label: "Encaminhar pra equipe",
    descricao: "Encaminha o atendimento pra uma equipe/fila.",
    icone: "Users",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ equipeNome: "" }),
  },
  {
    tipo: "distribuir_disponibilidade",
    categoria: "acao",
    grupo: "crm",
    label: "Distribuir por disponibilidade",
    descricao: "Distribui o lead entre atendentes disponíveis.",
    icone: "Split",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ modo: "round_robin", equipeNome: "" }),
  },
  {
    tipo: "criar_tarefa",
    categoria: "acao",
    grupo: "agenda",
    label: "Criar tarefa",
    descricao: "Cria uma tarefa com prazo pro time.",
    icone: "ListPlus",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({
      categoria: "Follow-up",
      titulo: "",
      modoResponsavel: "atual",
      modoPrazo: "depois_de",
      prazoValor: 2,
      prazoUnidade: "horas",
      prioridade: "normal",
      relacionarA: "contato",
    }),
  },
  {
    tipo: "criar_lembrete",
    categoria: "acao",
    grupo: "agenda",
    label: "Criar lembrete",
    descricao: "Cria um lembrete de follow-up.",
    icone: "BellPlus",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ titulo: "" }),
  },
  {
    tipo: "atualizar_campo",
    categoria: "acao",
    grupo: "crm",
    label: "Atualizar campo do contato",
    descricao: "Grava um valor num campo do contato.",
    icone: "PencilLine",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ campoNome: "", valor: "" }),
  },
  {
    tipo: "criar_negocio",
    categoria: "acao",
    grupo: "crm",
    label: "Criar negócio",
    descricao: "Cria um novo card de negócio pro contato.",
    icone: "BriefcaseBusiness",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ nome: "", funilId: "", etapaTitulo: "", valor: "" }),
  },
  {
    tipo: "atualizar_valor",
    categoria: "acao",
    grupo: "crm",
    label: "Atualizar valor do negócio",
    descricao: "Atualiza o valor do negócio do contato.",
    icone: "DollarSign",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ modo: "definir", valor: "" }),
  },
  {
    tipo: "atualizar_status",
    categoria: "acao",
    grupo: "crm",
    label: "Atualizar status",
    descricao: "Atualiza o status do contato/negócio.",
    icone: "Flag",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ status: "" }),
  },
  {
    tipo: "agendar_consulta",
    categoria: "acao",
    grupo: "agenda",
    label: "Agendar consulta",
    descricao: "Agenda uma consulta pro contato.",
    icone: "CalendarPlus",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ data: "", horario: "", profissional: "", tipoServico: "" }),
  },
  {
    tipo: "cancelar_agendamento",
    categoria: "acao",
    grupo: "agenda",
    label: "Cancelar agendamento",
    descricao: "Cancela um agendamento existente do contato.",
    icone: "CalendarX",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ criterio: "proximo", enviarMensagem: false, quandoModo: "imediato" }),
  },
  {
    tipo: "enviar_notificacao",
    categoria: "acao",
    grupo: "crm",
    label: "Enviar notificação",
    descricao: "Envia uma notificação interna pra equipe.",
    icone: "Bell",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ mensagem: "" }),
  },
  {
    tipo: "reagir_mensagem",
    categoria: "mensagem",
    grupo: "mensagens",
    label: "Reagir à mensagem",
    descricao: "Responde com um emoji na última mensagem que o contato mandou.",
    icone: "Heart",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ emoji: "❤️" }),
  },
  {
    tipo: "nota_interna",
    categoria: "acao",
    grupo: "crm",
    label: "Adicionar nota ao lead",
    descricao: "Registra uma anotação no histórico. O cliente não recebe nada.",
    icone: "StickyNote",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ texto: "" }),
  },
  {
    tipo: "executar_robo",
    categoria: "acao",
    grupo: "crm",
    label: "Executar outro robô",
    descricao: "Começa outra automação pro mesmo contato e segue daqui.",
    icone: "Bot",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "pausar_automacoes",
    categoria: "acao",
    grupo: "crm",
    label: "Pausar automações do contato",
    descricao: "Pausa outras automações rodando pro mesmo contato.",
    icone: "Pause",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "cancelar_automacoes",
    categoria: "acao",
    grupo: "crm",
    label: "Cancelar automações do contato",
    descricao: "Cancela outras automações rodando pro mesmo contato.",
    icone: "X",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "chamar_webhook",
    categoria: "acao",
    grupo: "integracoes",
    label: "Chamar webhook",
    descricao: "Envia dados pra uma URL externa, com três tentativas se ela estiver fora do ar.",
    icone: "Webhook",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ url: "" }),
  },
  {
    tipo: "ia_responder",
    categoria: "mensagem",
    grupo: "ia",
    label: "Responder com IA",
    descricao: "A IA lê a conversa e responde seguindo a sua instrução. Sem IA configurada, o bloco avisa e não inventa resposta.",
    icone: "Sparkles",
    corClasse: corDaCategoria("mensagem"),
    dataPadrao: () => ({ instrucao: "", contexto: "", maximoCaracteres: 400 }),
  },
  {
    tipo: "ia_classificar",
    categoria: "condicao",
    grupo: "ia",
    label: "Classificar com IA",
    descricao: "Lê a última mensagem e escolhe uma categoria. Cada categoria é uma saída do bloco.",
    icone: "Sparkles",
    corClasse: corDaCategoria("condicao"),
    dataPadrao: () => ({ instrucao: "", categorias: ["dúvida", "orçamento", "reclamação"] }),
  },

  // --------------------------------------------------------------- humano --
  {
    tipo: "encaminhar_humano",
    categoria: "humano",
    grupo: "humano",
    label: "Encaminhar pra atendimento humano",
    descricao: "Tira o contato do fluxo automático e passa pra um atendente.",
    icone: "Headset",
    corClasse: corDaCategoria("humano"),
    dataPadrao: () => ({ destino: "atendente", moverFunil: false, quandoModo: "imediato" }),
  },

  // ------------------------------------------------------------------ fim --
  {
    tipo: "responder_comentario_instagram",
    categoria: "acao",
    grupo: "instagram",
    label: "Responder o comentário",
    descricao:
      "Responde publicamente, embaixo do comentário que disparou a automação. Todo mundo vê, e é o que faz a publicação continuar viva.",
    icone: "Instagram",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({ texto: "" }),
  },
  {
    tipo: "ocultar_comentario_instagram",
    categoria: "acao",
    grupo: "instagram",
    label: "Ocultar o comentário",
    descricao: "Esconde o comentário da publicação, sem avisar quem escreveu. É o que se faz com spam.",
    icone: "EyeOff",
    corClasse: corDaCategoria("acao"),
    dataPadrao: () => ({}),
  },
  {
    tipo: "encerrar_fluxo",
    categoria: "fim",
    grupo: "encerramento",
    label: "Encerrar fluxo",
    descricao: "Termina a execução desse caminho do fluxo.",
    icone: "OctagonX",
    corClasse: corDaCategoria("fim"),
    dataPadrao: () => ({}),
  },
];

/** Checagem em tempo de compilação: todo `FlowNodeType` precisa ter uma entrada aqui. */
type TiposFaltando = Exclude<FlowNodeType, (typeof BLOCOS_DISPONIVEIS)[number]["tipo"]>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _blocosCobremTodosOsTipos: TiposFaltando extends never ? true : never = true;

export function buscarBlocos(query: string): BlocoDefinicao[] {
  const termo = query.trim().toLowerCase();
  if (!termo) return BLOCOS_DISPONIVEIS;
  return BLOCOS_DISPONIVEIS.filter(
    (b) =>
      b.label.toLowerCase().includes(termo) ||
      b.descricao.toLowerCase().includes(termo) ||
      b.tipo.toLowerCase().includes(termo),
  );
}
