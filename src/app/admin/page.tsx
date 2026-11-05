"use client";

import { useEffect, useState } from "react";

import { Topbar, KpiCard } from "@/components/ui";

type Overview = {
  totalWorkspaces: number;
  totalMembros: number;
  membrosAtivos: number;
  totalAssinaturas: number;
  mrr: number;
  pagantes: number;
  emCortesia: number;
  liberadasSemCobranca: number;
  porStatus: Record<string, number>;
  crescimento: { mes: string; total: number }[];
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const NOME_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function GraficoCrescimento({ crescimento }: { crescimento: Overview["crescimento"] }) {
  const max = Math.max(1, ...crescimento.map((c) => c.total));

  return (
    <div className="card" style={{ padding: 17 }}>
      {/* `div`, não `p`: `<h4>` dentro de `<p>` é aninhamento inválido, e o navegador fecha o
          parágrafo sozinho antes do título. O HTML que o servidor manda e o que o navegador monta
          deixam de bater, o React acusa erro de hidratação e o painel quebra na abertura. */}
      <div className="panel-h" style={{ padding: 0, marginBottom: 14 }}>
        <h4>Empresas novas por mês</h4>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
        {crescimento.map((c) => {
          const [ano, mes] = c.mes.split("-");
          const altura = (c.total / max) * 100;
          return (
            <div key={c.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{c.total}</span>
              <div
                style={{
                  width: "100%",
                  maxWidth: 32,
                  height: `${Math.max(altura, c.total > 0 ? 4 : 0)}%`,
                  background: "var(--blue)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
              <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                {NOME_MES[Number(mes) - 1]}/{ano.slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dashboard do super-admin: visão geral da plataforma inteira: quantos workspaces/usuários
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
      <Topbar title="Painel" sub="Todas as empresas da plataforma." />

      {erro ? <p className="admin-secao" style={{ color: "var(--danger)" }}>{erro}</p> : null}

      {dados ? (
        <>
          <div className="grid kpi4">
            <KpiCard label="Empresas" value={String(dados.totalWorkspaces)} />
            <KpiCard label="Pessoas" value={String(dados.totalMembros)} sub={`${dados.membrosAtivos} com acesso`} />
            {/*
              O MRR CONTA SÓ QUEM PAGA DE VERDADE.
              
              Ele dizia "4 assinaturas ativas" e uma receita que nunca entrou: conta de cortesia e
              conta de teste nascem com status "ativa" de propósito, porque é isso que libera o
              produto pra elas. Agora o número é o de quem tem cobrança na Asaas, e as liberadas
              aparecem no cartão ao lado — porque "quantas contas usam de graça" também é
              informação, só não é dinheiro.
            */}
            <KpiCard
              label="Receita por mês"
              value={formatarMoeda(dados.mrr)}
              sub={`${dados.pagantes} ${dados.pagantes === 1 ? "conta pagando" : "contas pagando"}`}
            />
            <KpiCard
              label="Usando de graça"
              value={String(dados.liberadasSemCobranca)}
              sub={
                dados.emCortesia > 0
                  ? `${dados.emCortesia} com prazo de cortesia`
                  : "nenhuma com prazo marcado"
              }
            />
          </div>

          <div style={{ padding: "0 0 16px" }}>
            <GraficoCrescimento crescimento={dados.crescimento} />
          </div>
        </>
      ) : !erro ? (
        <p className="admin-secao" style={{ color: "var(--text-muted)" }}>Carregando…</p>
      ) : null}
    </div>
  );
}
