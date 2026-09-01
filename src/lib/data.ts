/**
 * Dados fictícios do CRM AZUZ — não é usado como fonte real de nome/segmento do workspace (isso
 * vem de `Workspace.nome`/`segmento` no banco, ver `src/app/api/workspace/route.ts`); serve só de
 * exemplo/seed pra telas ainda não conectadas e pro `prisma/seed.ts` de desenvolvimento local.
 *
 * Os números são consistentes entre as telas de propósito:
 *   julho/2026 · 247 leads · 143 qualificados · 36 fechados · 14,6% de conversão
 *   R$ 38.400 vendidos no CRM · R$ 3.200 investidos em anúncios · ROAS 4,2x
 *   84 leads e R$ 13.440 de receita vieram do tráfego pago
 */

export const workspace = {
  name: "Empresa Demo",
  slug: "empresa-demo",
  segment: "Serviços",
  email: "contato@empresademo.com.br",
};

export const currentUser = {
  name: "Ana Ferreira",
  initials: "AF",
  role: "Gestora de tráfego",
  email: "ana@empresademo.com.br",
};

/** Quinta, 30 de julho de 2026 — dia de referência de todas as telas. */
export const today = "Quinta, 30 de julho de 2026";

export type Canal = "WhatsApp" | "Instagram" | "TikTok";
export type Etapa = "Novo" | "Qualificado" | "Proposta" | "Fechado";
export type Origem =
  | "Meta Ads"
  | "Google Ads"
  | "Instagram"
  | "TikTok"
  | "Indicação"
  | "Formulário";

export const ORIGENS: Origem[] = [
  "Meta Ads",
  "Google Ads",
  "Instagram",
  "TikTok",
  "Indicação",
  "Formulário",
];

/** Classe CSS que pinta a nomenclatura da origem com a cor da própria plataforma. */
/** Aceita `string` (não só `Origem`) porque `Conversa.origem`/`NegocioCard.origem` reais vêm do
 * banco como texto livre (ex.: `"Direto"`, `"WhatsApp"`) — fora do conjunto fechado usado nos
 * filtros de Contatos. Valor fora da lista conhecida cai no fallback, sem quebrar o card. */
export function classeOrigem(origem: string): string {
  switch (origem) {
    case "Meta Ads":
      return "origem-meta";
    case "Google Ads":
      return "origem-google";
    case "Instagram":
      return "origem-instagram";
    case "TikTok":
      return "origem-tiktok";
    case "Indicação":
      return "origem-indicacao";
    case "Formulário":
      return "origem-formulario";
    default:
      return "origem-outro";
  }
}

/* -------------------------------------------------------------------------- */
/* Início                                                                     */
/* -------------------------------------------------------------------------- */

export const kpisInicio = [
  { label: "Leads no mês", value: "247", delta: "↑ 18% vs. junho" },
  { label: "Taxa de conversão", value: "14,6%", delta: "↑ 2,1 pts" },
  { label: "Vendas no mês", value: "R$ 38.400", delta: "↑ 9% vs. junho" },
  { label: "ROAS médio", value: "4,2x", delta: "↑ 0,4x" },
];

/** Leads por dia — últimos 14 dias (17 a 30 de julho). */
export const leadsPorDia = [
  { dia: "17", altura: 38 },
  { dia: "18", altura: 52 },
  { dia: "19", altura: 44 },
  { dia: "20", altura: 66 },
  { dia: "21", altura: 58 },
  { dia: "22", altura: 30 },
  { dia: "23", altura: 34 },
  { dia: "24", altura: 70 },
  { dia: "25", altura: 62 },
  { dia: "26", altura: 48 },
  { dia: "27", altura: 55 },
  { dia: "28", altura: 40 },
  { dia: "29", altura: 60 },
  { dia: "30", altura: 84, hoje: true },
];

export const funilJulho = [
  { etapa: "Novo", total: 247, largura: 100 },
  { etapa: "Qualificado", total: 143, largura: 58 },
  { etapa: "Proposta", total: 59, largura: 24 },
  { etapa: "Fechado", total: 36, largura: 15 },
];

export const atividadeRecente = [
  {
    initials: "MA",
    nome: "Marcos Aurélio",
    meta: "Respondeu no WhatsApp · há 6 min",
    pill: "Qualificado",
    destaque: true,
  },
  {
    initials: "BN",
    nome: "Beatriz Nogueira",
    meta: "Entrou via Google Ads · há 21 min",
    pill: "Qualificado",
    destaque: true,
  },
  {
    initials: "PL",
    nome: "Paulo Lacerda",
    meta: "Fechou negócio de R$ 1.560 · há 2h",
    pill: "Fechado",
    destaque: true,
  },
  {
    initials: "JP",
    nome: "Julia Prado",
    meta: "Proposta parada há 4 dias",
    pill: "Follow-up",
    destaque: false,
  },
];

/* -------------------------------------------------------------------------- */
/* Contatos                                                                   */
/* -------------------------------------------------------------------------- */

export type Contato = {
  /**
   * Identificador estável do contato — mesmo slug usado como `id` em
   * `NegocioCard`, `Conversa` e `TaskCard`, pra todo módulo poder cruzar
   * essas entidades sem depender de comparar `nome` (string).
   * Ver `slugId()` em `src/lib/ids.ts`.
   */
  id: string;
  initials: string;
  nome: string;
  origem: Origem;
  etapa: Etapa;
  responsavel: string;
  ultima: string;
  valor: string;
  email?: string;
  whatsapp?: string;
  nascimento?: string;
  endereco?: string;
  /** Campos abaixo alimentam o seletor de contatos e a aba "Contato" do painel — front-end apenas, prontos pro back-end preencher de verdade. */
  sobrenome?: string;
  empresa?: string;
  cargo?: string;
  telefoneFixo?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  canalPreferido?: Canal;
  melhorHorario?: string;
  /** @ do Instagram (sem arroba) — preenchido sozinho quando a pessoa chega pelo Direct. */
  instagram?: string;
  etiquetas?: string[];
  favorito?: boolean;
};

export const contatos: Contato[] = [
  {
    id: "marcos-aurelio",
    initials: "MA",
    nome: "Marcos Aurélio",
    origem: "Meta Ads",
    etapa: "Qualificado",
    responsavel: "Dr. Hélio Marinho",
    ultima: "Há 6 min",
    valor: "R$ 890",
    email: "marcos.aurelio@gmail.com",
    whatsapp: "(62) 9XXXX-XXXX",
    nascimento: "14/03/1985",
    endereco: "Goiânia, GO",
    sobrenome: "Aurélio",
    cidade: "Goiânia",
    estado: "GO",
    pais: "Brasil",
    canalPreferido: "WhatsApp",
    etiquetas: ["Quente", "Prioridade"],
    favorito: true,
  },
  {
    id: "beatriz-nogueira",
    initials: "BN",
    nome: "Beatriz Nogueira",
    origem: "Google Ads",
    etapa: "Qualificado",
    responsavel: "Bruno Salles",
    ultima: "Há 21 min",
    valor: "R$ 1.240",
    empresa: "Studio Beatriz Estética",
    cargo: "Proprietária",
    etiquetas: ["Empresa"],
  },
  {
    id: "camila-duarte",
    initials: "CD",
    nome: "Camila Duarte",
    origem: "Instagram",
    etapa: "Novo",
    responsavel: "Ana Ferreira",
    ultima: "Há 14 min",
    valor: "—",
    etiquetas: ["Novo lead"],
    favorito: true,
  },
  {
    id: "fernando-lima",
    initials: "FL",
    nome: "Fernando Lima",
    origem: "Meta Ads",
    etapa: "Novo",
    responsavel: "Ana Ferreira",
    ultima: "Há 6 min",
    valor: "—",
  },
  {
    id: "julia-prado",
    initials: "JP",
    nome: "Julia Prado",
    origem: "Indicação",
    etapa: "Proposta",
    responsavel: "Bruno Salles",
    ultima: "Há 4 dias",
    valor: "R$ 2.100",
  },
  {
    id: "renata-farias",
    initials: "RF",
    nome: "Renata Farias",
    origem: "Meta Ads",
    etapa: "Proposta",
    responsavel: "Bruno Salles",
    ultima: "Há 1h",
    valor: "R$ 780",
  },
  {
    id: "paulo-lacerda",
    initials: "PL",
    nome: "Paulo Lacerda",
    origem: "Google Ads",
    etapa: "Fechado",
    responsavel: "Bruno Salles",
    ultima: "Há 2h",
    valor: "R$ 1.560",
  },
  {
    id: "lorena-bastos",
    initials: "LB",
    nome: "Lorena Bastos",
    origem: "TikTok",
    etapa: "Novo",
    responsavel: "—",
    ultima: "Há 31 min",
    valor: "—",
  },
];

