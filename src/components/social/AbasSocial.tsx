"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegação interna do módulo Social.
 *
 * Mesma escolha das abas de Automações: são rotas de verdade, não estado. Cada aba tem endereço
 * próprio, abre direto, volta com o botão do navegador e o link pode ser mandado pra equipe.
 *
 * O módulo é separado do comercial porque os gatilhos são outros (comentário, story, menção) e o
 * canal tem limites próprios. O MOTOR é o mesmo: um robô social roda pelo mesmo código, grava na
 * mesma tabela de execuções e é versionado do mesmo jeito.
 */
const ABAS = [
  { href: "/social", label: "Painel", exato: true },
  { href: "/social/automacoes", label: "Automações", exato: false },
  { href: "/social/respostas", label: "Respostas automáticas", exato: false },
  { href: "/social/modelos", label: "Modelos", exato: false },
  { href: "/social/execucoes", label: "Execuções", exato: false },
  { href: "/social/disparos", label: "Disparos", exato: false },
  { href: "/social/conexoes", label: "Conexões", exato: false },
] as const;

export function AbasSocial() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="tabs automacoes-abas" aria-label="Seções de Social">
      {ABAS.map((aba) => {
        const ativa = aba.exato ? pathname === aba.href : pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={`tab${ativa ? " active" : ""}`}
            aria-current={ativa ? "page" : undefined}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
