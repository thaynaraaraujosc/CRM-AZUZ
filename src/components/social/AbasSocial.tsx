"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

import {
  IconAutomacoes,
  IconDoc,
  IconRelatorios,
  IconTrafego,
  IconEnviar,
} from "@/components/icons";

/**
 * Menu lateral do módulo Instagram e TikTok.
 *
 * A ordem é a do trabalho, não a alfabética. Primeiro o que se faz todo dia: montar automação,
 * escrever resposta automática, guardar modelo. Depois, separado por uma linha, o que se
 * CONSULTA: painel e execuções.
 *
 * "Disparos" e "Conexões" saíram daqui, e nenhum dos dois foi apagado. Disparo é um só, em
 * Automações → Disparo em massa, e sempre foi o mesmo backend. Conexão se administra em
 * Configurações, e sempre foi lá que o token viveu. Duas telas pro mesmo assunto obrigam a pessoa
 * a escolher por qual entrar, e a resposta certa nunca é óbvia.
 */
const PRINCIPAIS = [
  { href: "/automacoes/social", label: "Automações", exato: true, Icon: IconAutomacoes },
  { href: "/automacoes/social/respostas", label: "Resposta automática", exato: false, Icon: IconEnviar },
  { href: "/automacoes/social/modelos", label: "Meus Templates", exato: false, Icon: IconDoc },
] as const;

const CONSULTA = [
  { href: "/automacoes/social/painel", label: "Painel", exato: false, Icon: IconTrafego },
  { href: "/automacoes/social/execucoes", label: "Execuções", exato: false, Icon: IconRelatorios },
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
