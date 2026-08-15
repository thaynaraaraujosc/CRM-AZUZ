"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { PLANOS, type PlanoId } from "@/lib/assinatura/planos";

type WorkspaceLinha = {
  id: string;
  nome: string;
  slug: string;
  criadoEm: string;
  _count: { membros: number };
  assinatura: { plano: string; status: string; valor: string } | null;
};

const NOME_STATUS: Record<string, string> = {
  pendente: "Pendente",
  ativa: "Ativo",
  atrasada: "Atrasado",
  cancelada: "Cancelado",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Lista de todos os workspaces da plataforma — nome, quantos usuários, plano/status da
 * assinatura. Clicar numa linha abre o detalhe pra editar plano/acessos. */
export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceLinha[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/workspaces")
      .then((r) => r.json())
      .then(setWorkspaces);
  }, []);

  return (
    <div className="view">
      <Topbar title="Workspaces" sub={workspaces ? `${workspaces.length} empresas cadastradas` : undefined} />

      <div className="config-tabela-scroll" style={{ margin: "0 17px 17px" }}>
        <table className="config-tabela-notif">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Usuários</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {!workspaces ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-muted)" }}>Carregando…</td>
              </tr>
            ) : workspaces.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-muted)" }}>Nenhum workspace ainda.</td>
              </tr>
            ) : (
              workspaces.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/admin/workspaces/${w.id}`} style={{ fontWeight: 600 }}>
                      {w.nome}
                    </Link>
                  </td>
                  <td>{w._count.membros}</td>
                  <td>{w.assinatura ? PLANOS[w.assinatura.plano as PlanoId]?.nome ?? w.assinatura.plano : "—"}</td>
                  <td>
                    {w.assinatura ? (
                      <span className={`pill${w.assinatura.status === "ativa" ? " on" : ""}`}>{NOME_STATUS[w.assinatura.status]}</span>
                    ) : (
                      <span className="pill">Sem assinatura</span>
                    )}
                  </td>
                  <td>{formatarData(w.criadoEm)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
