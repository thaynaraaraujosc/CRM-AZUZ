"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegação interna do módulo de Automações: Automatizar funil · Templates · Disparo em massa.
 *
 * "Automações" e "Automatizar funil" eram DUAS abas, e duas abas passam a ideia de dois sistemas:
 * foi a primeira coisa que quem abriu a tela perguntou. Sempre foram os mesmos robôs e os mesmos
 * gatilhos. Agora é uma entrada só, e a escolha de olhar por etapa ou por robô virou uma troca de
 * visão dentro da própria tela, onde ela não parece outro produto.
 *
 * "Disparo em massa" era o item "Ações" do menu principal. Ele saiu de lá porque mandar mensagem
 * pra muita gente de uma vez é um tipo de automação (a mais simples), e ter dois lugares no menu
 * pra "mandar mensagem" fazia a pessoa procurar no errado. Templates entra aqui pelo mesmo motivo:
 * é a mensagem reutilizável que tanto o disparo quanto o construtor de automações vão escolher.
 *
 * São rotas de verdade (não estado), de propósito: cada aba tem endereço próprio, dá pra abrir
 * direto, voltar com o botão do navegador e mandar o link pra alguém da equipe.
 */
const ABAS = [
  { href: "/automacoes", label: "Automatizar funil", exato: true },
  { href: "/automacoes/templates", label: "Templates", exato: false },
  { href: "/automacoes/disparos", label: "Disparo em massa", exato: false },
] as const;

export function AbasAutomacoes() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="tabs automacoes-abas" aria-label="Seções de Automações">
      {ABAS.map((aba) => {
        const ativa = aba.exato
          ? pathname === aba.href || pathname.startsWith("/automacoes/editor")
          : pathname.startsWith(aba.href);
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
