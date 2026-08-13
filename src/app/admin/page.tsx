"use client";

import { useEffect, useState } from "react";

import { Topbar, KpiCard } from "@/components/ui";
import { PLANOS, type PlanoId } from "@/lib/assinatura/planos";

type Overview = {
  totalWorkspaces: number;
  totalMembros: number;
  membrosAtivos: number;
  totalAssinaturas: number;
  mrr: number;
  porStatus: Record<string, number>;
  porPlano: Record<string, number>;
  crescimento: { mes: string; total: number }[];
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const NOME_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Cores categóricas validadas (dataviz skill — CVD ΔE ≥ 15 no par mais próximo, sem cor quente,
 * seguindo a regra de marca). Ordem fixa por plano, nunca ciclada. */
const COR_PLANO: Record<PlanoId, string> = {
  essencial: "#2e6bff",
  completo: "#0f9d63",
  escala: "#6d28d9",
};

function GraficoPlanos({ porPlano }: { porPlano: Record<string, number> }) {
  const linhas = (Object.keys(PLANOS) as PlanoId[]).map((id) => ({
    id,
    nome: PLANOS[id].nome,
    total: porPlano[id] ?? 0,
  }));
  const max = Math.max(1, ...linhas.map((l) => l.total));

  return (
    <div className="card" style={{ padding: 17 }}>
      <p className="panel-h" style={{ padding: 0, marginBottom: 14 }}>
        <h4>Workspaces por plano</h4>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {linhas.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 72, fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{l.nome}</span>
            <div style={{ flex: 1, background: "var(--gray-100)", borderRadius: 4, height: 16, position: "relative" }}>
              <div
                style={{
                  width: `${(l.total / max) * 100}%`,
                  minWidth: l.total > 0 ? 6 : 0,
                  height: "100%",
                  borderRadius: 4,
                  background: COR_PLANO[l.id],
                  transition: "width 0.2s ease",
                }}
              />
            </div>
            <span style={{ width: 24, textAlign: "right", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{l.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GraficoCrescimento({ crescimento }: { crescimento: Overview["crescimento"] }) {
  const max = Math.max(1, ...crescimento.map((c) => c.total));

  return (
    <div className="card" style={{ padding: 17 }}>
      <p className="panel-h" style={{ padding: 0, marginBottom: 14 }}>
        <h4>Novos workspaces (6 meses)</h4>
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
        {crescimento.map((c) => {
          const [ano, mes] = c.mes.split("-");
          const altura = (c.total / max) * 100;
          return (
            <div key={c.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{c.total}</span>
              <div
                style={{
                  width: "100%",
                  maxWidth: 32,
                  height: `${Math.max(altura, c.total > 0 ? 4 : 0)}%`,
                  background: "var(--blue)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
              <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                {NOME_MES[Number(mes) - 1]}/{ano.slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dashboard do super-admin — visão geral da plataforma inteira: quantos workspaces/usuários
 * existem, MRR real (soma das assinaturas ativas), distribuição por plano e crescimento recente. */
export default function AdminDashboardPage() {
  const [dados, setDados] = useState<Overview | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then(setDados)
      .catch(() => setErro("Falha ao carregar os dados."));
  }, []);

  return (
    <div className="view">
      <Topbar title="Painel de admin" sub="Visão geral de todos os workspaces da plataforma." />

      {erro ? <p style={{ color: "var(--danger)", padding: "0 17px" }}>{erro}</p> : null}

      {dados ? (
        <>
          <div className="grid kpi4">
            <KpiCard label="Workspaces" value={String(dados.totalWorkspaces)} />
            <KpiCard label="Usuários" value={String(dados.totalMembros)} sub={`${dados.membrosAtivos} ativos`} />
            <KpiCard label="MRR" value={formatarMoeda(dados.mrr)} sub={`${dados.porStatus.ativa ?? 0} assinaturas ativas`} />
            <KpiCard
              label="Pagamento atrasado"
              value={String(dados.porStatus.atrasada ?? 0)}
              sub={`${dados.porStatus.cancelada ?? 0} canceladas`}
            />
          </div>

          <div className="config-grid-2" style={{ padding: "0 0 16px", gap: 16 }}>
            <GraficoPlanos porPlano={dados.porPlano} />
            <GraficoCrescimento crescimento={dados.crescimento} />
          </div>
        </>
      ) : !erro ? (
        <p style={{ padding: "0 17px", color: "var(--text-muted)" }}>Carregando…</p>
      ) : null}
    </div>
  );
}
