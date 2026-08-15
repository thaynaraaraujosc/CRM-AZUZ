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
  | "aparencia"
  | "notificacoes"
  | "seguranca"
  | "usuarios"
  | "equipes"
  | "campos"
  | "etiquetas"
  | "automacoes"
  | "agenda"
  | "importacao"
  | "auditoria"
  | "azuz-ia"
  | "canais"
  | "whatsapp"
  | "instagram"
  | "email"
  | "integracoes"
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

/**
 * Estrutura enxuta: só configurações realmente globais da conta ficam aqui — o que já tem módulo
 * próprio no menu principal (Funis e etapas → /funil; lista de usuários e convite → /equipe e
 * /equipe/convidar) saiu da navegação (o componente/código continua existindo, só não tem mais um
 * segundo caminho de navegação pra chegar nele). "Geral" ficou maior do que os 4 itens do pedido
 * original porque várias categorias (Campos personalizados, Etiquetas, Automações, Agenda,
 * Importação, Auditoria, Equipes, Funções) não têm nenhum outro módulo no CRM — escondê-las tornaria
 * a funcionalidade inacessível, o que contraria "não apagar/quebrar funcionalidade existente".
 */
export const GRUPOS_CONFIGURACOES: GrupoConfig[] = [
  {
    titulo: "Geral",
    categorias: [
      { id: "workspace", label: "Workspace", descricao: "Informações gerais e preferências deste ambiente de trabalho.", Icon: IconConfiguracoes },
      { id: "aparencia", label: "Aparência", descricao: "Tema, densidade e tamanho da interface.", Icon: IconImage },
      { id: "notificacoes", label: "Notificações", descricao: "Quando e como você é avisado.", Icon: IconBell },
      { id: "seguranca", label: "Segurança", descricao: "Autenticação, sessões e políticas de acesso.", Icon: IconEscudo },
      { id: "usuarios", label: "Funções e permissões", descricao: "Papéis personalizados e o que cada um pode fazer.", Icon: IconEquipe },
      { id: "equipes", label: "Equipes", descricao: "Grupos de atendimento e distribuição de leads.", Icon: IconEquipe },
      { id: "campos", label: "Campos personalizados", descricao: "Campos extras em contatos, negócios e mais.", Icon: IconText },
      { id: "etiquetas", label: "Etiquetas", descricao: "Marcações usadas em contatos e automações.", Icon: IconErro },
      { id: "automacoes", label: "Automações", descricao: "Preferências gerais do construtor de automações.", Icon: IconAutomacoes },
      { id: "agenda", label: "Agenda e horários", descricao: "Duração, horários e tipos de compromisso.", Icon: IconCalendar },
      { id: "importacao", label: "Importação e exportação", descricao: "Trazer ou tirar dados do CRM.", Icon: IconImportar },
      { id: "auditoria", label: "Auditoria e atividades", descricao: "Histórico do que aconteceu no workspace.", Icon: IconHistorico },
    ],
  },
  {
    titulo: "Inteligências",
    categorias: [
      { id: "azuz-ia", label: "Azuz IA", descricao: "Comportamento, dados permitidos e sugestões.", Icon: IconSparkle },
    ],
  },
  {
    titulo: "Integrações",
    categorias: [
      { id: "whatsapp", label: "WhatsApp", descricao: "Conexão, atendimento, mensagens e horários.", Icon: IconWhatsApp },
      { id: "instagram", label: "Instagram e Facebook", descricao: "Comentários, diretas e formulários de leads.", Icon: IconInstagram },
      { id: "canais", label: "Canais de atendimento", descricao: "Visão geral de todos os canais conectados.", Icon: IconConversas },
      { id: "email", label: "E-mail", descricao: "Contas, assinaturas e modelos de e-mail.", Icon: IconDoc },
      { id: "integracoes", label: "Outras integrações", descricao: "Conexões com outras ferramentas.", Icon: IconSwitch },
    ],
  },
  {
    titulo: "Plano e cobrança",
    categorias: [
      { id: "plano", label: "Plano e cobrança", descricao: "Seu plano atual, uso e forma de pagamento.", Icon: IconCartao },
    ],
  },
];

export const TODAS_CATEGORIAS: CategoriaConfig[] = GRUPOS_CONFIGURACOES.flatMap((g) => g.categorias);

export function categoriaPorId(id: CategoriaId): CategoriaConfig | undefined {
  return TODAS_CATEGORIAS.find((c) => c.id === id);
}
