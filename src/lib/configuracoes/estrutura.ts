import type { ComponentType, SVGProps } from "react";

import {
  IconCartao,
  IconConversas,
  IconEscudo,
  IconErro,
  IconHistorico,
  IconImage,
  IconImportar,
  IconInstagram,
  IconSparkle,
  IconSwitch,
  IconWhatsApp,
  IconBell,
  IconDoc,
} from "@/components/icons";

export type CategoriaId =
  | "aparencia"
  | "notificacoes"
  | "seguranca"
  | "etiquetas"
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
  /** Mostra a tag "Em breve" ao lado do label e troca o conteúdo da categoria por uma vitrine
   * informativa em vez do formulário — mesmo padrão já usado em Azuz IA (`/azuz-ia`). */
  emBreve?: boolean;
};

export type GrupoConfig = {
  titulo: string;
  categorias: CategoriaConfig[];
};

/**
 * Estrutura enxuta: só configurações realmente globais da conta ficam aqui — o que já tem módulo
 * próprio no menu principal (Funis e etapas → /funil; usuários/equipes/campos/automações/agenda →
 * /equipe, /automacoes, /agenda) saiu daqui de vez (eram redundantes com o módulo real, não só uma
 * segunda navegação pro mesmo lugar).
 */
export const GRUPOS_CONFIGURACOES: GrupoConfig[] = [
  {
    titulo: "Geral",
    categorias: [
      { id: "aparencia", label: "Aparência", descricao: "Tema claro ou escuro.", Icon: IconImage },
      { id: "notificacoes", label: "Notificações", descricao: "Quando e como você é avisado.", Icon: IconBell },
      { id: "seguranca", label: "Segurança", descricao: "Autenticação, sessões e políticas de acesso.", Icon: IconEscudo },
      { id: "etiquetas", label: "Etiquetas", descricao: "Marcações usadas em contatos e automações.", Icon: IconErro },
      { id: "importacao", label: "Importação e exportação", descricao: "Trazer ou tirar dados do CRM.", Icon: IconImportar, emBreve: true },
      { id: "auditoria", label: "Auditoria e atividades", descricao: "Histórico do que aconteceu no workspace.", Icon: IconHistorico },
    ],
  },
  {
    titulo: "Inteligências",
    categorias: [
      { id: "azuz-ia", label: "Azuz IA", descricao: "Comportamento, dados permitidos e sugestões.", Icon: IconSparkle, emBreve: true },
    ],
  },
  {
    titulo: "Integrações",
    categorias: [
      { id: "whatsapp", label: "WhatsApp", descricao: "Conecte o número do WhatsApp do CRM.", Icon: IconWhatsApp },
      { id: "instagram", label: "Instagram e Facebook", descricao: "Conecte suas contas da Meta.", Icon: IconInstagram },
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
