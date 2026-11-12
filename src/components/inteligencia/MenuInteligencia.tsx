"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ITENS_INTELIGENCIA } from "@/lib/inteligencia/estrutura";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A CASCA DAS TELAS DE INTELIGÊNCIA COMERCIAL: o menu fixo à esquerda e a tela à direita.
 *
 * Ela não mexe no conteúdo de nenhuma página — cada uma continua desenhando o próprio `Topbar` e
 * o próprio `.content`. É de propósito: pôr o menu DENTRO do `.content` de cada página obrigaria a
 * editar as seis, e seis edições mecânicas em arquivos grandes é como se erra uma.
 *
 * Por isso o menu corre a altura inteira, ao lado da faixa de título também — lê como uma segunda
 * barra lateral, que é exatamente o que ele é.
 */
export function MenuInteligencia({ children }: { children: ReactNode }) {
  const { t: traduzir } = useIdioma();
  const pathname = usePathname();

  return (
    <div className="int-casca">
      <nav className="int-menu" aria-label={traduzir("Inteligência comercial")}>
        <p className="config-nav-grupo-h">{traduzir("Inteligência comercial")}</p>
        <div className="config-nav">
          {ITENS_INTELIGENCIA.map((item) => {
            const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`config-nav-item${ativo ? " active" : ""}`}
                aria-current={ativo ? "page" : undefined}
                title={traduzir(item.descricao)}
                /* O CRM Live mora fora da casca do app (tela cheia, pra TV). `target` não: trocar
                   de aba sem avisar é o tipo de coisa que faz a pessoa achar que perdeu a tela. */
              >
                <item.Icon width={16} height={16} aria-hidden="true" style={{ color: item.cor }} />
                <span>{traduzir(item.label)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="int-paginas">{children}</div>
    </div>
  );
}
