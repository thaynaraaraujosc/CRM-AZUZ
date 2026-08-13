"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { useAcoesMembro } from "@/lib/admin/use-acoes-membro";

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

type Grupo = {
  workspaceId: string;
  workspaceNome: string;
  membros: MembroLinha[];
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Todos os usuários agrupados por empresa (workspace) — uma linha por empresa, com quem é o
 * admin dela em destaque e o total de membros; clicar na setinha expande e mostra todo mundo
 * daquela conta, com edição de papel/acesso ali mesmo. */
export default function AdminUsuariosPage() {
  const [membros, setMembros] = useState<MembroLinha[] | null>(null);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const { senhaGerada, setSenhaGerada, carregandoId, resetarSenha, entrarComo } = useAcoesMembro();

  useEffect(() => {
    fetch("/api/admin/membros")
      .then((r) => r.json())
      .then(setMembros);
  }, []);

  async function alterarMembro(id: string, dados: Partial<Pick<MembroLinha, "ativo" | "papelTipo">>) {
    setMembros((atual) => atual?.map((m) => (m.id === id ? { ...m, ...dados } : m)) ?? null);
    await fetch(`/api/admin/membros/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dados),
    });
  }

  function alternarExpandido(workspaceId: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(workspaceId)) novo.delete(workspaceId);
      else novo.add(workspaceId);
      return novo;
    });
  }

  const grupos = useMemo<Grupo[]>(() => {
    if (!membros) return [];
    const mapa = new Map<string, Grupo>();
    for (const m of membros) {
      const existente = mapa.get(m.workspace.id);
      if (existente) existente.membros.push(m);
      else mapa.set(m.workspace.id, { workspaceId: m.workspace.id, workspaceNome: m.workspace.nome, membros: [m] });
    }
    return [...mapa.values()].sort((a, b) => a.workspaceNome.localeCompare(b.workspaceNome));
  }, [membros]);

  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return grupos;
    return grupos
      .map((g) => ({
        ...g,
        membros: g.workspaceNome.toLowerCase().includes(q)
          ? g.membros
          : g.membros.filter((m) => m.nome.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
      }))
      .filter((g) => g.membros.length > 0);
  }, [grupos, busca]);

  return (
    <div className="view">
      <Topbar
        title="Usuários"
        sub={membros ? `${membros.length} contas em ${grupos.length} empresas` : undefined}
      />

      <div className="field" style={{ padding: "0 17px 14px" }}>
        <input
          className="input"
          style={{ width: "100%" }}
          placeholder="Buscar por empresa, nome ou e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {senhaGerada ? (
        <div className="field" style={{ padding: "0 17px 14px" }}>
          <label>Senha nova gerada — copie agora, ela não aparece de novo</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" style={{ width: "100%", fontFamily: "monospace" }} readOnly value={senhaGerada.senha} />
            <button type="button" className="btn ghost" onClick={() => navigator.clipboard.writeText(senhaGerada.senha)}>
              Copiar
            </button>
            <button type="button" className="btn ghost" onClick={() => setSenhaGerada(null)}>
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ padding: "0 17px 17px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!membros ? (
          <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
        ) : gruposFiltrados.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Nenhum resultado.</p>
        ) : (
          gruposFiltrados.map((g) => {
            const admin = g.membros.find((m) => m.papelTipo === "admin") ?? g.membros[0];
            const aberto = expandidos.has(g.workspaceId) || busca.trim().length > 0;

            return (
              <div key={g.workspaceId} className="card" style={{ overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => alternarExpandido(g.workspaceId)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "13px 17px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Link
                      href={`/admin/workspaces/${g.workspaceId}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontWeight: 700, fontSize: 13 }}
                    >
                      {g.workspaceNome}
                    </Link>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      Admin: {admin.nome} · {g.membros.length} {g.membros.length === 1 ? "membro" : "membros"}
                    </span>
                  </div>
                  <span style={{ color: "var(--text-faint)", fontSize: 12, transform: aberto ? "rotate(180deg)" : undefined, transition: "transform 0.15s ease" }}>
                    ▾
                  </span>
                </button>

                {aberto ? (
                  <div className="config-tabela-scroll" style={{ borderTop: "1px solid var(--line)" }}>
                    <table className="config-tabela-notif">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>E-mail</th>
                          <th>Papel</th>
                          <th>Tipo</th>
                          <th>Desde</th>
                          <th>Acesso</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.membros.map((m) => (
                          <tr key={m.id}>
                            <td>{m.nome}</td>
                            <td>{m.email}</td>
                            <td>{m.papel}</td>
                            <td>
                              <select className="input" value={m.papelTipo} onChange={(e) => alterarMembro(m.id, { papelTipo: e.target.value })}>
                                <option value="admin">Admin</option>
                                <option value="padrao">Padrão</option>
                                <option value="custom">Custom</option>
                              </select>
                            </td>
                            <td>{formatarData(m.criadoEm)}</td>
                            <td>
                              <button
                                type="button"
                                className={`btn ghost${m.ativo ? "" : " danger"}`}
                                onClick={() => alterarMembro(m.id, { ativo: !m.ativo })}
                              >
                                {m.ativo ? "Ativo" : "Bloqueado"}
                              </button>
                            </td>
                            <td style={{ display: "flex", gap: 6 }}>
                              <button type="button" className="btn ghost" disabled={carregandoId === m.id} onClick={() => resetarSenha(m.id)}>
                                Gerar nova senha
                              </button>
                              <button type="button" className="btn ghost" disabled={carregandoId === m.id} onClick={() => entrarComo(m.id)}>
                                Entrar como
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
