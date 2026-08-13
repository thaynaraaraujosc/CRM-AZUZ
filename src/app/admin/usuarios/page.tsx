"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";

type MembroLinha = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  papelTipo: string;
  ativo: boolean;
  convitePendente: boolean;
  criadoEm: string;
  workspace: { id: string; nome: string };
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Todos os usuários de todos os workspaces, num lugar só — busca por nome/e-mail/empresa e ativa/
 * bloqueia o acesso direto daqui, sem precisar entrar no workspace pra achar a pessoa. */
export default function AdminUsuariosPage() {
  const [membros, setMembros] = useState<MembroLinha[] | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetch("/api/admin/membros")
      .then((r) => r.json())
      .then(setMembros);
  }, []);

  async function alternarAtivo(id: string, ativo: boolean) {
    setMembros((atual) => atual?.map((m) => (m.id === id ? { ...m, ativo } : m)) ?? null);
    await fetch(`/api/admin/membros/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ativo }),
    });
  }

  const filtrados = membros?.filter((m) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return m.nome.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.workspace.nome.toLowerCase().includes(q);
  });

  return (
    <div className="view">
      <Topbar title="Usuários" sub={membros ? `${membros.length} contas em todos os workspaces` : undefined} />

      <div className="field" style={{ padding: "0 17px 14px" }}>
        <input
          className="input"
          style={{ width: "100%" }}
          placeholder="Buscar por nome, e-mail ou empresa…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="config-tabela-scroll" style={{ margin: "0 17px 17px" }}>
        <table className="config-tabela-notif">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Empresa</th>
              <th>Papel</th>
              <th>Desde</th>
              <th>Acesso</th>
            </tr>
          </thead>
          <tbody>
            {!filtrados ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-muted)" }}>Carregando…</td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-muted)" }}>Nenhum usuário encontrado.</td>
              </tr>
            ) : (
              filtrados.map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td>
                  <td>{m.email}</td>
                  <td>
                    <Link href={`/admin/workspaces/${m.workspace.id}`}>{m.workspace.nome}</Link>
                  </td>
                  <td>{m.papel}</td>
                  <td>{formatarData(m.criadoEm)}</td>
                  <td>
                    <button type="button" className={`btn ghost${m.ativo ? "" : " danger"}`} onClick={() => alternarAtivo(m.id, !m.ativo)}>
                      {m.ativo ? "Ativo" : "Bloqueado"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
