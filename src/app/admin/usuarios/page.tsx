"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Ajuda, Topbar } from "@/components/ui";
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
  ultimoAcesso: string | null;
  workspace: { id: string; nome: string; pagamento: string; cortesiaAte: string | null };
};

type Grupo = {
  workspaceId: string;
  workspaceNome: string;
  pagamento: string;
  cortesiaAte: string | null;
  membros: MembroLinha[];
};

/**
 * Como cada empresa aparece na coluna de pagamento.
 *
 * Três situações que não podem ser a mesma cor: quem paga, quem usa de graça de propósito
 * (cortesia) e quem não paga e não deveria estar usando. A segunda é a que faltava — sem ela,
 * toda conta liberada parecia cliente, e era por isso que o painel dizia que havia receita.
 */
const PAGAMENTO: Record<string, { label: string; classe: string }> = {
  pagando: { label: "Pagando", classe: "pag-pagando" },
  cortesia: { label: "Cortesia", classe: "pag-cortesia" },
  pendente: { label: "Não pagou", classe: "pag-devendo" },
  atrasada: { label: "Atrasado", classe: "pag-devendo" },
  cancelada: { label: "Cancelado", classe: "pag-devendo" },
  "sem-assinatura": { label: "Sem assinatura", classe: "pag-devendo" },
};