export const filtrosContatos = [
  "Todos",
  "Meus leads",
  "Meta Ads",
  "Google Ads",
  "Instagram",
  "TikTok",
  "Indicação",
];

/* -------------------------------------------------------------------------- */
/* Funil (kanban de negócios — pode ter mais de um funil)                    */
/* -------------------------------------------------------------------------- */

export type NegocioCard = {
  id: string;
  nome: string;
  valor: string;
  origem: Origem;
  dias: string;
  /** Data em que o lead entrou nesse negócio, formato ISO (aaaa-mm-dd). */
  data: string;
  /** Etiquetas adicionadas manualmente ou por automação (ex.: "adicionar_etiqueta"). */
  etiquetas?: string[];
  /** Responsável por esse negócio específico — distinto de `Funil.responsavel` (que é o funil inteiro). */
  responsavel?: string;
  /** Desfecho real do negócio — `undefined`/`null` = ainda aberto. É o que faz Inteligência
   * Comercial (conversão, motivo de perda, faturamento) calcular sobre dado real. */
  statusFechamento?: "ganho" | "perdido" | null;
  motivoPerda?: string | null;
  /** ISO (aaaa-mm-dd) — quando o negócio foi marcado como ganho/perdido. */
  dataFechamento?: string | null;
};

export type ColunaFunil = {
  /** Identificador estável da etapa — é nele que a automação se prende, não no título (que pode ser renomeado). */
  id: string;
  titulo: string;
  total: number;
  cards: NegocioCard[];
};

export type Funil = {
  id: string;
  nome: string;
  colunas: ColunaFunil[];
  /** Atendente responsável por esse funil — quem recebe as conversas/tarefas atribuídas a ele. */
  responsavel?: string;
};

/** Modelo pré-pronto usado ao criar um funil novo. */
export const ETAPAS_PADRAO_FUNIL = [
  "Novo",
  "Qualificado",
  "Não respondeu",
  "Proposta",
  "Fechado",
];

export const funis: Funil[] = [
  {
    id: "funil-principal",
    nome: "Funil principal",
    colunas: [
      {
        id: "novo",
        titulo: "Novo",
        total: 32,
        cards: [
          {
            id: "camila-duarte",
            nome: "Camila Duarte",
            valor: "—",
            origem: "Instagram",
            dias: "Hoje",
            data: "2026-07-30",
          },
          {
            id: "lorena-bastos",
            nome: "Lorena Bastos",
            valor: "—",
            origem: "TikTok",
            dias: "Hoje",
            data: "2026-07-30",
          },
          {
            id: "fernando-lima",
            nome: "Fernando Lima",
            valor: "—",
            origem: "Meta Ads",
            dias: "1 dia",
            data: "2026-07-29",
          },
        ],
      },
      {
        id: "qualificado",
        titulo: "Qualificado",
        total: 18,
        cards: [
          {
            id: "marcos-aurelio",
            nome: "Marcos Aurélio",
            valor: "R$ 890",
            origem: "Meta Ads",
            dias: "2 dias",
            data: "2026-07-28",
          },
          {
            id: "beatriz-nogueira",
            nome: "Beatriz Nogueira",
            valor: "R$ 1.240",
            origem: "Google Ads",
            dias: "1 dia",
            data: "2026-07-29",
          },
        ],
      },
      {
        id: "proposta",
        titulo: "Proposta",
        total: 7,
        cards: [
          {
            id: "julia-prado",
            nome: "Julia Prado",
            valor: "R$ 2.100",
            origem: "Indicação",
            dias: "4 dias",
            data: "2026-07-26",
          },
          {
            id: "renata-farias",
            nome: "Renata Farias",
            valor: "R$ 780",
            origem: "Meta Ads",
            dias: "1 dia",
            data: "2026-07-29",
          },
        ],
      },
      {
        id: "fechado",
        titulo: "Fechado · 7 dias",
        total: 5,
        cards: [
          {
            id: "paulo-lacerda",
            nome: "Paulo Lacerda",
            valor: "R$ 1.560",
            origem: "Google Ads",
            dias: "Hoje",
            data: "2026-07-30",
          },
        ],
      },
    ],
  },
];

/**
 * Onde um contato está de verdade no funil — busca direto nos cards do
 * funil (mesma fonte que a tela Funil usa), pra nunca dessincronizar da
 * etapa mostrada em Contatos. É essa etapa que a automação usa pra decidir
 * a próxima ação.
 */
