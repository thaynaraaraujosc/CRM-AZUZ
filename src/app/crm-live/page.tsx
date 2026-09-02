"use client";

import { useEffect, useState } from "react";

import type { ColunaTarefas, Funil, Membro, NegocioCard } from "@/lib/data";
import { IconTrofeu } from "@/components/icons";
import {
  calcularDistribuicaoMotivosPerda,
  calcularPorResponsavel,
  calcularTaxaConversao,
  calcularValorVendido,
  formatarMoeda,
  todosOsCards,
} from "@/lib/metrics";

const CORES_DONUT = ["#2e6bff", "#8a3ffc", "#0f9d63", "#c9660a"];

function parseValor(raw: string): number {
  const n = Number(raw.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Telão pra projetar no escritório (aberto numa aba separada, sem sidebar) — busca os dados
 * direto das rotas reais (`/api/funis`, `/api/tarefas`, `/api/equipe`) porque essa página fica
 * fora do grupo `(app)` e não tem os providers de contexto. Atualiza sozinha a cada 30s, sem
 * botão de "simular venda": tudo aqui é o estado real do workspace no momento.
 */
export default function CrmLivePage() {
  const [tela, setTela] = useState<"finalizadas" | "andamento">("finalizadas");
  const [funis, setFunis] = useState<Funil[] | null>(null);
  const [tarefas, setTarefas] = useState<ColunaTarefas[] | null>(null);
  const [equipe, setEquipe] = useState<Membro[] | null>(null);

  useEffect(() => {
    function carregar() {
      fetch("/api/funis").then((r) => r.json()).then(setFunis).catch(() => {});
      fetch("/api/tarefas").then((r) => r.json()).then(setTarefas).catch(() => {});
      fetch("/api/equipe").then((r) => r.json()).then(setEquipe).catch(() => {});
    }
    carregar();
    const atualiza = setInterval(carregar, 30000);
    return () => clearInterval(atualiza);
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setTela((atual) => (atual === "finalizadas" ? "andamento" : "finalizadas"));
    }, 9000);
    return () => clearInterval(intervalo);
  }, []);

  const carregando = !funis || !tarefas || !equipe;
  const cards: NegocioCard[] = funis ? todosOsCards(funis) : [];
  const ganhas = cards.filter((c) => c.statusFechamento === "ganho");
  const perdidas = cards.filter((c) => c.statusFechamento === "perdido");
  const abertas = cards.filter((c) => !c.statusFechamento);

  const receita = calcularValorVendido(cards);
  const conversao = calcularTaxaConversao(cards);
  const distribuicaoMotivos = calcularDistribuicaoMotivosPerda(cards);
  const top3Motivos = distribuicaoMotivos.slice(0, 3);

  const porResponsavel = calcularPorResponsavel(cards);
  const contagemOportunidades = new Map<string, number>();
  for (const c of cards) {
    if (!c.responsavel) continue;
    contagemOportunidades.set(c.responsavel, (contagemOportunidades.get(c.responsavel) ?? 0) + 1);
  }
  const maisOportunidades = [...contagemOportunidades.entries()].sort((a, b) => b[1] - a[1])[0];
  const maisVendasUnidade = [...porResponsavel].sort((a, b) => b.vendidas - a.vendidas)[0];
  const maisVendasValor = [...porResponsavel].sort((a, b) => b.receita - a.receita)[0];

  const funilPrincipal = funis?.[0];
  const etapasAndamento = (funilPrincipal?.colunas ?? []).map((coluna) => ({
    nome: coluna.titulo,
    quantidade: coluna.cards.length,
    valor: formatarMoeda(coluna.cards.reduce((s, c) => s + parseValor(c.valor), 0)),
  }));
  const valoresEmAndamento = abertas.reduce((s, c) => s + parseValor(c.valor), 0);

  const feedTarefas = (tarefas ?? [])
    .flatMap((c) => c.cards)
    .filter((t) => !t.concluida)
    .slice(0, 5);

  const limites = top3Motivos.reduce<number[]>((acc, m) => {
    const anterior = acc.length > 0 ? acc[acc.length - 1] : 0;
    return [...acc, anterior + m.percentual];
  }, []);
  const fatias = top3Motivos.map((m, i) => {
    const inicio = i > 0 ? limites[i - 1] : 0;
    return `${CORES_DONUT[i]} ${inicio}% ${limites[i]}%`;
  });

  if (carregando) {
    return (
      <div className="crm-live">
        <p style={{ padding: 40, color: "#fff" }}>Carregando dados do workspace…</p>
      </div>
    );
  }

  return (
    <div className="crm-live">
      <header className="crm-live-header">
        <div className="crm-live-tabs">
          <button
            type="button"
            className={`crm-live-tab${tela === "finalizadas" ? " active" : ""}`}
            onClick={() => setTela("finalizadas")}
          >
            Finalizadas
          </button>
          <button
            type="button"
            className={`crm-live-tab${tela === "andamento" ? " active" : ""}`}
            onClick={() => setTela("andamento")}
          >
            Em andamento
          </button>
        </div>
        <div className="crm-live-filtros">
          <span>Funil de vendas: {funilPrincipal?.nome ?? "—"}</span>
          <span>Dados em tempo real</span>
        </div>
      </header>

      {tela === "finalizadas" ? (
        <div className="crm-live-body">
          <div className="crm-live-vencedores">
            <div className="crm-live-vencedor-card">
              <span className="crm-live-trofeu"><IconTrofeu width={16} height={16} aria-hidden="true" /></span>
              <p className="crm-live-vencedor-titulo">Quem mais criou oportunidades</p>
              <p className="crm-live-vencedor-nome">{maisOportunidades?.[0] ?? "—"}</p>
              <p className="crm-live-vencedor-valor">{maisOportunidades ? String(maisOportunidades[1]) : "—"}</p>
            </div>
            <div className="crm-live-vencedor-card">
              <span className="crm-live-trofeu"><IconTrofeu width={16} height={16} aria-hidden="true" /></span>
              <p className="crm-live-vencedor-titulo">Quem mais vendeu (un)</p>
              <p className="crm-live-vencedor-nome">{maisVendasUnidade && maisVendasUnidade.vendidas > 0 ? maisVendasUnidade.nome : "—"}</p>
              <p className="crm-live-vencedor-valor">{maisVendasUnidade && maisVendasUnidade.vendidas > 0 ? String(maisVendasUnidade.vendidas) : "—"}</p>
            </div>
            <div className="crm-live-vencedor-card">
              <span className="crm-live-trofeu"><IconTrofeu width={16} height={16} aria-hidden="true" /></span>
              <p className="crm-live-vencedor-titulo">Quem mais vendeu (R$)</p>
              <p className="crm-live-vencedor-nome">{maisVendasValor && maisVendasValor.receita > 0 ? maisVendasValor.nome : "—"}</p>
              <p className="crm-live-vencedor-valor">{maisVendasValor && maisVendasValor.receita > 0 ? formatarMoeda(maisVendasValor.receita) : "—"}</p>
            </div>
          </div>

          <div className="crm-live-kpis">
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Oportunidades abertas</p>
              <p className="crm-live-kpi-n">{abertas.length}</p>
            </div>
            <div className="crm-live-kpi crm-live-kpi-destaque">
              <p className="crm-live-kpi-l">Vendas (un)</p>
              <p className="crm-live-kpi-n">{ganhas.length}</p>
            </div>
            <div className="crm-live-kpi crm-live-kpi-destaque">
              <p className="crm-live-kpi-l">Vendas (R$)</p>
              <p className="crm-live-kpi-n">{receita.label}</p>
            </div>
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Conversão</p>
              <p className="crm-live-kpi-n">{conversao.label}</p>
              <p className="crm-live-kpi-sub">Ganhas / (ganhas + perdidas)</p>
            </div>
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Oportunidades perdidas</p>
              <p className="crm-live-kpi-n">{perdidas.length}</p>
            </div>
          </div>

          <div className="crm-live-motivos">
            <p className="crm-live-motivos-titulo">Top 3 motivos de perda</p>
            {top3Motivos.length === 0 ? (
              <p style={{ color: "#9aa4c2", padding: "8px 0" }}>Nenhum motivo de perda registrado ainda.</p>
            ) : (
              <div className="crm-live-motivos-body">
                <div
                  className="crm-live-donut"
                  style={{ background: `conic-gradient(${fatias.join(", ")})` }}
                />
                <div className="crm-live-motivos-legenda">
                  {top3Motivos.map((m, i) => (
                    <div className="crm-live-motivo-item" key={m.motivo}>
                      <span className="crm-live-motivo-dot" style={{ background: CORES_DONUT[i] }} />
                      <span>
                        {m.motivo} · {Math.round(m.percentual)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="crm-live-body">
          <div className="crm-live-andamento-topo">
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Oportunidades em andamento</p>
              <p className="crm-live-kpi-n crm-live-kpi-gigante">{abertas.length}</p>
            </div>
            <div className="crm-live-kpi">
              <p className="crm-live-kpi-l">Valores em andamento</p>
              <p className="crm-live-kpi-n">{formatarMoeda(valoresEmAndamento)}</p>
              <p className="crm-live-kpi-sub">Faturamento potencial da operação</p>
            </div>
            <div className="crm-live-feed">
              <p className="crm-live-feed-titulo">Feed de tarefas</p>
              {feedTarefas.length === 0 ? (
                <p style={{ color: "#9aa4c2", padding: "8px 0" }}>Nenhuma tarefa pendente no momento.</p>
              ) : (
                feedTarefas.map((t) => (
                  <div className="crm-live-feed-item" key={t.id}>
                    <span className="crm-live-feed-texto">
                      <b>{t.titulo}</b> · {t.responsavel.nome}
                    </span>
                    <span className="crm-live-feed-quando">{t.data}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="crm-live-etapas">
            {etapasAndamento.length === 0 ? (
              <p style={{ color: "#9aa4c2", padding: "8px 0" }}>Nenhuma etapa cadastrada no funil ainda.</p>
            ) : (
              etapasAndamento.map((e) => (
                <div className="crm-live-etapa" key={e.nome}>
                  <p className="crm-live-etapa-n">{e.quantidade}</p>
                  <p className="crm-live-etapa-nome">{e.nome}</p>
                  <p className="crm-live-etapa-valor">{e.valor}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="crm-live-dots">
        <span className={tela === "finalizadas" ? "active" : ""} />
        <span className={tela === "andamento" ? "active" : ""} />
      </div>
    </div>
  );
}
