import type { ComponentType, SVGProps } from "react";

import {
  IconContatos,
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
  IconRelogio,
} from "@/components/icons";

export type CategoriaId =
  | "perfil"
  /** Ids antigos: continuam resolvendo pra "Meu perfil", pra links e favoritos não quebrarem. */
  | "aparencia"
  | "notificacoes"
  | "expediente"
  | "seguranca"
  | "etiquetas"
  | "importacao"
  | "azuz-ia"
  | "empresa"
  | "whatsapp"
  | "instagram"
  | "integracoes"
  | "rastreamento"
  | "plano";

type IconeCategoria = ComponentType<SVGProps<SVGSVGElement>>;

export type CategoriaConfig = {
  id: CategoriaId;
  label: string;
  descricao: string;
  Icon: IconeCategoria;
  /**
   * A COR DO ÍCONE NO MENU. "Vamos dar vida pra essa região aqui."
   *
   * O menu eram dez ícones cinza, todos do mesmo traço e do mesmo tom: uma lista onde nada se
   * distingue de nada, e em que achar "Segurança" custa ler as dez palavras. Cor não é enfeite
   * aqui — é o que faz a pessoa acertar o item no segundo acesso sem ler.
   *
   * A regra que a Thaynara deu é a certa: "realmente as cores que são". Sino amarelo, relógio
   * cinza, escudo verde, cartão. Cada ícone na cor que a coisa tem no mundo, não numa paleta
   * inventada — é o que dispensa decorar.
   *
   * O valor é literal e não token: estas são cores de SINALIZAÇÃO, não da marca. Um token do CRM
   * mudaria junto com o tema e com a identidade, e aí o sino deixaria de ser amarelo.
   */
  cor?: string;
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
 * próprio no menu principal (Funis e etapas → /funil; usuários/equipes/campos/automações →
 * /equipe, /automacoes) saiu daqui de vez (eram redundantes com o módulo real, não só uma
 * segunda navegação pro mesmo lugar).
 */
export const GRUPOS_CONFIGURACOES: GrupoConfig[] = [
  {
    titulo: "Geral",
    categorias: [
      {
        id: "perfil",
        label: "Meu perfil",
        descricao: "Nome, telefone, e-mail, senha, foto, tema e os dados da sua empresa.",
        Icon: IconContatos,
        cor: "#3B82F6",
      },
      { id: "notificacoes", label: "Notificações", descricao: "Quando e como você é avisado.", Icon: IconBell, cor: "#F59E0B" },
      { id: "expediente", label: "Horário de funcionamento", descricao: "Quando o CRM considera que vocês estão abertos.", Icon: IconRelogio, cor: "#94A3B8" },
      /* Verde, e não amarelo como foi pedido: o sino logo acima já é o amarelo desta lista, e duas
         linhas vizinhas da mesma cor deixam as duas de dizer alguma coisa. Verde é a cor que um
         escudo tem no mundo. */
      { id: "seguranca", label: "Segurança", descricao: "Autenticação, sessões e políticas de acesso.", Icon: IconEscudo, cor: "#16A34A" },
      { id: "etiquetas", label: "Etiquetas", descricao: "Marcações usadas em contatos e automações.", Icon: IconErro, cor: "#8B5CF6" },
      { id: "importacao", label: "Importação e exportação", descricao: "Trazer ou tirar dados do CRM.", Icon: IconImportar, cor: "#0EA5E9", emBreve: true },
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
      { id: "azuz-ia", label: "Azuz IA", descricao: "Comportamento, dados permitidos e sugestões.", Icon: IconSparkle, cor: "#D2A366", emBreve: true },
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
      { id: "rastreamento", label: "Rastreamento de anúncios", descricao: "De qual anúncio veio cada lead.", Icon: IconSwitch, cor: "#EA580C" },
      { id: "integracoes", label: "Outras integrações", descricao: "Conexões com outras ferramentas.", Icon: IconSwitch, cor: "#6366F1" },
    ],
  },
  {
    titulo: "Plano e cobrança",
    categorias: [
      { id: "plano", label: "Plano e cobrança", descricao: "Seu plano atual, uso e forma de pagamento.", Icon: IconCartao, cor: "#0D9488" },
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
  /*
   * "APARÊNCIA" E "DADOS DA EMPRESA" VIRARAM "MEU PERFIL", e os ids continuam existindo.
   *
   * "Você vai trocar a aparência e dados da empresa por apenas um botão, que vai chamar meu
   * perfil." As duas eram uma linha de menu cada pra uma pergunta que ninguém faz separada: o
   * tema morava sozinho numa categoria com um interruptor dentro, e a empresa num grupo só dela.
   *
   * Eles ficam aqui, fora do menu mas resolvíveis, porque `?categoria=aparencia` pode estar num
   * favorito de alguém — e `categoriaPorId` devolvendo `undefined` escreve "Categoria não
   * encontrada" numa tela que existe. Quem resolve pra onde eles vão é `categoriaReal`.
   */
  { id: "aparencia", label: "Aparência", descricao: "Tema claro ou escuro.", Icon: IconImage },
  {
    id: "empresa",
    label: "Dados da empresa",
    descricao: "Logo, nome do espaço de trabalho e dados da sua agência.",
    Icon: IconContatos,
  },
];

/** Os ids aposentados e pra onde eles levam hoje. */
const APOSENTADAS: Partial<Record<CategoriaId, CategoriaId>> = {
  aparencia: "perfil",
  empresa: "perfil",
};

/** A categoria que deve de fato abrir, dado um id que pode ser antigo. */
export function categoriaReal(id: CategoriaId): CategoriaId {
  return APOSENTADAS[id] ?? id;
}

export const TODAS_CATEGORIAS: CategoriaConfig[] = [
  ...GRUPOS_CONFIGURACOES.flatMap((g) => g.categorias),
  ...CATEGORIAS_OCULTAS_DO_MENU,
];

export function categoriaPorId(id: CategoriaId): CategoriaConfig | undefined {
  return TODAS_CATEGORIAS.find((c) => c.id === id);
}
