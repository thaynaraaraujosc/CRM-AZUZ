"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

import {
  IconAutomacoes,
  IconDoc,
  IconRelatorios,
  IconTrafego,
  IconInstagram,
  IconConfiguracoes,
  IconEnviar,
} from "@/components/icons";

/**
 * Menu lateral do módulo Instagram e TikTok.
 *
 * Coluna à esquerda, e não mais uma fileira de abas: com sete destinos, a fileira virava uma
 * régua de rótulos onde nenhum se destaca, e o que a pessoa mais usa (a lista de automações)
 * ficava do mesmo tamanho de "Conexões", que se abre uma vez por mês.
 *
 * A ordem é a do trabalho, não a alfabética. Primeiro o que se faz todo dia: montar automação,
 * escrever resposta automática, guardar modelo. Depois, separado por uma linha, o que se
 * CONSULTA: painel, execuções, disparos e conexões.
 */
const PRINCIPAIS = [
  { href: "/automacoes/social", label: "Automações", exato: true, Icon: IconAutomacoes },
  { href: "/automacoes/social/respostas", label: "Resposta automática", exato: false, Icon: IconEnviar },
  { href: "/automacoes/social/modelos", label: "Meus Templates", exato: false, Icon: IconDoc },
] as const;

const CONSULTA = [
  { href: "/automacoes/social/painel", label: "Painel", exato: false, Icon: IconTrafego },
  { href: "/automacoes/social/execucoes", label: "Execuções", exato: false, Icon: IconRelatorios },
  { href: "/automacoes/social/disparos", label: "Disparos", exato: false, Icon: IconInstagram },
  { href: "/automacoes/social/conexoes", label: "Conexões", exato: false, Icon: IconConfiguracoes },
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
  const ativo = exato ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} className={`social-menu-item${ativo ? " on" : ""}`} aria-current={ativo ? "page" : undefined}>
      <Icon width={15} height={15} />
      <span>{label}</span>
    </Link>
  );
}

export function AbasSocial() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="social-menu" aria-label="Seções de Instagram e TikTok">
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
