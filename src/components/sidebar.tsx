"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type SVGProps } from "react";

import { currentUser, equipe, workspace } from "@/lib/data";
import {
  IconAcoes,
  IconAutomacoes,
  IconConfiguracoes,
  IconContatos,
  IconEquipe,
  IconInicio,
  IconPipeline,
  IconRelatorios,
  IconSparkle,
  IconSwitch,
  IconTarefas,
  IconTrafego,
  IconWhatsApp,
} from "@/components/icons";

type NavEntry = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const navEntries: NavEntry[] = [
  { href: "/inicio", label: "Início", Icon: IconInicio },
  { href: "/conversas", label: "WhatsApp", Icon: IconWhatsApp },
  { href: "/funil", label: "Funil", Icon: IconPipeline },
  { href: "/tarefas", label: "Tarefas", Icon: IconTarefas },
  { href: "/acoes", label: "Ações", Icon: IconAcoes },
  { href: "/equipe", label: "Equipe", Icon: IconEquipe },
  { href: "/contatos", label: "Contatos", Icon: IconContatos },
  { href: "/trafego", label: "Tráfego", Icon: IconTrafego },
  { href: "/relatorios", label: "Relatórios", Icon: IconRelatorios },
  { href: "/automacoes", label: "Automações", Icon: IconAutomacoes },
  { href: "/azuz-ia", label: "Azuz IA", Icon: IconSparkle },
  { href: "/configuracoes", label: "Configurações", Icon: IconConfiguracoes },
];

export function Sidebar() {
  const pathname = usePathname();
  const [contaAberta, setContaAberta] = useState(false);

  const outrosMembros = equipe.filter((m) => m.nome !== currentUser.name);

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="brand-mark">a</div>
        <span className="wordmark">azuz crm</span>
      </div>

      <Link href="/configuracoes#workspace" className="sb-workspace">
        <p className="l">Workspace</p>
        <p className="v">{workspace.name}</p>
      </Link>

      <nav className="nav">
        {navEntries.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="sb-foot">
        <div className="avatar sm">{currentUser.initials}</div>
        <div>
          <p className="who">{currentUser.name}</p>
          <p className="role">{currentUser.role}</p>
        </div>
        <button
          type="button"
          className="sb-foot-toggle"
          aria-label="Opções da conta"
          onClick={() => setContaAberta((v) => !v)}
        >
          <IconSwitch width={15} height={15} />
        </button>

        {contaAberta ? (
          <div className="account-pop">
            <div className="dropdown-item" style={{ borderBottom: "1px solid var(--line)" }}>
              <span className="n">Trocar de conta</span>
              <span className="r">Você está como {currentUser.name}</span>
            </div>
            {outrosMembros.map((m) => (
              <button
                type="button"
                key={m.nome}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => setContaAberta(false)}
              >
                <span className="n">{m.nome}</span>
                <span className="r">{m.papel}</span>
              </button>
            ))}
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left", color: "var(--blue)" }}
              onClick={() => setContaAberta(false)}
            >
              <span className="n">Sair</span>
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
