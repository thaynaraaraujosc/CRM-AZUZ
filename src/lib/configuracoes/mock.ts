/** Dados mockados usados pelas telas de Configurações — nada aqui liga em API real (item 20, 27 etc). */

export type ModeloSegmento = {
  id: string;
  nome: string;
  descricao: string;
  funis: string[];
  automacoes: number;
  camposPersonalizados: number;
  mensagensProntas: number;
  etapas: string[];
  etiquetas: string[];
};

export const MODELOS_SEGMENTO: ModeloSegmento[] = [
  {
    id: "clinica-medica",
    nome: "Clínica médica",
    descricao: "Funil de consultas, confirmação de agendamento e retorno de pacientes.",
    funis: ["Consultas", "Retornos"],
    automacoes: 6,
    camposPersonalizados: 8,
    mensagensProntas: 10,
    etapas: ["Novo", "Agendado", "Atendido", "Retorno"],
    etiquetas: ["Paciente novo", "Convênio", "Particular"],
  },
  {
    id: "odontologia",
    nome: "Odontologia",
    descricao: "Triagem, orçamento de tratamento e acompanhamento de sessões.",
    funis: ["Avaliação", "Tratamento"],
    automacoes: 7,
    camposPersonalizados: 9,
    mensagensProntas: 12,
    etapas: ["Novo", "Avaliação", "Orçamento", "Em tratamento"],
    etiquetas: ["Urgência", "Estético", "Convênio"],
  },
  {
    id: "estetica",
    nome: "Estética",
    descricao: "Captação por Instagram, agendamento de procedimentos e pacotes.",
    funis: ["Procedimentos"],
    automacoes: 5,
    camposPersonalizados: 6,
    mensagensProntas: 9,
    etapas: ["Novo", "Interessado", "Agendado", "Fidelizado"],
    etiquetas: ["Instagram", "Pacote", "Indicação"],
  },
  {
    id: "imobiliaria",
    nome: "Imobiliária",
    descricao: "Qualificação de interesse, visitas e propostas de imóveis.",
    funis: ["Locação", "Venda"],
    automacoes: 8,
    camposPersonalizados: 11,
    mensagensProntas: 14,
    etapas: ["Novo", "Qualificado", "Visita agendada", "Proposta"],
    etiquetas: ["Locação", "Venda", "Financiamento"],
  },
  {
    id: "concessionaria",
    nome: "Concessionária",
    descricao: "Test-drive, proposta de financiamento e pós-venda.",
    funis: ["Vendas", "Pós-venda"],
    automacoes: 9,
    camposPersonalizados: 10,
    mensagensProntas: 13,
    etapas: ["Novo", "Test-drive", "Proposta", "Fechado"],
    etiquetas: ["0km", "Seminovo", "Financiado"],
  },
  {
    id: "empresa-toldos",
    nome: "Empresa de toldos",
    descricao: "Orçamento por medidas, catálogo de modelos e agendamento de instalação.",
    funis: ["Orçamentos"],
    automacoes: 5,
    camposPersonalizados: 7,
    mensagensProntas: 8,
    etapas: ["Novo", "Orçamento enviado", "Aprovado", "Instalado"],
    etiquetas: ["Residencial", "Comercial", "Urgente"],
  },
  {
    id: "agencia",
    nome: "Agência",
    descricao: "Captação de briefing, proposta de escopo e acompanhamento de contrato.",
    funis: ["Propostas"],
    automacoes: 6,
    camposPersonalizados: 9,
    mensagensProntas: 10,
    etapas: ["Novo", "Briefing", "Proposta", "Contrato assinado"],
    etiquetas: ["Marketing", "Design", "Recorrente"],
  },
  {
    id: "turismo",
    nome: "Turismo",
    descricao: "Pacotes de viagem, reserva e confirmação de embarque.",
    funis: ["Pacotes"],
    automacoes: 6,
    camposPersonalizados: 8,
    mensagensProntas: 11,
    etapas: ["Novo", "Cotação", "Reservado", "Confirmado"],
    etiquetas: ["Nacional", "Internacional", "Grupo"],
  },
  {
    id: "advocacia",
    nome: "Advocacia",
    descricao: "Triagem de caso, proposta de honorários e acompanhamento processual.",
    funis: ["Casos"],
    automacoes: 5,
    camposPersonalizados: 10,
    mensagensProntas: 9,
    etapas: ["Novo", "Triagem", "Proposta", "Em andamento"],
    etiquetas: ["Cível", "Trabalhista", "Urgente"],
  },
  {
    id: "personalizado",
    nome: "Configuração personalizada",
    descricao: "Começa do zero — sem funis, automações ou campos pré-configurados.",
    funis: [],
    automacoes: 0,
    camposPersonalizados: 0,
    mensagensProntas: 0,
    etapas: [],
    etiquetas: [],
  },
];

export const SEGMENTOS_NEGOCIO = [
  "Clínica médica",
  "Odontologia",
  "Estética",
  "Agência",
  "Imobiliária",
  "Concessionária",
  "Turismo",
  "Advocacia",
  "Varejo",
  "Serviços",
  "Outro",
];

export const PAISES = ["Brasil", "Portugal", "Estados Unidos"];
export const IDIOMAS = ["Português (Brasil)", "Português (Portugal)", "English (US)", "Español"];
export const MOEDAS = ["BRL (R$)", "USD ($)", "EUR (€)"];
export const FUSOS_HORARIOS = ["America/Sao_Paulo", "America/Manaus", "America/New_York", "Europe/Lisbon"];
