"use client";

import { use, useEffect, useState } from "react";

import { Topbar } from "@/components/ui";
import { PLANOS } from "@/lib/assinatura/planos";
import { useAcoesMembro } from "@/lib/admin/use-acoes-membro";

type Membro = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  papelTipo: string;
  ativo: boolean;
};

type Integracao = {
  id: string;
  provedor: string;
  status: string;
};

type Assinatura = {
  plano: string;
  status: string;
  valor: string;
  proximoVencimento: string | null;
} | null;

type WorkspaceDetalhe = {
  id: string;
  nome: string;
  slug: string;
  membros: Membro[];
  integracoes: Integracao[];
  assinatura: Assinatura;
};

const NOME_PROVEDOR: Record<string, string> = {
  meta_whatsapp: "WhatsApp Business (Meta)",
  whatsapp_baileys: "WhatsApp via QR Code",
  meta_instagram: "Instagram",
};

/** Detalhe de um workspace pro super-admin: todos os membros (com botão pra ativar/desativar
 * acesso e trocar papelTipo), integrações conectadas, e a assinatura — com plano/status editáveis
 * direto (sobrescrita manual, ver comentário na rota `PATCH /api/admin/workspaces/[id]`). */
export default function AdminWorkspaceDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [workspace, setWorkspace] = useState<WorkspaceDetalhe | null>(null);
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false);
  const { senhaGerada, setSenhaGerada, carregandoId, resetarSenha, entrarComo } = useAcoesMembro();

  function carregar() {
    fetch(`/api/admin/workspaces/${id}`)
      .then((r) => r.json())
      .then(setWorkspace);
  }

  useEffect(carregar, [id]);

  async function alterarStatusAssinatura(valor: string) {
    setSalvandoAssinatura(true);
    await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assinatura: { status: valor } }),
    });
    carregar();
    setSalvandoAssinatura(false);
  }

  async function alterarMembro(membroId: string, dados: Partial<Pick<Membro, "ativo" | "papelTipo">>) {
    await fetch(`/api/admin/membros/${membroId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dados),
    });
    carregar();
  }

  if (!workspace) {
    return (
      <div className="view">
        <Topbar title="Workspace" />
        <p style={{ padding: "0 17px", color: "var(--text-muted)" }}>Carregando…</p>
      </div>
    );
  }

  return (
    <div className="view">
      <Topbar title={workspace.nome} sub={`/${workspace.slug}`} />

      <div className="config-bloco">
        <p className="config-bloco-titulo">Assinatura</p>
        <div className="config-grid-2">
          <div className="field">
            <label>Plano</label>
            <p className="r">
              {PLANOS.completo.nome} — {PLANOS.completo.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
            </p>
          </div>
          <div className="field">
            <label>Status</label>
            <select
              className="input"
              style={{ width: "100%" }}
              value={workspace.assinatura?.status ?? "ativa"}
              disabled={salvandoAssinatura}
              onChange={(e) => alterarStatusAssinatura(e.target.value)}
            >
              <option value="pendente">Pendente</option>
              <option value="ativa">Ativo</option>
              <option value="atrasada">Atrasado</option>
              <option value="cancelada">Cancelado</option>
            </select>
          </div>
        </div>
        <p className="hint" style={{ padding: "0 17px 14px" }}>
          Alterar aqui muda o status direto no banco — não cria nem cancela cobrança na Asaas. Use só pra correção manual/cortesia.
        </p>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Integrações conectadas</p>
        {workspace.integracoes.length === 0 ? (
          <p className="hint" style={{ padding: "0 17px 14px" }}>Nenhuma integração conectada.</p>
        ) : (
          <div className="config-tabela-scroll">
            <table className="config-tabela-notif">
              <thead>
                <tr>
                  <th>Provedor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workspace.integracoes.map((i) => (
                  <tr key={i.id}>
                    <td>{NOME_PROVEDOR[i.provedor] ?? i.provedor}</td>
                    <td>
                      <span className={`pill${i.status === "conectado" ? " on" : ""}`}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Membros ({workspace.membros.length})</p>

        {senhaGerada ? (
          <div className="config-grid-2" style={{ padding: "0 17px 14px" }}>
            <div className="field" style={{ padding: 0, gridColumn: "1 / -1" }}>
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
          </div>
        ) : null}

        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Tipo</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {workspace.membros.map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td>
                  <td>{m.email}</td>
                  <td>{m.papel}</td>
                  <td>
                    <select
                      className="input"
                      value={m.papelTipo}
                      onChange={(e) => alterarMembro(m.id, { papelTipo: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="padrao">Padrão</option>
                      <option value="custom">Custom</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className={`btn ghost${m.ativo ? "" : " danger"}`} onClick={() => alterarMembro(m.id, { ativo: !m.ativo })}>
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
      </div>
    </div>
  );
}
