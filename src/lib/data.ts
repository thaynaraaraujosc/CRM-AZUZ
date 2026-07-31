/**
 * Dados fictícios do CRM AZUZ.
 * Workspace de exemplo: Clínica Vitta (endocrinologia — emagrecimento e diabetes).
 *
 * Os números são consistentes entre as telas de propósito:
 *   julho/2026 · 247 leads · 143 qualificados · 36 fechados · 14,6% de conversão
 *   R$ 38.400 vendidos no CRM · R$ 3.200 investidos em anúncios · ROAS 4,2x
 *   84 leads e R$ 13.440 de receita vieram do tráfego pago
 */

export const workspace = {
  name: "Clínica Vitta",
  slug: "clinicavitta",
  segment: "Emagrecimento e diabetes",
  email: "secretaria@clinicavitta.com.br",
};

export const currentUser = {
  name: "Ana Ferreira",
  initials: "AF",
  role: "Gestora de tráfego",
  email: "ana@clinicavitta.com.br",
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
  | "Indicação";

/** Classe CSS que pinta a nomenclatura da origem com a cor da própria plataforma. */
export function classeOrigem(origem: Origem): string {
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

/** Central de notificações — sino no topo de todas as telas. */
export const notificacoes = [
  {
    titulo: "Marcos Aurélio respondeu no WhatsApp",
    meta: "há 6 min",
    lida: false,
  },
  {
    titulo: "Julia Prado — proposta parada há 4 dias",
    meta: "há 1h",
    lida: false,
  },
  {
    titulo: "Roberto Alves ainda não aceitou o convite",
    meta: "há 3h",
    lida: false,
  },
  {
    titulo: "Automação \"Follow-up sem resposta\" disparou 4 vezes hoje",
    meta: "há 5h",
    lida: true,
  },
  {
    titulo: "Paulo Lacerda fechou negócio de R$ 1.560",
    meta: "ontem",
    lida: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Contatos                                                                   */
/* -------------------------------------------------------------------------- */

export type Contato = {
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
};

export const contatos: Contato[] = [
  {
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
  },
  {
    initials: "BN",
    nome: "Beatriz Nogueira",
    origem: "Google Ads",
    etapa: "Qualificado",
    responsavel: "Bruno Salles",
    ultima: "Há 21 min",
    valor: "R$ 1.240",
  },
  {
    initials: "CD",
    nome: "Camila Duarte",
    origem: "Instagram",
    etapa: "Novo",
    responsavel: "Ana Ferreira",
    ultima: "Há 14 min",
    valor: "—",
  },
  {
    initials: "FL",
    nome: "Fernando Lima",
    origem: "Meta Ads",
    etapa: "Novo",
    responsavel: "Ana Ferreira",
    ultima: "Há 6 min",
    valor: "—",
  },
  {
    initials: "JP",
    nome: "Julia Prado",
    origem: "Indicação",
    etapa: "Proposta",
    responsavel: "Bruno Salles",
    ultima: "Há 4 dias",
    valor: "R$ 2.100",
  },
  {
    initials: "RF",
    nome: "Renata Farias",
    origem: "Meta Ads",
    etapa: "Proposta",
    responsavel: "Bruno Salles",
    ultima: "Há 1h",
    valor: "R$ 780",
  },
  {
    initials: "PL",
    nome: "Paulo Lacerda",
    origem: "Google Ads",
    etapa: "Fechado",
    responsavel: "Bruno Salles",
    ultima: "Há 2h",
    valor: "R$ 1.560",
  },
  {
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
    id: "emagrecimento-diabetes",
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

export type ConvMensagem = {
  tipo: "in" | "out" | "system";
  texto: string;
  hora: string;
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
    origem: "Meta Ads",
    mensagens: [
      {
        tipo: "in",
        texto: "Oi! Vi o anúncio de vocês sobre acompanhamento de diabetes",
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

export type TaskCard = {
  id: string;
  titulo: string;
  contato: string;
  data: string;
  atrasada?: boolean;
  responsavel: { nome: string; initials: string };
  valor?: string;
  concluida?: boolean;
  urgencia: Urgencia;
  descricao: string;
  anexo: { arquivo: string; detalhe: string } | null;
};

export type ColunaTarefas = { titulo: string; cards: TaskCard[] };

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
        valor: "R$ 2.100",
        urgencia: "Alta",
        descricao:
          "Perguntar se ela já viu a proposta enviada e se ficou alguma dúvida sobre valores ou parcelamento. Ela pediu a proposta há 4 dias e ainda não respondeu.",
        anexo: {
          arquivo: "proposta_julia_prado.pdf",
          detalhe: "enviada em 24/07",
        },
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
        valor: "R$ 890",
        urgencia: "Alta",
        descricao:
          "Confirmar com o paciente se ele vai trazer os exames de sangue recentes antes do retorno. Reforçar o horário e perguntar se prefere lembrete por WhatsApp na véspera.",
        anexo: {
          arquivo: "receita_marcos_aurelio.pdf",
          detalhe: "enviado pelo paciente · 09:15",
        },
      },
      {
        id: "reagendar-renata",
        titulo: "Ligar pra reagendar",
        contato: "Renata Farias",
        data: "02 ago",
        responsavel: { nome: "Bruno Salles", initials: "BS" },
        valor: "R$ 780",
        urgencia: "Média",
        descricao:
          "Ligar pra reagendar o horário que ela não conseguiu comparecer e confirmar o novo dia por WhatsApp.",
        anexo: null,
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

export const acaoRascunho = {
  midia: "Imagem",
  legenda:
    "Promoção especial de agosto: acompanhamento nutricional com 20% off só essa semana 💙",
  envio: "Hoje às 18h · WhatsApp e Instagram",
};

export const acoesAnteriores = [
  {
    titulo: "Dia Mundial do Diabetes · campanha",
    meta: "247 contatos · leads de julho",
    midia: "imagem" as const,
    status: "Enviado",
    agendado: false,
  },
  {
    titulo: "Reativação · não fecharam há 6 meses",
    meta: "89 contatos · áudio",
    midia: "audio" as const,
    status: "Enviado",
    agendado: false,
  },
  {
    titulo: "Evento de agosto · convite",
    meta: "36 contatos · imagem",
    midia: "imagem" as const,
    status: "Agendado · hoje 18h",
    agendado: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Equipe                                                                     */
/* -------------------------------------------------------------------------- */

export type Membro = {
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
    initials: "AF",
    nome: "Ana Ferreira",
    email: "ana@clinicavitta.com.br",
    senha: "Az7!vitta26",
    papel: "Admin",
    papelTipo: "admin",
    leads: "103",
    enxerga: "Todos os leads e relatórios",
    permissoes: [...PERMISSOES_CRM],
    ativo: true,
  },
  {
    initials: "BS",
    nome: "Bruno Salles",
    email: "bruno@clinicavitta.com.br",
    senha: "Bs@vitta318",
    papel: "Vendedor",
    papelTipo: "padrao",
    leads: "62",
    enxerga: "Só os próprios leads",
    permissoes: [],
    ativo: true,
  },
  {
    initials: "CM",
    nome: "Carla Mendes",
    email: "carla@clinicavitta.com.br",
    senha: "Cm#vitta742",
    papel: "Vendedor",
    papelTipo: "padrao",
    leads: "58",
    enxerga: "Só os próprios leads",
    permissoes: [],
    ativo: true,
  },
  {
    initials: "HM",
    nome: "Dr. Hélio Marinho",
    email: "helio@clinicavitta.com.br",
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
    initials: "LV",
    nome: "Dr. Lucas Vitta",
    email: "lucas@clinicavitta.com.br",
    senha: "Lv&vitta064",
    papel: "Cliente",
    papelTipo: "padrao",
    leads: "—",
    enxerga: "Portal do cliente · só resultados",
    permissoes: [],
    ativo: true,
  },
  {
    initials: "RA",
    nome: "Roberto Alves",
    email: "roberto@clinicavitta.com.br",
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
  email: "roberto@clinicavitta.com.br",
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
export const campanhas = [
  {
    plataforma: "M",
    nome: "Emagrecimento · Consulta jul",
    sub: "42 leads · R$ 1.480 investidos",
    roas: "5,4x",
    barra: 90,
  },
  {
    plataforma: "G",
    nome: "Diabetes · Busca",
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
/* Automações (vivem dentro de cada etapa do funil)                          */
/* -------------------------------------------------------------------------- */

export type TipoGatilhoEtapa = "entrou" | "parado" | "saiu";

/** O que dispara a automação — sempre relativo ao card dentro da etapa onde ela foi criada. */
export const GATILHOS_ETAPA: {
  tipo: TipoGatilhoEtapa;
  label: string;
  precisaTempo?: boolean;
}[] = [
  { tipo: "entrou", label: "Quando um card entra nessa etapa" },
  {
    tipo: "parado",
    label: "Quando um card fica parado nessa etapa",
    precisaTempo: true,
  },
  { tipo: "saiu", label: "Quando um card sai dessa etapa" },
];

export const UNIDADES_TEMPO = ["minutos", "horas", "dias"] as const;

export type TipoAcaoAutomacao =
  | "mensagem"
  | "mensagem_interativa"
  | "documento"
  | "audio"
  | "lembrete"
  | "mover_funil";

/** Cada automação pode ter várias dessas ações, em sequência. */
export const TIPOS_ACAO_AUTOMACAO: { tipo: TipoAcaoAutomacao; label: string }[] = [
  { tipo: "mensagem", label: "Enviar mensagem" },
  { tipo: "mensagem_interativa", label: "Enviar mensagem com opções de resposta" },
  { tipo: "documento", label: "Enviar documento" },
  { tipo: "audio", label: "Enviar áudio" },
  { tipo: "lembrete", label: "Criar lembrete" },
  { tipo: "mover_funil", label: "Mover card pra outro funil / vendedor" },
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
        sub: "Conta conectada: Clínica Vitta Anúncios · atualiza a cada 1h",
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
        sub: "@clinicavitta",
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
