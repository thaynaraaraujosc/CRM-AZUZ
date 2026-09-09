"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * As duas telas do Instagram: a conversa e a carteira.
 *
 * Só duas, de propósito. A caixa de entrada é onde se atende; os contatos são onde se olha a base
 * inteira e se age sobre muitos de uma vez. São dois gestos diferentes, e cada um tem uma tela.
 */
const ABAS = [
  { href: "/instagram", label: "Conversas", exato: true },
  { href: "/instagram/contatos", label: "Contatos", exato: false },
] as const;

export function AbasInstagram() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="tabs automacoes-abas" aria-label="Seções do Instagram">
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