function formatarData(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

/**
 * Todo mundo que tem login no CRM, agrupado por empresa.
 *
 * O que mudou: a empresa agora diz se PAGA, e cada pessoa pode ser apagada. As duas coisas servem
 * à mesma pergunta — "esta conta é cliente ou é sobra de teste?" —, que antes só se respondia
 * abrindo empresa por empresa.
 */
export default function AdminUsuariosPage() {
  const [membros, setMembros] = useState<MembroLinha[] | null>(null);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [apagando, setApagando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { senhaGerada, setSenhaGerada, carregandoId, resetarSenha, entrarComo } = useAcoesMembro();

  function carregar() {
    fetch("/api/admin/membros")
      .then((r) => r.json())
      .then(setMembros);
  }

  useEffect(carregar, []);

  async function alterarMembro(id: string, dados: Partial<Pick<MembroLinha, "ativo" | "papelTipo">>) {
    setMembros((atual) => atual?.map((m) => (m.id === id ? { ...m, ...dados } : m)) ?? null);
    await fetch(`/api/admin/membros/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dados),
    });
  }

  /**
   * Apagar é diferente de bloquear, e a confirmação diz isso.
   *
   * Bloquear mantém a pessoa na base e tira o acesso — serve pra quem pode voltar. Apagar tira a
   * pessoa, e é o que limpa as contas de teste que fazem o painel contar usuário que não existe.
   */
  async function apagarMembro(m: MembroLinha) {
    if (!window.confirm(`Apagar a conta de ${m.nome} (${m.email})? Isso não tem volta.`)) return;
    setApagando(m.id);
    setErro(null);
    try {
      const resposta = await fetch(`/api/admin/membros/${m.id}`, { method: "DELETE" });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
        setErro(corpo.erro ?? "Não foi possível apagar.");
        return;
      }
      setMembros((atual) => atual?.filter((x) => x.id !== m.id) ?? null);
    } finally {
      setApagando(null);
    }
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
      else
        mapa.set(m.workspace.id, {
          workspaceId: m.workspace.id,
          workspaceNome: m.workspace.nome,
          pagamento: m.workspace.pagamento,
          cortesiaAte: m.workspace.cortesiaAte,
          membros: [m],
        });
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

  const pagantes = grupos.filter((g) => g.pagamento === "pagando").length;

  return (
    <div className="view">
      <Topbar
        title="Usuários"
        sub={membros ? `${membros.length} contas em ${grupos.length} empresas · ${pagantes} pagando` : undefined}
      />

      <div className="admin-secao">
        <input
          className="input"
          style={{ width: "100%" }}
          placeholder="Buscar por empresa, nome ou e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro ? <p className="admin-secao auth-erro">{erro}</p> : null}

      {senhaGerada ? (
        <div className="admin-secao">
          <label>
            Senha nova
            <Ajuda texto="Copie agora: por segurança ela é guardada embaralhada e não aparece de novo." />
          </label>
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

      <div className="admin-lista">
        {!membros ? (
          <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
        ) : gruposFiltrados.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Nenhum resultado.</p>
        ) : (
          gruposFiltrados.map((g) => {
            const admin = g.membros.find((m) => m.papelTipo === "admin") ?? g.membros[0];
            const aberto = expandidos.has(g.workspaceId) || busca.trim().length > 0;
            const pag = PAGAMENTO[g.pagamento] ?? PAGAMENTO["sem-assinatura"];

            return (
              <div key={g.workspaceId} className="card admin-grupo">
                <button type="button" className="admin-grupo-cab" onClick={() => alternarExpandido(g.workspaceId)}>
                  <span className="admin-titulo-linha">
                    <Link href={`/admin/workspaces/${g.workspaceId}`} onClick={(e) => e.stopPropagation()}>
                      {g.workspaceNome}
                    </Link>
                    <span className="hint">
                      {admin.nome} · {g.membros.length} {g.membros.length === 1 ? "pessoa" : "pessoas"}
                      {g.cortesiaAte ? ` · cortesia até ${formatarData(g.cortesiaAte)}` : ""}
                    </span>
                  </span>
                  <span className={`pag-selo ${pag.classe}`}>{pag.label}</span>
                  <span className={`admin-seta${aberto ? " aberta" : ""}`} aria-hidden="true">
                    ▾
                  </span>
                </button>

                {aberto ? (
                  <div className="config-tabela-scroll admin-grupo-corpo">
                    <table className="config-tabela-notif admin-tabela">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>E-mail</th>
                          <th>
                            Tipo
                            <Ajuda texto="Admin administra a empresa inteira e é quem consegue pagar. Padrão usa o CRM. Custom tem permissões escolhidas uma a uma." />
                          </th>
                          <th>Último acesso</th>
                          <th>Acesso</th>
                          <th aria-label="Ações" />
                        </tr>
                      </thead>
                      <tbody>
                        {g.membros.map((m) => (
                          <tr key={m.id}>
                            <td>
                              {m.nome}
                              {m.convitePendente ? <em className="admin-nota"> convite pendente</em> : null}
                            </td>
                            <td>{m.email}</td>
                            <td>
                              <select
                                className="input admin-select"
                                value={m.papelTipo}
                                onChange={(e) => alterarMembro(m.id, { papelTipo: e.target.value })}
                              >
                                <option value="admin">Admin</option>
                                <option value="padrao">Padrão</option>
                                <option value="custom">Custom</option>
                              </select>
                            </td>
                            <td>{formatarData(m.ultimoAcesso)}</td>
                            <td>
                              <button
                                type="button"
                                className={`pag-selo ${m.ativo ? "pag-pagando" : "pag-devendo"} admin-toggle`}
                                onClick={() => alterarMembro(m.id, { ativo: !m.ativo })}
                              >
                                {m.ativo ? "Ativo" : "Bloqueado"}
                              </button>
                            </td>
                            <td>
                              <div className="admin-acoes-linha">
                                <button
                                  type="button"
                                  className="btn ghost"
                                  disabled={carregandoId === m.id}
                                  onClick={() => resetarSenha(m.id)}
                                >
                                  Nova senha
                                </button>
                                <button
                                  type="button"
                                  className="btn ghost"
                                  disabled={carregandoId === m.id}
                                  onClick={() => entrarComo(m.id)}
                                >
                                  Entrar como
                                </button>
                                <button
                                  type="button"
                                  className="btn ghost danger"
                                  disabled={apagando === m.id}
                                  onClick={() => void apagarMembro(m)}
                                >
                                  {apagando === m.id ? "Apagando…" : "Apagar"}
                                </button>
                              </div>
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
