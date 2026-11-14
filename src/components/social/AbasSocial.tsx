"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

import { useIdioma } from "@/lib/idioma-context";
import {
  IconAutomacoes,
  IconInicio,
  IconDoc,
  IconRelatorios,
  IconEnviar,
} from "@/components/icons";

/**
 * Menu lateral do módulo Social Seller (o antigo "Instagram" dentro de Automações).
 *
 * A ordem é a do trabalho, não a alfabética. O Resumo primeiro, porque é onde se cai ao entrar e
 * onde se pergunta "como está indo". Depois o que se FAZ todo dia: montar automação, escrever
 * resposta automática, guardar modelo. Por último, separado por uma linha, o que se CONSULTA:
 * painel e execuções.
 *
 * "Disparos" e "Conexões" saíram daqui, e nenhum dos dois foi apagado. Disparo é um só, em
 * Automações → Disparo em massa, e sempre foi o mesmo backend. Conexão se administra em
 * Configurações, e sempre foi lá que o token viveu. Duas telas pro mesmo assunto obrigam a pessoa
 * a escolher por qual entrar, e a resposta certa nunca é óbvia.
 */
const PRINCIPAIS = [
  { href: "/social-seller", label: "Resumo", exato: true, Icon: IconInicio },
  /*
   * "AUTOMAÇÕES DO INSTAGRAM", e não só "Automações".
   *
   * "Fica parecendo que eu estou dentro de Automações, mas automações e Social Seller são blocos
   * separados." O endereço do editor já foi separado; o nome da aba era a outra metade: dois
   * módulos com um item chamado "Automações" cada um, e a pessoa não tem como saber em qual está
   * olhando pelo rótulo.
   */
  { href: "/social-seller/automacoes", label: "Automações do Instagram", exato: false, Icon: IconAutomacoes },
  { href: "/social-seller/respostas", label: "Lista de respostas", exato: false, Icon: IconEnviar },
  { href: "/social-seller/modelos", label: "Meus templates", exato: false, Icon: IconDoc },
] as const;

/*
 * O PAINEL SAIU DO MENU, e a tela não foi apagada.
 *
 * Ele respondia a mesma pergunta do Resumo com mais números, e no menu os dois disputavam: quem
 * abre o módulo não tem como saber qual dos dois tem a resposta. Agora a porta do painel é uma
 * só, o "Ver painel completo" lá dentro do Resumo, onde a pergunta "e o que mais?" aparece.
 *
 * Execuções fica: ela responde outra coisa — "este robô rodou? deu erro?" —, e é a única tela do
 * módulo que responde isso.
 */
const CONSULTA = [
  { href: "/social-seller/execucoes", label: "Execuções", exato: false, Icon: IconRelatorios },
] as const;

function Item({
  href,
  label,
  exato,
  Icon,
  pathname,
}: {
  href: string;
  label: string;
  exato: boolean;
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  pathname: string;
}) {
  const { t: traduzir } = useIdioma();
  const ativo = exato ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} className={`social-menu-item${ativo ? " on" : ""}`} aria-current={ativo ? "page" : undefined}>
      <Icon width={15} height={15} />
      <span>{traduzir(label)}</span>
    </Link>
  );
}

export function AbasSocial() {
  const { t: traduzir } = useIdioma();
  const pathname = usePathname() ?? "";
  return (
    <nav className="social-menu" aria-label={traduzir("Seções do Social Seller")}>
      {PRINCIPAIS.map((i) => (
        <Item key={i.href} {...i} pathname={pathname} />
      ))}
      <hr className="social-menu-linha" />
      {CONSULTA.map((i) => (
        <Item key={i.href} {...i} pathname={pathname} />
      ))}
    </nav>
  );
}
