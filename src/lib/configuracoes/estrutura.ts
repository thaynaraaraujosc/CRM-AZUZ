import type { ComponentType, SVGProps } from "react";

import {
  IconAutomacoes,
  IconCalendar,
  IconCartao,
  IconConfiguracoes,
  IconConversas,
  IconEquipe,
  IconErro,
  IconEscudo,
  IconHistorico,
  IconImage,
  IconImportar,
  IconInstagram,
  IconPipeline,
  IconSparkle,
  IconSwitch,
  IconText,
  IconWhatsApp,
  IconBell,
  IconDoc,
} from "@/components/icons";

export type CategoriaId =
  | "workspace"
  | "usuarios"
  | "equipes"
  | "funis"
  | "campos"
  | "etiquetas"
  | "canais"
  | "whatsapp"
  | "instagram"
  | "email"
  | "agenda"
  | "automacoes"
  | "azuz-ia"
  | "integracoes"
  | "notificacoes"
  | "aparencia"
  | "seguranca"
  | "auditoria"
  | "importacao"
  | "plano";

type IconeCategoria = ComponentType<SVGProps<SVGSVGElement>>;

export type CategoriaConfig = {
  id: CategoriaId;
  label: string;
  descricao: string;
  Icon: IconeCategoria;
};

export type GrupoConfig = {
  titulo: string;
  categorias: CategoriaConfig[];
};

export const GRUPOS_CONFIGURACOES: GrupoConfig[] = [
  {
    titulo: "Geral",
    categorias: [
      { id: "workspace", label: "Workspace", descricao: "Informações gerais e preferências deste ambiente de trabalho.", Icon: IconConfiguracoes },
      { id: "aparencia", label: "Aparência", descricao: "Tema, densidade e tamanho da interface.", Icon: IconImage },
      { id: "notificacoes", label: "Notificações", descricao: "Quando e como você é avisado.", Icon: IconBell },
    ],
  },
  {
    titulo: "Equipe e acesso",
    categorias: [
      { id: "usuarios", label: "Usuários e permissões", descricao: "Quem tem acesso e o que cada um pode fazer.", Icon: IconEquipe },
      { id: "equipes", label: "Equipes", descricao: "Grupos de atendimento e distribuição de leads.", Icon: IconEquipe },
      { id: "seguranca", label: "Segurança", descricao: "Autenticação, sessões e políticas de acesso.", Icon: IconEscudo },
      { id: "auditoria", label: "Auditoria e atividades", descricao: "Histórico do que aconteceu no workspace.", Icon: IconHistorico },
    ],
  },
  {
    titulo: "CRM",
    categorias: [
      { id: "funis", label: "Funis e etapas", descricao: "Como as negociações avançam no funil.", Icon: IconPipeline },
      { id: "campos", label: "Campos personalizados", descricao: "Campos extras em contatos, negócios e mais.", Icon: IconText },
      { id: "etiquetas", label: "Etiquetas", descricao: "Marcações usadas em contatos e automações.", Icon: IconErro },
      { id: "automacoes", label: "Automações", descricao: "Preferências gerais do construtor de automações.", Icon: IconAutomacoes },
    ],
  },
  {
    titulo: "Comunicação",
    categorias: [
      { id: "canais", label: "Canais de atendimento", descricao: "Visão geral de todos os canais conectados.", Icon: IconConversas },
      { id: "whatsapp", label: "WhatsApp", descricao: "Conexão, atendimento, mensagens e horários.", Icon: IconWhatsApp },
      { id: "instagram", label: "Instagram e Facebook", descricao: "Comentários, diretas e formulários de leads.", Icon: IconInstagram },
      { id: "email", label: "E-mail", descricao: "Contas, assinaturas e modelos de e-mail.", Icon: IconDoc },
      { id: "agenda", label: "Agenda e horários", descricao: "Duração, horários e tipos de compromisso.", Icon: IconCalendar },
    ],
  },
  {
    titulo: "Inteligência e integrações",
    categorias: [
      { id: "azuz-ia", label: "Azuz IA", descricao: "Comportamento, dados permitidos e sugestões.", Icon: IconSparkle },
      { id: "integracoes", label: "Integrações e aplicativos", descricao: "Conexões com outras ferramentas.", Icon: IconSwitch },
    ],
  },
  {
    titulo: "Dados e conta",
    categorias: [
      { id: "importacao", label: "Importação e exportação", descricao: "Trazer ou tirar dados do CRM.", Icon: IconImportar },
      { id: "plano", label: "Plano e cobrança", descricao: "Seu plano atual, uso e forma de pagamento.", Icon: IconCartao },
    ],
  },
];

export const TODAS_CATEGORIAS: CategoriaConfig[] = GRUPOS_CONFIGURACOES.flatMap((g) => g.categorias);

export function categoriaPorId(id: CategoriaId): CategoriaConfig | undefined {
  return TODAS_CATEGORIAS.find((c) => c.id === id);
}
