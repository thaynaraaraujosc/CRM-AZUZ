"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import { currentUser, workspace } from "@/lib/data";
import {
  IconAcoes,
  IconAutomacoes,
  IconConfiguracoes,
  IconContatos,
  IconEquipe,
  IconInicio,
  IconPipeline,
  IconRelatorios,
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
  { href: "/configuracoes", label: "Configurações", Icon: IconConfiguracoes },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="brand-mark">a</div>
        <span className="wordmark">azuz crm</span>
      </div>

      <div className="sb-workspace">
        <p className="l">Workspace</p>
        <p className="v">{workspace.name}</p>
      </div>

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
      </div>
    </aside>
  );
}
