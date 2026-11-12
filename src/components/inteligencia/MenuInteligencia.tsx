"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ITENS_INTELIGENCIA } from "@/lib/inteligencia/estrutura";
import { useIdioma } from "@/lib/idioma-context";
import { useSession } from "next-auth/react";
import { permissaoDoEndereco } from "@/lib/permissao-da-rota";

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
  const { data: sessao } = useSession();

  /* A coluna segue a mesma regra do menu lateral: só lista o que a pessoa consegue abrir. Hoje as
     sete telas pedem a mesma permissão (`rel_visualizar`), então ou aparecem todas ou nenhuma —
     mas a checagem é por item, pra continuar certa no dia em que uma delas tiver a sua. */
  const vêTudo = Boolean(sessao?.user?.superAdmin) || sessao?.user?.papelTipo === "admin";
  const permissoes = sessao?.user?.permissoes ?? [];
  const itens = ITENS_INTELIGENCIA.filter((item) => {
    if (vêTudo) return true;
    const exigida = permissaoDoEndereco(item.href);
    return !exigida || permissoes.includes(exigida);
  });

  return (
    <div className="int-casca">
      <nav className="int-menu" aria-label={traduzir("Inteligência comercial")}>
        <p className="config-nav-grupo-h">{traduzir("Inteligência comercial")}</p>
        <div className="config-nav">
          {itens.map((item) => {
            const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);

            /*
             * O CRM LIVE ABRE NUMA JANELA PRÓPRIA.
             *
             * "Ele tem que abrir em outra janela, porque é como se fosse algo que vai ficar aberto
             * dentro de uma empresa. Enquanto o cara tá mexendo no CRM, o CRM Live tá aberto lá."
             *
             * É o único item daqui que não é uma tela pra visitar: é um painel pra DEIXAR ABERTO,
             * na TV da sala. Abrir no lugar do CRM tiraria da pessoa a tela em que ela estava
             * trabalhando pra mostrar um painel que ela não ia ficar olhando.
             *
             * Tag `<a>` e não `<Link>`: ele vive fora da casca do app, e o roteador do Next não
             * tem o que pré-carregar de uma janela nova.
             */
            if (item.telaCheia) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="config-nav-item"
                  title={traduzir("Abre numa janela nova, pra deixar na TV da sala")}
                >
                  <item.Icon width={16} height={16} aria-hidden="true" style={{ color: item.cor }} />
                  <span>{traduzir(item.label)}</span>
                  <span className="int-menu-tv">{traduzir("TV")}</span>
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`config-nav-item${ativo ? " active" : ""}`}
                aria-current={ativo ? "page" : undefined}
                title={traduzir(item.descricao)}
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
