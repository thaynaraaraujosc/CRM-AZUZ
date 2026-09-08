import type { ComponentType, SVGProps } from "react";

import {
  IconCartao,
  IconEscudo,
  IconErro,
  IconImage,
  IconImportar,
  IconInstagram,
  IconSparkle,
  IconSwitch,
  IconWhatsApp,
  IconBell,
} from "@/components/icons";

export type CategoriaId =
  | "aparencia"
  | "notificacoes"
  | "seguranca"
  | "etiquetas"
  | "importacao"
  | "azuz-ia"
  | "whatsapp"
  | "instagram"
  | "integracoes"
  | "plano";

type IconeCategoria = ComponentType<SVGProps<SVGSVGElement>>;

export type CategoriaConfig = {
  id: CategoriaId;
  label: string;
  descricao: string;
  Icon: IconeCategoria;
  /** Mostra a tag "Em breve" ao lado do label e troca o conteúdo da categoria por uma vitrine
   * informativa em vez do formulário. Mesmo padrão já usado em Azuz IA (`/azuz-ia`). */
  emBreve?: boolean;
};

export type GrupoConfig = {
  titulo: string;
  categorias: CategoriaConfig[];
};

/**
 * Estrutura enxuta: só configurações realmente globais da conta ficam aqui. O que já tem módulo
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
      /* "Auditoria e atividades" saiu daqui. A tela mostrava quatro linhas escritas à mão, com
         nomes de pessoas que não existem em workspace nenhum, e os filtros filtravam esse array.
         Nada era lido do banco.
         Pra existir de verdade ela precisa de uma tabela gravando QUEM fez O QUÊ, e de escrita em
         cada ponto de ação (mover card, editar contato, publicar automação, convidar membro,
         excluir). O `EventoDoLead`, que é o que chega mais perto hoje, guarda evento por LEAD e não
         tem usuário: não responde a única pergunta que uma auditoria existe pra responder.
         Detalhe que decide QUANDO fazer: auditoria não é retroativa. Ela precisa estar gravando
         antes do primeiro cliente com equipe, senão o histórico daquele período não existe. */
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
      /* "E-mail" saiu daqui. A tela prometia conectar a caixa de entrada da empresa pra receber e
         responder e-mail dentro do CRM: "Conectar conta" não conectava nada, e tudo era estado
         local que sumia no F5.
         O que o CRM faz de e-mail continua funcionando e não foi tocado: recuperação de senha,
         aviso de e-mail alterado, convite de equipe e o bloco "Enviar e-mail" das automações, todos
         pelo Resend (ver src/lib/email.ts). O que saiu foi só a promessa de caixa de entrada.
         Decisão da Thaynara depois do levantamento: o diferencial do produto é WhatsApp e
         Instagram, caixa de e-mail competiria com o Gmail que o cliente já tem aberto, e enviar em
         nome do domínio de cada cliente exige SPF/DKIM/DMARC por cliente. Errar isso manda o
         e-mail dele pro spam, e a culpa cai no CRM. */
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
 * conteúdo, os links "Conectar" da tela "Outras integrações"). Só saíram da navegação lateral
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
