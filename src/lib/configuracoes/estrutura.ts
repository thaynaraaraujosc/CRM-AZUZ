import type { ComponentType, SVGProps } from "react";

import {
  IconCartao,
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

/**
 * WhatsApp e Instagram continuam existindo como categoria de verdade (a tela em si, o
 * conteúdo, os links "Conectar" da tela "Outras integrações") — só saíram da navegação lateral
 * a pedido, porque essa navegação ficou redundante com os cards de "Outras integrações". Ficam
 * fora de `GRUPOS_CONFIGURACOES` (não aparecem no menu) mas continuam resolvíveis por
 * `categoriaPorId`, senão os links `?categoria=whatsapp`/`?categoria=instagram` quebravam.
 */
const CATEGORIAS_OCULTAS_DO_MENU: CategoriaConfig[] = [
  { id: "whatsapp", label: "WhatsApp", descricao: "Conecte o número do WhatsApp do CRM.", Icon: IconWhatsApp },
  { id: "instagram", label: "Instagram e Facebook", descricao: "Conecte suas contas da Meta.", Icon: IconInstagram },
];

export const TODAS_CATEGORIAS: CategoriaConfig[] = [
  ...GRUPOS_CONFIGURACOES.flatMap((g) => g.categorias),
  ...CATEGORIAS_OCULTAS_DO_MENU,
];

export function categoriaPorId(id: CategoriaId): CategoriaConfig | undefined {
  return TODAS_CATEGORIAS.find((c) => c.id === id);
}