export function localizarNoFunil(
  nomeContato: string,
): { funil: string; etapa: string } | null {
  for (const f of funis) {
    for (const coluna of f.colunas) {
      if (coluna.cards.some((c) => c.nome === nomeContato)) {
        return { funil: f.nome, etapa: coluna.titulo };
      }
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* WhatsApp (conversas)                                                       */
/* -------------------------------------------------------------------------- */

export type ConvStatus =
  | "Não respondido"
  | "Em conversa"
  | "Aguardando cliente"
  | "Finalizado";

/**
 * Estado real de entrega de uma mensagem enviada (tipo "out"), como reportado
 * pelo canal — nunca é ajustado manualmente pelo usuário.
 * "pendente" = ainda subindo/enviando · "enviado" = saiu do CRM · "entregue" =
 * chegou no aparelho do lead · "lido" = o lead abriu a conversa · "erro" = falhou.
 */
/**
 * "reproduzido" só existe pra mensagens de áudio, e só pode ser aplicado por
 * uma confirmação real do canal/webhook — nunca simulado automaticamente
 * (ver contrato `AudioAnexoContrato` e `ExclusaoMensagemContrato` em
 * `src/lib/conversas-contracts.ts`).
 */
export type StatusMensagem =
  | "pendente"
  | "enviado"
  | "entregue"
  | "lido"
  | "reproduzido"
  | "erro";

export type AnexoImagem = { url: string; nome: string; tamanho: number };
export type AnexoVideo = {
  url: string;
  nome: string;
  tamanho: number;
  duracao?: number;
  comAudio: boolean;
};
export type AnexoDocumento = {
  url: string;
  nome: string;
  tamanho: number;
  formato: string;
  origem: "crm" | "computador";
};
/** Ver `AudioAnexoContrato` em `src/lib/conversas-contracts.ts` pro contrato completo de back-end. */
export type AnexoAudio = {
  url: string;
  duracao: number;
  /** Picos de amplitude (0–1) usados pra desenhar a forma de onda — calculados no front-end a partir do blob gravado ou decodificado. */
  waveform: number[];
};

/** Tipo de exclusão solicitada — ver `ExclusaoMensagemContrato`. */
export type TipoExclusaoMensagem = "para_mim" | "para_todos";

export type ConvMensagem = {
  id?: string;
  tipo: "in" | "out" | "system";
  texto: string;
  hora: string;
  /** Timestamp real de criação — usado pra calcular prazo de "apagar pra todos" e pra "Ver detalhes". Ausente em mensagens de exemplo (seed). */
  criadoEm?: number;
  /** Presente quando a mensagem é um compartilhamento de localização — mostra um mapa em vez de só texto. */
  localizacao?: { lat: number; lng: number; endereco?: string };
  /**
   * Presente quando a mensagem é um cartão de contato compartilhado — só
   * carrega os campos que o usuário escolheu incluir na prévia (ver seção
   * 19 do pedido e `ContatoCompartilhadoContrato` em
   * `src/lib/conversas-contracts.ts`).
   */
  contatoCompartilhado?: {
    nome: string;
    initials: string;
    whatsapp?: string;
    telefoneFixo?: string;
    email?: string;
    empresa?: string;
    cargo?: string;
  };
  /** Uma ou mais imagens reais anexadas — vira um balão com a imagem de verdade, não só o nome do arquivo. */
  imagens?: AnexoImagem[];
  /** Vídeo real anexado (já cortado/processado, se o usuário editou antes de enviar). */
  video?: AnexoVideo;
  /** Documento real anexado — vindo da biblioteca do CRM ou do computador do usuário. */
  documento?: AnexoDocumento;
  /** Áudio real gravado/enviado — bolha com player, forma de onda e velocidade. */
  audio?: AnexoAudio;
  /** Legenda opcional que acompanha imagem/vídeo. */
  legenda?: string;
  /** @ de quem compartilhou o conteúdo, mostrado no topo do cartão de publicação — como o Instagram
   * faz. Só existe em conteúdo compartilhado (post, reel, story), não em mídia enviada direto. */
  compartilhadoPor?: string;
  /** Legenda da publicação compartilhada (a do post, não a da mensagem) — mostrada abaixo da
   * prévia, cortada, como o Instagram faz. Só existe quando a Meta a envia. */
  legendaPublicacao?: string;
  /** `true` quando `linkExterno` aponta pra CONVERSA no Instagram, não pra publicação — a Meta nem
   * sempre manda o endereço do post. Serve pra o botão não prometer o que não vai cumprir. */
  linkEhConversa?: boolean;
  /** Endereço da publicação original, quando a mensagem é um conteúdo que vive fora do CRM (post,
   * reel ou story compartilhado no Direct). Clicar na prévia leva pra lá — o arquivo continua no
   * Instagram; o CRM guarda só a miniatura pra dar contexto na conversa. */
  linkExterno?: string;
  /** Presente quando o usuário respondeu a uma mensagem específica — mostra a citação em cima do
   * texto. `mid` é o id da mensagem citada no canal de origem: é ele que faz a citação aparecer
   * também do lado da pessoa (hoje usado no Direct do Instagram, via `reply_to`). */
  respondendoA?: { autor: string; texto: string; mid?: string };
  /** "Reel" | "Publicação" | "Story" | "Carrossel" — etiqueta do que o conteúdo é, quando a Meta
   * declara o tipo. Sem ela, prévia de reel e foto comum ficam idênticas na conversa. */
  tipoConteudo?: string;
  /** Curtida do Instagram nessa mensagem. Cada lado tem a sua: `reacaoContato` é o coração que a
   * pessoa do outro lado deu, `reacaoMinha` é o que saiu daqui (ou do app do Instagram, pela conta
   * conectada). Ficam separadas porque as duas podem existir na MESMA mensagem — sobrescrever uma
   * com a outra apagaria da tela a curtida da cliente, que é justamente o que se quer ver. */
  reacaoContato?: string;
  reacaoMinha?: string;
  /** Só existe em mensagens "out" — o estado real reportado pelo canal. */
  status?: StatusMensagem;
  /** Motivo do erro, quando status === "erro" — mostrado com a opção de tentar de novo. */
  erro?: string;
  /** Canal de origem/destino real da mensagem (ex.: "whatsapp_baileys") — nada a ver com o `canal`
   * (rótulo tipo WhatsApp/Instagram/TikTok) da `Conversa`; ausente = comportamento antigo,
   * implicitamente a integração oficial da Meta. Decide por qual integração uma resposta sai. */
  canal?: string;
  /** "Apagar pra todos" real (persistido) — some do balão de qualquer sessão/usuário que reveja essa
   * conversa, não só do navegador de quem apagou. Vale só dentro do CRM: nenhuma integração atual
   * (Meta/Baileys) expõe um jeito de recolher a mensagem do lado do destinatário no WhatsApp. */
  apagadaParaTodos?: boolean;
  /** Nome de quem mandou, só em mensagem recebida (`tipo === "in"`) DENTRO de um grupo de WhatsApp
   * (`Conversa.ehGrupo`) — sem isso não dá pra saber qual dos participantes escreveu cada balão,
   * igual o WhatsApp de verdade mostra. Ausente em conversa individual (não faz sentido lá). */
  remetenteNome?: string;
  /** Mídia recebida cujo conteúdo real não veio no webhook (mídia embutida em base64 foi desligada
   * de propósito, pra não derrubar o servidor com arquivo grande — ver `configurarWebhook`) — só
   * texto de aviso apareceu na hora. Guarda o suficiente pra buscar o conteúdo de verdade sob
   * demanda (ver `GET /api/integracoes/whatsapp-nao-oficial/midia`), só quando a pessoa clicar pra
   * carregar. Some assim que carregado (o campo específico do tipo, ex. `audio`, passa a existir). */
  midiaPendente?: { remoteJid: string; id: string; fromMe: boolean; tipo: "audio" | "imagem" };
};

export type Conversa = {
  id: string;
  initials: string;
  nome: string;
  canal: Canal;
  contato: string;
  tempo: string;
  status: ConvStatus;
  origem: Origem;
  /** Mensagens não lidas nessa conversa — mostra o selo verde na lista. */
  naoLidas?: number;
  favorita?: boolean;
  mensagens: ConvMensagem[];
  atendentes: { nome: string; papel: string }[];
  atendenteSelecionado: string;
  tarefa: {
    data: string;
    oQueFazer: string;
    valor: string;
    responsavel: string;
    anexo: { arquivo: string; detalhe: string } | null;
  };
};

const ATENDENTES_PADRAO = [
  { nome: "Ana Ferreira", papel: "Gestora de tráfego" },
  { nome: "Bruno Salles", papel: "Vendedor" },
  { nome: "Dr. Hélio Marinho", papel: "Especialista" },
];

export const conversas: Conversa[] = [
  {
    id: "marcos-aurelio",
    initials: "MA",
    nome: "Marcos Aurélio",
    canal: "WhatsApp",
    contato: "+55 62 9XXXX-XXXX",
    tempo: "9 min",
    status: "Não respondido",
    naoLidas: 2,
    origem: "Meta Ads",
    mensagens: [
      {
        tipo: "in",
        texto: "Oi! Vi o anúncio de vocês e quero saber mais",
        hora: "09:14",
      },
      {
        tipo: "in",
        texto: "Queria falar com o Dr. Hélio, um amigo meu é paciente dele",
        hora: "09:15",
      },
      {
        tipo: "system",
        texto: "Ana atribuiu essa conversa ao Dr. Hélio",
        hora: "",
      },
      {
        tipo: "out",
        texto:
          "Olá! Tudo bem? Meu nome é Hélio, vou te acompanhar a partir de agora 🙂",
        hora: "09:16 · automática",
      },
      {
        tipo: "in",
        texto: "Ainda tem horário essa semana pra avaliação?",
        hora: "09:20",
      },
    ],
    atendentes: [
      { nome: "Ana Ferreira", papel: "Gestora de tráfego" },
      { nome: "Dr. Hélio Marinho", papel: "Especialista · pedido do próprio lead" },
    ],
    atendenteSelecionado: "Dr. Hélio Marinho",
    tarefa: {
      data: "01/08/2026 · 14h",
      oQueFazer: "Retorno de avaliação — confirmar presença",
      valor: "R$ 890,00",
      responsavel: "Dr. Hélio Marinho",
      anexo: {
        arquivo: "receita_marcos_aurelio.pdf",
        detalhe: "enviado pelo paciente · 09:15",
      },
    },
  },
  {
    id: "camila-duarte",
    initials: "CD",
    nome: "Camila Duarte",
    canal: "Instagram",
    contato: "@camila.duarte",
    tempo: "14 min",
    status: "Não respondido",
    naoLidas: 1,
    favorita: true,
    origem: "Instagram",
    mensagens: [
      {
        tipo: "in",
        texto: "Quero saber o valor da consulta particular",
        hora: "",
      },
    ],
    atendentes: ATENDENTES_PADRAO,
    atendenteSelecionado: "Ana Ferreira",
    tarefa: {
      data: "30 jul",
      oQueFazer: "Responder valor da consulta particular",
      valor: "—",
      responsavel: "Ana Ferreira",
      anexo: null,
    },
  },
  {
    id: "lorena-bastos",
    initials: "LB",
    nome: "Lorena Bastos",
    canal: "TikTok",
    contato: "@lorena.bastos",
    tempo: "31 min",
    status: "Não respondido",
    naoLidas: 3,
    origem: "TikTok",
    mensagens: [
      {
        tipo: "in",
        texto: "Oi, vi o vídeo de vocês sobre acompanhamento nutricional, como funciona?",
        hora: "",
      },
    ],
    atendentes: ATENDENTES_PADRAO,
    atendenteSelecionado: "Ana Ferreira",
    tarefa: {
      data: "30 jul",
      oQueFazer: "Fazer primeiro contato",
      valor: "—",
      responsavel: "Ana Ferreira",
      anexo: null,
    },
  },
  {
    id: "fernando-lima",
    initials: "FL",
    nome: "Fernando Lima",
    canal: "WhatsApp",
    contato: "+55 62 9XXXX-XXXX",
    tempo: "6 min",
    status: "Em conversa",
    origem: "Meta Ads",
    mensagens: [
      {
        tipo: "out",
        texto: "Perfeito, te encaixo quinta às 14h, pode ser?",
        hora: "",
      },
    ],
    atendentes: ATENDENTES_PADRAO,
    atendenteSelecionado: "Ana Ferreira",
    tarefa: {
      data: "31 jul",
      oQueFazer: "Confirmar presença de quinta",
      valor: "—",
      responsavel: "Ana Ferreira",
      anexo: null,
    },
  },
  {
    id: "beatriz-nogueira",
    initials: "BN",
    nome: "Beatriz Nogueira",
    canal: "WhatsApp",
    contato: "+55 62 9XXXX-XXXX",
    tempo: "21 min",
    status: "Em conversa",
    favorita: true,
    origem: "Google Ads",
    mensagens: [
      {
        tipo: "out",
        texto: "Vou te mandar os valores certinho, um minuto",
        hora: "",
      },
    ],
    atendentes: ATENDENTES_PADRAO,
    atendenteSelecionado: "Bruno Salles",
    tarefa: {
      data: "29 jul",
      oQueFazer: "Confirmar horário de amanhã",
      valor: "R$ 1.240,00",
      responsavel: "Bruno Salles",
      anexo: null,
    },
  },
  {
    id: "julia-prado",
    initials: "JP",
    nome: "Julia Prado",
    canal: "WhatsApp",
    contato: "+55 62 9XXXX-XXXX",
    tempo: "4 dias",
    status: "Aguardando cliente",
    origem: "Indicação",
    mensagens: [
      {
        tipo: "out",
        texto: "Te enviei a proposta, fico no aguardo!",
        hora: "",
      },
    ],
    atendentes: ATENDENTES_PADRAO,
    atendenteSelecionado: "Bruno Salles",
    tarefa: {
      data: "28 jul",
      oQueFazer: "Fazer follow-up da proposta",
      valor: "R$ 2.100,00",
      responsavel: "Bruno Salles",
      anexo: null,
    },
  },
  {
    id: "renata-farias",
    initials: "RF",
    nome: "Renata Farias",
    canal: "WhatsApp",
    contato: "+55 62 9XXXX-XXXX",
    tempo: "1h",
    status: "Finalizado",
    origem: "Meta Ads",
    mensagens: [
      {
        tipo: "in",
        texto: "Obrigada, até sábado então! 🙏",
        hora: "",
      },
    ],
    atendentes: ATENDENTES_PADRAO,
    atendenteSelecionado: "Bruno Salles",
    tarefa: {
      data: "02 ago",
      oQueFazer: "Ligar pra reagendar",
      valor: "R$ 780,00",
      responsavel: "Bruno Salles",
      anexo: null,
    },
  },
  {
    id: "paulo-lacerda",
    initials: "PL",
    nome: "Paulo Lacerda",
    canal: "WhatsApp",
    contato: "+55 62 9XXXX-XXXX",
    tempo: "2h",
    status: "Finalizado",
    origem: "Google Ads",
    mensagens: [
      {
        tipo: "in",
        texto: "Fechado! Passo amanhã pra assinar 🙌",
        hora: "",
      },
    ],
    atendentes: ATENDENTES_PADRAO,
    atendenteSelecionado: "Bruno Salles",
    tarefa: {
      data: "31 jul",
      oQueFazer: "Assinar contrato",
      valor: "R$ 1.560,00",
      responsavel: "Bruno Salles",
      anexo: null,
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Tarefas                                                                    */
/* -------------------------------------------------------------------------- */

export type Urgencia = "Baixa" | "Média" | "Alta";

/** Toda tarefa começa em "Geral" — as outras equipes são criadas na hora, ao criar uma tarefa pra uma equipe específica. */
export const EQUIPE_PADRAO_TAREFA = "Geral";

export type TaskCard = {
  id: string;
  titulo: string;
  contato: string;
  /** Id do contato relacionado (`Contato.id`), quando o contato já existe no CRM — permite ligar
   * a tarefa ao contato por id em vez de comparar `contato` (nome) espalhado pelo código. */
  contatoId?: string;
  data: string;
  atrasada?: boolean;
  responsavel: { nome: string; initials: string };
  concluida?: boolean;
  urgencia: Urgencia;
  descricao: string;
  anexo: { arquivo: string; detalhe: string } | null;
  /** Equipe dona da tarefa — "Geral" por padrão, ou o nome de uma equipe criada na hora. */
  modelo?: string;
};

export type ColunaTarefas = {
  /** Id real da etapa no banco (ver src/app/api/tarefas/etapas/) — ausente só no mock estático de
   * seed, que nunca chega direto na UI (o Provider sempre popula a partir da API). */
  id?: string;
  titulo: string;
  cards: TaskCard[];
};

export const tarefas: ColunaTarefas[] = [
  {
    titulo: "Atrasadas",
    cards: [
      {
        id: "follow-proposta-julia",
        titulo: "Fazer follow-up da proposta",
        contato: "Julia Prado",
        data: "28 jul",
        atrasada: true,
        responsavel: { nome: "Bruno Salles", initials: "BS" },
        urgencia: "Alta",
        descricao:
          "Perguntar se ela já viu a proposta enviada e se ficou alguma dúvida sobre valores ou parcelamento. Ela pediu a proposta há 4 dias e ainda não respondeu.",
        anexo: {
          arquivo: "proposta_julia_prado.pdf",
          detalhe: "enviada em 24/07",
        },
        modelo: "Vendas",
      },
    ],
  },
  {
    titulo: "Hoje",
    cards: [
      {
        id: "valor-consulta-camila",
        titulo: "Responder valor da consulta particular",
        contato: "Camila Duarte",
        data: "30 jul",
        responsavel: { nome: "Ana Ferreira", initials: "AF" },
        urgencia: "Média",
        descricao:
          "Responder o valor da consulta particular no Instagram e oferecer os horários livres dessa semana.",
        anexo: null,
      },
    ],
  },
  {
    titulo: "Essa semana",
    cards: [
      {
        id: "retorno-marcos",
        titulo: "Retorno de avaliação — confirmar presença",
        contato: "Marcos Aurélio",
        data: "01 ago",
        responsavel: { nome: "Dr. Hélio Marinho", initials: "DH" },
        urgencia: "Alta",
        descricao:
          "Confirmar com o paciente se ele vai trazer os exames de sangue recentes antes do retorno. Reforçar o horário e perguntar se prefere lembrete por WhatsApp na véspera.",
        anexo: {
          arquivo: "receita_marcos_aurelio.pdf",
          detalhe: "enviado pelo paciente · 09:15",
        },
        modelo: "Vendas",
      },
      {
        id: "reagendar-renata",
        titulo: "Ligar pra reagendar",
        contato: "Renata Farias",
        data: "02 ago",
        responsavel: { nome: "Bruno Salles", initials: "BS" },
        urgencia: "Média",
        descricao:
          "Ligar pra reagendar o horário que ela não conseguiu comparecer e confirmar o novo dia por WhatsApp.",
        anexo: null,
        modelo: "Secretária",
      },
    ],
  },
  {
    titulo: "Concluídas",
    cards: [
      {
        id: "confirmar-beatriz",
        titulo: "Confirmar horário de amanhã",
        contato: "Beatriz Nogueira",
        data: "29 jul",
        responsavel: { nome: "Bruno Salles", initials: "BS" },
        concluida: true,
        urgencia: "Baixa",
        descricao:
          "Confirmar por WhatsApp o horário de amanhã e reforçar os itens que ela precisa levar na consulta.",
        anexo: null,
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Ações (listas de transmissão)                                              */
/* -------------------------------------------------------------------------- */

export const segmentos = [
  { label: "Contatos de julho 2026", ativo: true },
  { label: "Contatos de 2025", ativo: false },
  { label: "Fecharam negócio", ativo: true },
  { label: "Não fecharam", ativo: false },
  { label: "Todos os leads", ativo: false },
  { label: "Só WhatsApp", ativo: false },
  { label: "Origem: Meta Ads", ativo: false },
  { label: "Origem: Indicação", ativo: false },
];

/** Interseção de "contatos de julho 2026" com "fecharam negócio". */
export const audienciaSelecionada = 36;

/* -------------------------------------------------------------------------- */
/* Equipe                                                                     */
/* -------------------------------------------------------------------------- */

export type Membro = {
  /** Slug estável derivado do nome (mesmo padrão de `Contato.id`/`NegocioCard.id`, ver `slugId`). */
  id: string;
  initials: string;
  nome: string;
  email: string;
  senha: string | null;
  papel: string;
  papelTipo: "admin" | "padrao" | "custom";
  papelNota?: string;
  leads: string;
  enxerga: string;
  permissoes: string[];
  ativo: boolean;
  convitePendente?: boolean;
  /** Foto de perfil (data URL) que a pessoa colocou em "Meu Perfil" — se não tiver, mostra as iniciais. */
  foto?: string;
  /** Timestamp ISO do último login real (`authorize()` em auth.ts) — null/ausente = nunca entrou. */
  ultimoAcesso?: string | null;
};

export const PERMISSOES_CRM = [
  "Ver todas as conversas (não só as próprias)",
  "Ver todos os leads e o funil",
  "Gerar e ver relatórios",
  "Ver o painel de tráfego",
  "Criar e disparar ações (listas de transmissão)",
  "Criar e editar automações",
  "Convidar ou remover gente da equipe",
  "Conectar ou desconectar integrações",
];

export const equipe: Membro[] = [
  {
    id: "ana-ferreira",
    initials: "AF",
    nome: "Ana Ferreira",
    email: "ana@empresademo.com.br",
    senha: "Az7!vitta26",
    papel: "Admin",
    papelTipo: "admin",
    leads: "103",
    enxerga: "Todos os leads e relatórios",
    permissoes: [...PERMISSOES_CRM],
    ativo: true,
  },
  {
    id: "bruno-salles",
    initials: "BS",
    nome: "Bruno Salles",
    email: "bruno@empresademo.com.br",
    senha: "Bs@vitta318",
    papel: "Vendedor",
    papelTipo: "padrao",
    leads: "62",
    enxerga: "Só os próprios leads",
    permissoes: [],
    ativo: true,
  },
  {
    id: "carla-mendes",
    initials: "CM",
    nome: "Carla Mendes",
    email: "carla@empresademo.com.br",
    senha: "Cm#vitta742",
    papel: "Vendedor",
    papelTipo: "padrao",
    leads: "58",
    enxerga: "Só os próprios leads",
    permissoes: [],
    ativo: true,
  },
  {
    id: "dr-helio-marinho",
    initials: "HM",
    nome: "Dr. Hélio Marinho",
    email: "helio@empresademo.com.br",
    senha: "Hm$vitta905",
    papel: "Especialista",
    papelTipo: "custom",
    papelNota: "· personalizado",
    leads: "24",
    enxerga: "Conversas e tarefas atribuídas a ele",
    permissoes: [],
    ativo: true,
  },
  {
    id: "dr-lucas-vitta",
    initials: "LV",
    nome: "Dr. Lucas Vitta",
    email: "lucas@empresademo.com.br",
    senha: "Lv&vitta064",
    papel: "Cliente",
    papelTipo: "padrao",
    leads: "—",
    enxerga: "Portal do cliente · só resultados",
    permissoes: [],
    ativo: true,
  },
  {
    id: "roberto-alves",
    initials: "RA",
    nome: "Roberto Alves",
    email: "roberto@empresademo.com.br",
    senha: null,
    papel: "Estoquista",
    papelTipo: "custom",
    papelNota: "· personalizado",
    leads: "—",
    enxerga: "Nenhum módulo de vendas — papel criado do zero",
    permissoes: [],
    ativo: false,
    convitePendente: true,
  },
];

export const convite = {
  nome: "Roberto Alves",
  email: "roberto@empresademo.com.br",
  papelPersonalizado: "Estoquista",
  token: "8f2a1e",
  convidadoPor: "Ana",
  papeisPadrao: [
    { nome: "Admin", descricao: "Acesso total, sem restrição" },
    {
      nome: "Secretária / Recepção",
      descricao: "Acesso amplo, com exceções que você escolhe ao lado",
    },
    { nome: "Vendedor", descricao: "Só vê os próprios leads, por padrão" },
    {
      nome: "Cliente (portal externo)",
      descricao: "Só vê os próprios resultados, nunca a operação interna",
    },
  ],
  permissoes: PERMISSOES_CRM,
};

/* -------------------------------------------------------------------------- */
/* Tráfego                                                                    */
/* -------------------------------------------------------------------------- */

export const kpisTrafego = [
  { label: "Investido", value: "R$ 3.200" },
  { label: "Leads", value: "84" },
  { label: "Custo / lead", value: "R$ 38" },
  { label: "Vendas", value: "12" },
  { label: "Custo / venda", value: "R$ 267" },
  { label: "ROAS", value: "4,2x" },
];

/**
 * 1.480 + 1.040 + 680 = R$ 3.200 investidos
 * 42 + 26 + 16 = 84 leads
 * 7.992 + 3.952 + 1.496 = R$ 13.440 de receita → ROAS 4,2x
 */
/** Mesmo formato usado pela rota real `GET /api/integracoes/meta/ads/campanhas` — texto pré-
 * formatado (`sub`/`roas`) de propósito, pra não precisar mudar o parse (`parseSubCampanha` em
 * `src/lib/metrics.ts`) quando a fonte troca de mock pra real. */
export type Campanha = {
  plataforma: "M" | "G";
  nome: string;
  sub: string;
  roas: string;
  barra: number;
};

export const campanhas: Campanha[] = [
  {
    plataforma: "M",
    nome: "Campanha principal · jul",
    sub: "42 leads · R$ 1.480 investidos",
    roas: "5,4x",
    barra: 90,
  },
  {
    plataforma: "G",
    nome: "Campanha de busca",
    sub: "26 leads · R$ 1.040 investidos",
    roas: "3,8x",
    barra: 63,
  },
  {
    plataforma: "M",
    nome: "Retargeting · Site",
    sub: "16 leads · R$ 680 investidos",
    roas: "2,2x",
    barra: 37,
  },
];

/* -------------------------------------------------------------------------- */
/* Atividades de venda                                                        */
/* -------------------------------------------------------------------------- */

export const kpisPrimeiroContato = [
  {
    label: "Oportunidades contatadas",
    value: "13",
    sub: "81,3% de 16 filtradas no período",
    delta: "↓ 0% do período anterior",
  },
  {
    label: "Tempo médio de primeiro contato",
    value: "2h40min",
    sub: "",
    delta: "↑ 18,3% do período anterior",
  },
  {
    label: "Menor tempo de primeiro contato",
    value: "5min",
    sub: "",
    delta: "↓ 21,4% do período anterior",
  },
  {
    label: "Maior tempo de primeiro contato",
    value: "18h20min",
    sub: "",
    delta: "↑ 9,7% do período anterior",
  },
];

export const tempoPrimeiroContatoPorResponsavel = [
  { nome: "Ana Ferreira", oportunidades: 4, tempoMedio: "22min", minutos: 22 },
  { nome: "Dr. Hélio Marinho", oportunidades: 2, tempoMedio: "48min", minutos: 48 },
  { nome: "Carla Mendes", oportunidades: 2, tempoMedio: "1h05min", minutos: 65 },
  { nome: "Bruno Salles", oportunidades: 5, tempoMedio: "3h10min", minutos: 190 },
];

/* -------------------------------------------------------------------------- */
/* Performance de venda                                                       */
/* -------------------------------------------------------------------------- */

export const kpisConversao = [
  {
    label: "Taxa de conversão",
    value: "68,8%",
    sub: "11 vendas de 16 oportunidades",
    delta: "↓ 1,4% do período anterior",
  },
  {
    label: "Total de oportunidades",
    value: "16",
    sub: "",
    delta: "↓ 30,4% do período anterior",
  },
  {
    label: "Oportunidades vendidas",
    value: "11",
    sub: "",
    delta: "↓ 31,3% do período anterior",
  },
  {
    label: "Valor total vendido",
    value: "R$ 38.400,00",
    sub: "",
    delta: "↑ 12,6% do período anterior",
  },
];

export const conversaoPorResponsavel = [
  { nome: "Ana Ferreira", vendidas: 5, perdidas: 1 },
  { nome: "Dr. Hélio Marinho", vendidas: 3, perdidas: 1 },
  { nome: "Carla Mendes", vendidas: 2, perdidas: 1 },
  { nome: "Bruno Salles", vendidas: 1, perdidas: 2 },
];

export const kpisMotivosPerda = [
  {
    label: "Valor perdido no período",
    value: "R$ 9.800,00",
    sub: "5 oportunidades perdidas",
    delta: "↑ 14,2% do período anterior",
  },
  {
    label: "Principal motivo",
    value: "Achou caro",
    sub: "40% das perdas do período",
    delta: "",
  },
];

export const motivosPerda = [
  { motivo: "Achou caro / sem orçamento", quantidade: 2, valor: "R$ 4.100,00", percentual: 40 },
  { motivo: "Escolheu outra clínica", quantidade: 1, valor: "R$ 2.600,00", percentual: 22 },
  { motivo: "Sumiu, parou de responder", quantidade: 1, valor: "R$ 1.900,00", percentual: 20 },
  { motivo: "Não é o momento", quantidade: 1, valor: "R$ 1.200,00", percentual: 18 },
];

/** Uma linha por oportunidade perdida — pra investigar caso a caso qual foi o processo com aquele cliente. */
export const oportunidadesPerdidas = [
  {
    cliente: "Marcos Aurélio",
    responsavel: "Bruno Salles",
    motivo: "Achou caro / sem orçamento",
    etapa: "Proposta",
    valor: "R$ 1.800,00",
    data: "22/07/2026",
  },
  {
    cliente: "Camila Duarte",
    responsavel: "Ana Ferreira",
    motivo: "Achou caro / sem orçamento",
    etapa: "Qualificado",
    valor: "R$ 2.300,00",
    data: "18/07/2026",
  },
  {
    cliente: "Lorena Bastos",
    responsavel: "Carla Mendes",
    motivo: "Escolheu outra clínica",
    etapa: "Proposta",
    valor: "R$ 2.600,00",
    data: "15/07/2026",
  },
  {
    cliente: "Fernando Lima",
    responsavel: "Dr. Hélio Marinho",
    motivo: "Sumiu, parou de responder",
    etapa: "Novo",
    valor: "R$ 1.900,00",
    data: "10/07/2026",
  },
  {
    cliente: "Beatriz Nogueira",
    responsavel: "Bruno Salles",
    motivo: "Não é o momento",
    etapa: "Qualificado",
    valor: "R$ 1.200,00",
    data: "05/07/2026",
  },
];

/* -------------------------------------------------------------------------- */
/* CRM Live — telão pra projetar no escritório                                */
/* -------------------------------------------------------------------------- */

export const crmLive = {
  vencedores: {
    maisOportunidades: { nome: "Ana Ferreira", valor: "7" },
    maisVendasUnidade: { nome: "Ana Ferreira", valor: "4" },
    maisVendasValor: { nome: "Dr. Hélio Marinho", valor: "R$ 14.200" },
  },
  finalizadas: {
    oportunidadesNovas: 9,
    oportunidadesNovasAnterior: 17,
    vendasPeriodo: 6,
    vendasPeriodoAnterior: 9,
    vendasValor: 21400,
    vendasValorAnterior: 28900,
    conversao: "66,7%",
    perdidas: 3,
    perdidasAnterior: 5,
  },
  andamento: {
    oportunidadesEmAndamento: 24,
    valoresEmAndamento: "R$ 58.600,00",
    etapas: [
      { nome: "Sem contato / Lead", quantidade: 4, valor: "R$ 0,00" },
      { nome: "Contato feito", quantidade: 6, valor: "R$ 8.400,00" },
      { nome: "Visita / Avaliação", quantidade: 7, valor: "R$ 16.200,00" },
      { nome: "Proposta enviada", quantidade: 5, valor: "R$ 21.100,00" },
      { nome: "Fechamento", quantidade: 2, valor: "R$ 12.900,00" },
    ],
  },
  feedTarefas: [
    { titulo: "Proposta comercial enviada", pessoa: "Ana Ferreira", quando: "há 8 min" },
    { titulo: "Tentativa 3 de contato", pessoa: "Bruno Salles", quando: "há 22 min" },
    { titulo: "Retorno de avaliação confirmado", pessoa: "Dr. Hélio Marinho", quando: "há 41 min" },
    { titulo: "Primeira tentativa de contato", pessoa: "Carla Mendes", quando: "há 1h" },
    { titulo: "Follow-up da proposta", pessoa: "Bruno Salles", quando: "há 2h" },
  ],
};

/* -------------------------------------------------------------------------- */
/* Relatórios                                                                 */
/* -------------------------------------------------------------------------- */

export const periodoRelatorio = { de: "01 jul 2026", ate: "31 jul 2026" };

export const relatorioAutomatico = [
  { label: "Leads no período", value: "247" },
  { label: "Leads qualificados", value: "143" },
  { label: "Fecharam negócio", value: "36" },
  { label: "Valor vendido no CRM", value: "R$ 38.400" },
  { label: "Receita vinda de anúncio", value: "R$ 13.440" },
  { label: "Receita vinda de indicação", value: "R$ 4.180" },
];

/** Cada origem tem seu próprio mini-relatório — a pessoa escolhe quais entram no PDF. */
export const relatorioPorOrigem = [
  {
    id: "google",
    label: "Google Ads",
    stats: [
      { label: "Leads via Google Ads", value: "98" },
      { label: "Receita vinda do Google Ads", value: "R$ 7.140" },
    ],
  },
  {
    id: "facebook",
    label: "Facebook / Instagram Ads",
    stats: [
      { label: "Leads via Meta Ads", value: "112" },
      { label: "Receita vinda do Meta Ads", value: "R$ 6.300" },
    ],
  },
  {
    id: "vendedor",
    label: "Ligação / Vendedor",
    stats: [
      { label: "Ligações realizadas", value: "64" },
      { label: "Vendas fechadas por ligação", value: "R$ 9.800" },
    ],
  },
];

export const relatorioManual = {
  faturamento: "R$ 96.000,00",
  percentualPago: "14% · calculado automático",
  queixasPlaceholder: "Ex.: preço, horário disponível...",
};

export const relatoriosAnteriores = [
  { nome: "Junho 2026", gerado: "Gerado em 01/07" },
  { nome: "Maio 2026", gerado: "Gerado em 01/06" },
  { nome: "Abril 2026", gerado: "Gerado em 01/05" },
];

/* -------------------------------------------------------------------------- */
/* Relatórios — análise (tipo Dashboard, Pipeline, Equipes…)                  */
/* -------------------------------------------------------------------------- */

export const TIPOS_RELATORIO_ANALISE = [
  "Dashboard",
  "Pipeline",
  "Equipes",
  "Feedback",
  "Conversões",
  "Produtos e Serviços",
  "Fontes e Campanhas",
  "Metas",
  "Ligações",
  "Comparativo de ligações",
] as const;

/** Ligações feitas pelo telefone virtual do CRM — usado no relatório "Ligações". */
export const ligacoesPorResponsavel = [
  { nome: "Ana Ferreira", quantidade: 14, duracaoMedia: "3min 40s" },
  { nome: "Dr. Hélio Marinho", quantidade: 9, duracaoMedia: "5min 10s" },
  { nome: "Carla Mendes", quantidade: 11, duracaoMedia: "2min 55s" },
  { nome: "Bruno Salles", quantidade: 7, duracaoMedia: "4min 05s" },
];

export const CAMPOS_FILTRO_PERSONALIZADO = [
  "Campanha",
  "Fonte",
  "Produto ou Serviço",
  "Segmento",
  "Região de atuação",
  "Estado civil",
  "Validade do CS",
  "Valor negociação",
  "CPF / CNPJ",
  "Indicador",
  "Marca / Modelo",
];

/** Soma R$ 38.400,00 — bate com `kpisConversao` ("Valor total vendido"). */
export const faturamentoPorResponsavel = [
  { nome: "Ana Ferreira", valor: 15200 },
  { nome: "Dr. Hélio Marinho", valor: 11400 },
  { nome: "Carla Mendes", valor: 6800 },
  { nome: "Bruno Salles", valor: 5000 },
];

/**
 * Dia a dia do mês pra montar o gráfico de área (oportunidades/vendas/perdas)
 * e o gráfico de valor vendido do Dashboard de relatórios — só teve venda em
 * valor mesmo nos dias 13, 17 e 19 (esse último bem maior que os outros).
 */
export const serieDashboardRelatorios = [
  { dia: "01", criadas: 1, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "02", criadas: 0, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "03", criadas: 2, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "04", criadas: 1, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "05", criadas: 1, vendas: 0, perdidas: 1, valorVendas: 0 },
  { dia: "06", criadas: 0, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "07", criadas: 2, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "08", criadas: 3, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "09", criadas: 1, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "10", criadas: 2, vendas: 0, perdidas: 1, valorVendas: 0 },
  { dia: "11", criadas: 1, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "12", criadas: 0, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "13", criadas: 1, vendas: 1, perdidas: 0, valorVendas: 3800 },
  { dia: "14", criadas: 2, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "15", criadas: 1, vendas: 0, perdidas: 1, valorVendas: 0 },
  { dia: "16", criadas: 0, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "17", criadas: 1, vendas: 1, perdidas: 0, valorVendas: 6200 },
  { dia: "18", criadas: 1, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "19", criadas: 0, vendas: 1, perdidas: 0, valorVendas: 15400 },
  { dia: "20", criadas: 2, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "21", criadas: 1, vendas: 0, perdidas: 1, valorVendas: 0 },
  { dia: "22", criadas: 3, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "23", criadas: 1, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "24", criadas: 2, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "25", criadas: 0, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "26", criadas: 1, vendas: 0, perdidas: 1, valorVendas: 0 },
  { dia: "27", criadas: 1, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "28", criadas: 0, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "29", criadas: 3, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "30", criadas: 2, vendas: 0, perdidas: 0, valorVendas: 0 },
  { dia: "31", criadas: 4, vendas: 0, perdidas: 0, valorVendas: 0 },
];

/* -------------------------------------------------------------------------- */
/* Automações (vivem dentro de cada etapa do funil)                          */
/* -------------------------------------------------------------------------- */

export type TipoGatilhoEtapa = "entrou" | "parado" | "saiu" | "respondeu" | "agendado";

/** O que dispara a automação — sempre relativo ao lead dentro da etapa onde ela foi criada. */
export const GATILHOS_ETAPA: {
  tipo: TipoGatilhoEtapa;
  label: string;
  /** Tempo é obrigatório pra esse gatilho (ex.: "parado há quanto tempo"). */
  precisaTempo?: boolean;
  /**
   * Deixa escolher entre disparar na hora ou esperar um tempo personalizado
   * depois do gatilho acontecer — ex.: "entrou na etapa" mas só manda a
   * mensagem 2 horas depois, não na mesma hora.
   */
  permiteAtraso?: boolean;
}[] = [
  {
    tipo: "entrou",
    label: "Quando um lead entra nessa etapa",
    permiteAtraso: true,
  },
  {
    tipo: "parado",
    label: "Quando um lead fica parado nessa etapa",
    precisaTempo: true,
  },
  {
    tipo: "saiu",
    label: "Quando um lead sai dessa etapa",
    permiteAtraso: true,
  },
  {
    tipo: "respondeu",
    label: "Quando o lead responde uma mensagem",
    permiteAtraso: true,
  },
  {
    tipo: "agendado",
    label: "Em um horário programado (recorrente) — usa a janela de atividade abaixo",
  },
];

export const UNIDADES_TEMPO = ["minutos", "horas", "dias"] as const;

export type TipoAcaoAutomacao =
  | "mensagem"
  | "mensagem_interativa"
  | "documento"
  | "audio"
  | "enviar_formulario"
  | "lembrete"
  | "tarefa"
  | "mover_funil"
  | "atribuir_responsavel"
  | "adicionar_etiqueta"
  | "remover_etiqueta"
  | "webhook";

/** Cada automação pode ter várias dessas ações, em sequência. */
export const TIPOS_ACAO_AUTOMACAO: { tipo: TipoAcaoAutomacao; label: string }[] = [
  { tipo: "mensagem", label: "Enviar mensagem" },
  { tipo: "mensagem_interativa", label: "Enviar mensagem com opções de resposta" },
  { tipo: "documento", label: "Enviar documento" },
  { tipo: "audio", label: "Enviar áudio" },
  { tipo: "enviar_formulario", label: "Enviar formulário" },
  { tipo: "lembrete", label: "Criar lembrete" },
  { tipo: "tarefa", label: "Criar tarefa com prazo" },
  { tipo: "mover_funil", label: "Mover lead pra outra etapa / funil" },
  { tipo: "atribuir_responsavel", label: "Atribuir a um atendente da equipe" },
  { tipo: "adicionar_etiqueta", label: "Adicionar etiqueta ao contato" },
  { tipo: "remover_etiqueta", label: "Remover etiqueta do contato" },
  { tipo: "webhook", label: "Enviar dados pra um webhook externo" },
];

/** Canais onde dá pra ler comentário público e responder no direct/inbox. */
export const CANAIS_COMENTARIO = ["Instagram", "TikTok"] as const;
export type CanalComentario = (typeof CANAIS_COMENTARIO)[number];

/* -------------------------------------------------------------------------- */
/* Janela de atividade, condições e limite de disparo das automações         */
/* -------------------------------------------------------------------------- */

export const DIAS_SEMANA = [
  { valor: "seg", label: "Seg" },
  { valor: "ter", label: "Ter" },
  { valor: "qua", label: "Qua" },
  { valor: "qui", label: "Qui" },
  { valor: "sex", label: "Sex" },
  { valor: "sab", label: "Sáb" },
  { valor: "dom", label: "Dom" },
] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number]["valor"];
export const DIAS_SEMANA_TODOS: DiaSemana[] = DIAS_SEMANA.map((d) => d.valor);

/** O que fazer quando o gatilho acontece fora da janela de dias/horário ativos. */
export const COMPORTAMENTO_FORA_JANELA: {
  valor: "aguardar" | "ignorar";
  label: string;
}[] = [
  { valor: "aguardar", label: "Espera abrir a janela e dispara" },
  { valor: "ignorar", label: "Não dispara" },
];

export const LIMITES_EXECUCAO: { valor: "sempre" | "uma_vez"; label: string }[] = [
  { valor: "sempre", label: "Toda vez que o gatilho acontecer" },
  { valor: "uma_vez", label: "Só uma vez por contato" },
];

/* -------------------------------------------------------------------------- */
/* Configurações                                                              */
/* -------------------------------------------------------------------------- */

export const integracoes = [
  {
    grupo: 'Tráfego pago — é daqui que a tela "Tráfego" se alimenta sozinha',
    itens: [
      {
        logo: "M",
        cor: "var(--blue)",
        titulo: "Meta Ads",
        sub: "Conta conectada: Empresa Demo Anúncios · atualiza a cada 1h",
        status: "Conectado" as const,
        acao: "Gerenciar",
      },
      {
        logo: "G",
        cor: "var(--blue)",
        titulo: "Google Ads",
        sub: "Conta conectada: 384-221-9087 · atualiza a cada 1h",
        status: "Conectado" as const,
        acao: "Gerenciar",
      },
      {
        logo: "TT",
        titulo: "TikTok Ads",
        sub: "Conecte pra ver essa origem no painel de Tráfego",
        status: "Não conectado" as const,
        acao: "Conectar",
      },
    ],
  },
  {
    grupo: "Comunicação — o que alimenta o WhatsApp",
    itens: [
      {
        logo: "wa",
        titulo: "WhatsApp Business (API oficial)",
        sub: "Número conectado: +55 62 9XXXX-XXXX",
        status: "Conectado" as const,
        acao: "Gerenciar",
      },
      {
        logo: "ig",
        titulo: "Instagram Direct",
        sub: "@empresademo",
        status: "Conectado" as const,
        acao: "Gerenciar",
      },
      {
        logo: "TT",
        titulo: "TikTok — mensagens e comentários",
        sub: "Conecte pra receber lead de comentário automaticamente",
        status: "Não conectado" as const,
        acao: "Conectar",
      },
    ],
  },
  {
    grupo: "Agenda e produtividade",
    itens: [
      {
        logo: "cal",
        titulo: "Google Agenda",
        sub: "Sincroniza horários marcados no Funil direto pra agenda da equipe",
        status: "Conectado" as const,
        acao: "Gerenciar",
      },
    ],
  },
  {
    grupo:
      "Inteligência artificial — conecte a IA que sua equipe já usa, por API ou MCP",
    itens: [
      {
        logo: "IA",
        cor: "var(--blue)",
        titulo: "Claude (Anthropic)",
        sub: "Resume conversas e sugere resposta direto no WhatsApp",
        status: "Conectado" as const,
        acao: "Gerenciar",
      },
      {
        logo: "IA",
        titulo: "ChatGPT (OpenAI)",
        sub: "Conecte com sua chave de API pra usar nas Automações",
        status: "Não conectado" as const,
        acao: "Conectar",
      },
      {
        logo: "IA",
        titulo: "Gemini (Google)",
        sub: "Conecte com sua chave de API pra usar nas Automações",
        status: "Não conectado" as const,
        acao: "Conectar",
      },
      {
        logo: "MCP",
        titulo: "Servidor MCP personalizado",
        sub: "Conecte qualquer IA que fale o protocolo MCP — cole a URL do servidor",
        status: "Não conectado" as const,
        acao: "Conectar",
      },
    ],
  },
];

export const apiKey = "sk_live_azuz_••••••••••••7f2a";

export const webhooks = [
  {
    titulo: "Webhook de novo lead",
    sub: "Dispara um POST toda vez que um lead novo entra, pra qualquer sistema seu",
    status: "Ativo" as const,
    acao: "Configurar",
  },
  {
    titulo: "Webhook de venda fechada",
    sub: "Envia o evento de volta pra Meta/Google (Conversions API) e pra quem mais precisar",
    status: "Ativo" as const,
    acao: "Configurar",
  },
  {
    titulo: "Marketplace de integrações",
    sub: "Mercado Pago, Asaas, Conta Azul e outras — chega no médio prazo",
    status: "Em breve" as const,
    acao: null,
  },
];

/* -------------------------------------------------------------------------- */
/* Planos e pagamentos                                                        */
/* -------------------------------------------------------------------------- */

export const planoAtual = {
  nome: "Plano Completo",
  descricao:
    "Tudo incluso — funil, WhatsApp/Instagram/TikTok, automações, relatórios, IA e integrações",
  valor: "R$ 249,00",
  periodo: "por mês",
};

/* -------------------------------------------------------------------------- */
/* Azuz IA                                                                    */
/* -------------------------------------------------------------------------- */

export const azuzIaMensagens: { tipo: "in" | "out"; texto: string }[] = [
  {
    tipo: "in",
    texto: "Oi, Ana! Sou a Azuz IA. Posso resumir conversas, sugerir resposta ou te dizer o que precisa de atenção hoje. O que você precisa?",
  },
  {
    tipo: "out",
    texto: "Quais leads estão esfriando essa semana?",
  },
  {
    tipo: "in",
    texto:
      "A proposta da Julia Prado tá parada há 4 dias e a da Renata Farias vence amanhã. Quer que eu monte um follow-up pras duas?",
  },
];
