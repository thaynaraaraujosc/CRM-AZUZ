"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { IconConfiguracoes, IconContatos, IconEquipe, IconInicio } from "@/components/icons";

const ITENS = [
  { href: "/admin", label: "Dashboard", Icon: IconInicio },
  { href: "/admin/workspaces", label: "Workspaces", Icon: IconContatos },
  { href: "/admin/usuarios", label: "Usuários", Icon: IconEquipe },
];

/** Sidebar do painel de super-admin — deliberadamente sem nenhuma das dependências de contexto da
 * `Sidebar` do app normal (workspace/funis/equipe), porque esse painel é cross-tenant, não faz
 * sentido carregar dado de um workspace específico aqui. */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="brand-mark">a</div>
        <span className="wordmark">azuz admin</span>
      </div>

      <nav className="nav">
        {ITENS.map(({ href, label, Icon }) => {
          const ativo = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`nav-item${ativo ? " active" : ""}`}>
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="sb-foot">
        <button type="button" className="nav-item" style={{ width: "100%", cursor: "pointer" }} onClick={() => signOut({ callbackUrl: "/login" })}>
          <IconConfiguracoes />
          Sair
        </button>
      </div>
    </aside>
  );
}
