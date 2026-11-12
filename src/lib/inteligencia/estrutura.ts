import type { ComponentType, SVGProps } from "react";

import {
  IconContatos,
  IconDoc,
  IconErro,
  IconRelatorios,
  IconSparkle,
  IconTarefas,
  IconTrafego,
} from "@/components/icons";

/**
 * AS TELAS DE INTELIGÊNCIA COMERCIAL, numa lista só.
 *
 * "Quando eu clico em inteligência comercial, já abre tudo. Eu não preciso desse tanto de bloco.
 * Talvez quando eu entro abre um menu lateral igual lá em configurações, e aí eu escolho."
 *
 * Elas viviam num submenu que abria ao passar o mouse sobre o item do menu lateral: sete opções
 * flutuando sobre o conteúdo, que somem quando o ponteiro escorrega e que, num celular, não
 * existem. Para andar entre duas delas era preciso voltar ao menu e acertar o alvo de novo.
 *
 * Agora é o desenho de Configurações: entra em Tráfego e as sete ficam numa coluna fixa ao lado,
 * sempre visíveis. Trocar de tela é um clique, e dá pra ver quais existem sem procurar.
 *
 * A COR DE CADA ÍCONE segue a mesma regra do menu de Configurações: a cor que a coisa tem no
 * mundo, para a pessoa acertar no segundo acesso sem ler. Valor literal e não token, porque é
 * sinalização e não identidade — um token mudaria junto com o tema.
 */
export type ItemInteligencia = {
  href: string;
  label: string;
  descricao: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  cor: string;
  /** Abre fora da casca do CRM (tela cheia, para projetor). */
  telaCheia?: boolean;
};

export const ITENS_INTELIGENCIA: ItemInteligencia[] = [
  {
    href: "/trafego",
    label: "Tráfego",
    descricao: "Quanto se investiu, quanto custou cada lead e cada venda.",
    Icon: IconTrafego,
    cor: "#EA580C",
  },
  {
    href: "/atividades-vendas",
    label: "Atividades",
    descricao: "O que a equipe fez: mensagens, ligações, reuniões.",
    Icon: IconTarefas,
    cor: "#3B82F6",
  },
  {
    href: "/performance-vendas",
    label: "Performance",
    descricao: "Como cada pessoa e cada etapa estão convertendo.",
    Icon: IconRelatorios,
    cor: "#16A34A",
  },
  {
    href: "/jornada-cliente",
    label: "Jornada do cliente",
    descricao: "Do primeiro contato até a última interação.",
    Icon: IconContatos,
    cor: "#8B5CF6",
  },
  {
    href: "/motivos-perda",
    label: "Motivos de perda",
    descricao: "Por que os negócios que não fecharam não fecharam.",
    Icon: IconErro,
    cor: "#E11D48",
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    descricao: "Os números do período, prontos para exportar.",
    Icon: IconDoc,
    cor: "#0D9488",
  },
  {
    /* Vive FORA da casca do CRM (sem menu, sem cabeçalho): é feito para ficar numa TV na parede.
       Continua na lista porque é daqui que se chega nele — tirá-lo esconderia a tela. */
    href: "/crm-live",
    label: "CRM Live",
    descricao: "O painel em tempo real, para deixar na tela da sala.",
    Icon: IconSparkle,
    cor: "#D2A366",
    telaCheia: true,
  },
];

/** A primeira tela do grupo: é onde "Inteligência comercial" abre. */
export const INTELIGENCIA_INICIAL = ITENS_INTELIGENCIA[0].href;
