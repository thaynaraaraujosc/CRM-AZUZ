"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useIdioma } from "@/lib/idioma-context";

/**
 * Navegação interna do módulo de Automações: Automatizar funil · Templates · Disparo em massa.
 *
 * "Automações" e "Automatizar funil" eram DUAS abas, e duas abas passam a ideia de dois sistemas:
 * foi a primeira coisa que quem abriu a tela perguntou. Sempre foram os mesmos robôs e os mesmos
 * gatilhos. Agora é uma entrada só, e a escolha de olhar por etapa ou por robô virou uma troca de
 * visão dentro da própria tela, onde ela não parece outro produto.
 *
 * "Instagram" MOROU AQUI, e saiu em 03/11/2026 pra virar o Social Seller, no menu lateral.
 *
 * O raciocínio antigo era que automação de rede social é automação, e que uma entrada própria no
 * menu recriaria a impressão de dois produtos. O uso desmentiu: o Social Seller tem menu próprio
 * (automações, resposta automática, templates, painel, execuções), e um módulo com menu lateral
 * dentro de uma ABA de outro módulo é que parecia dois produtos — a pessoa entrava em Automações
 * pra mexer no funil e caía numa tela com outra navegação dentro. Automatizar o atendimento do
 * Direct e automatizar a esteira comercial são dois trabalhos, feitos por gente diferente.
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

/**
 * "Formulários do Flow" SÓ EXISTE PARA QUEM TEM O FLOW.
 *
 * O CRM é vendido sozinho: a maioria das agências não usa o AZUZ Flow, e para elas essa aba seria
 * um lugar a mais que só sabe dizer "conecte primeiro". Uma aba que nunca tem nada dentro ensina a
 * ignorar a barra de abas.
 *
 * A pergunta é feita uma vez por montagem, numa rota que a tela já usa. Enquanto a resposta não
 * chega, a aba não aparece — aparecer e sumir seria pior do que demorar um instante a mais.
 */
function useFlowConectado(): boolean {
  const [conectado, setConectado] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch("/api/integracoes/azuz-flow/formularios")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: { conectado?: unknown } | null) => {
        if (vivo) setConectado(dados?.conectado === true);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return conectado;
}

export function AbasAutomacoes() {
  const { t: traduzir } = useIdioma();
  const pathname = usePathname() ?? "";
  const flowConectado = useFlowConectado();

  const abas = flowConectado
    ? [
        ABAS[0],
        // Os formulários do AZUZ Flow e o que acontece com cada um. Entra aqui, e não em
        // Configurações, porque a pergunta que ele responde é "o que acontece quando preenchem
        // este formulário" — que é automação. Em Configurações fica só o que conecta.
        { href: "/automacoes/formularios-flow", label: "Formulários do Flow", exato: false } as const,
        ...ABAS.slice(1),
      ]
    : [...ABAS];

  return (
    <nav className="tabs automacoes-abas" aria-label={traduzir("Seções de Automações")}>
      {abas.map((aba) => {
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
            {traduzir(aba.label)}
          </Link>
        );
      })}
    </nav>
  );
}
