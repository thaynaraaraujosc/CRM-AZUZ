"use client";

import { use, useEffect, useState } from "react";

import { Ajuda, Topbar } from "@/components/ui";
import { PRAZOS_DE_CORTESIA } from "@/lib/assinatura/cortesia";
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
  cortesiaAte: string | null;
  asaasSubscriptionId: string | null;
  /** Contado no servidor: ler o relógio durante o render é proibido pelo compilador do React. */
  diasDeCortesia: number | null;
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
 * acesso e trocar papelTipo), integrações conectadas, e a assinatura: com plano/status editáveis
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

  /** Dar, estender ou encerrar a cortesia. 0 meses encerra e manda a conta pra tela de pagamento. */
  async function alterarCortesia(meses: number) {
    setSalvandoAssinatura(true);
    await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assinatura: { cortesiaMeses: meses } }),
    });
    carregar();
    setSalvandoAssinatura(false);
  }

  async function apagarMembro(membroId: string, nome: string) {
    if (!window.confirm(`Apagar a conta de ${nome}? Isso não tem volta.`)) return;
    const resposta = await fetch(`/api/admin/membros/${membroId}`, { method: "DELETE" });
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      window.alert(corpo.erro ?? "Não foi possível apagar.");
      return;
    }
    carregar();
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
        <p className="admin-secao" style={{ color: "var(--text-muted)" }}>Carregando…</p>
      </div>
    );
  }

  const cortesiaAte = workspace.assinatura?.cortesiaAte ? new Date(workspace.assinatura.cortesiaAte) : null;
  const diasRestantes = workspace.assinatura?.diasDeCortesia ?? null;
  const temCobranca = Boolean(workspace.assinatura?.asaasSubscriptionId?.trim());

  return (
    <div className="view">
      <Topbar title={workspace.nome} sub={`/${workspace.slug}`} />

      <div className="config-bloco">
        <p className="config-bloco-titulo">
          Assinatura
          <Ajuda texto="Mexer aqui muda o acesso direto no banco. Não cria nem cancela cobrança na Asaas: serve pra liberar, bloquear ou dar cortesia à mão." />
        </p>
        <div className="config-grid-2">
          <div className="field">
            <label>Plano</label>
            <p className="r">
              {PLANOS.completo.nome} ·{" "}
              {PLANOS.completo.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
            </p>
          </div>
          <div className="field">
            <label>
              Acesso
              <Ajuda texto="Ativo entra no CRM; pendente, atrasado e cancelado caem na tela de pagamento." />
            </label>
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

        {/*
          A CORTESIA É O CONTROLE QUE FALTAVA.
          
          Antes, liberar uma conta de graça era pôr o status em "ativa" — e ela ficava assim pra
          sempre, porque ninguém volta nesta tela pra encerrar. Com prazo, a conta vira cobrável
          sozinha no dia marcado, e é dessa data que a primeira cobrança parte.
        */}
        <div className="field admin-secao">
          <label>
            Cortesia
            <Ajuda texto="Por quanto tempo esta empresa usa o CRM de graça, a partir de hoje. Depois da data ela cai na tela de pagamento sozinha, e a cobrança começa a contar dali." />
          </label>
          <div className="seg-picker" role="group" aria-label="Tempo de cortesia">
            {PRAZOS_DE_CORTESIA.map((p) => (
              <button
                key={p.meses}
                type="button"
                className="seg-chip"
                disabled={salvandoAssinatura}
                onClick={() => alterarCortesia(p.meses)}
              >
                + {p.label}
              </button>
            ))}
            {cortesiaAte ? (
              <button
                type="button"
                className="seg-chip perigo"
                disabled={salvandoAssinatura}
                onClick={() => alterarCortesia(0)}
              >
                Encerrar agora
              </button>
            ) : null}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            {cortesiaAte
              ? `De graça até ${cortesiaAte.toLocaleDateString("pt-BR")}${
                  diasRestantes !== null && diasRestantes >= 0
                    ? ` — faltam ${diasRestantes} dias.`
                    : " — o prazo já venceu, e a conta está na tela de pagamento."
                }`
              : temCobranca
                ? "Esta conta tem cobrança de verdade na Asaas."
                : "Sem prazo de cortesia. Escolha um acima pra marcar quando a cobrança deve começar."}
          </p>
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Integrações conectadas</p>
        {workspace.integracoes.length === 0 ? (
          <p className="hint admin-secao">Nenhuma integração conectada.</p>
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
        <p className="config-bloco-titulo">Pessoas ({workspace.membros.length})</p>

        {senhaGerada ? (
          <div className="config-grid-2 admin-secao">
            <div className="field" style={{ padding: 0, gridColumn: "1 / -1" }}>
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
                  <td>
                    <div className="admin-acoes-linha">
                      <button type="button" className="btn ghost" disabled={carregandoId === m.id} onClick={() => resetarSenha(m.id)}>
                        Nova senha
                      </button>
                      <button type="button" className="btn ghost" disabled={carregandoId === m.id} onClick={() => entrarComo(m.id)}>
                        Entrar como
                      </button>
                      <button type="button" className="btn ghost danger" onClick={() => void apagarMembro(m.id, m.nome)}>
                        Apagar
                      </button>
                    </div>
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
