"use client";

import { Suspense, useState } from "react";
import Link from "next/link";

import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import { BarList, ChartCard, LineChart } from "@/components/charts";
import {
  calcularMotivoPrincipalPerda,
  calcularPorResponsavel,
  calcularSerieDiaria,
  calcularTaxaConversao,
  calcularTicketMedio,
  calcularValorPerdido,
  calcularValorVendido,
  formatarMoeda,
  todosOsCards,
} from "@/lib/metrics";

const METRICAS_EVOLUCAO = [
  { chave: "vendas", label: "Vendas", cor: "#0f9d63" },
  { chave: "receita", label: "Receita", cor: "#2e6bff" },
  { chave: "conversao", label: "Conversão", cor: "#8a3ffc" },
] as const;
type MetricaEvolucao = (typeof METRICAS_EVOLUCAO)[number]["chave"];

/**
 * Performance mostra só desempenho e conversão — motivos de perda tem
 * página própria (/motivos-perda), com link daqui pro resumo completo.
 * Tudo calculado sobre NegocioCard real (ver src/lib/metrics.ts) — sem
 * indicador nenhum começa com dado fictício; workspace sem negócio fechado
 * ainda mostra zero/vazio de verdade.
 */
export default function PerformanceVendasPage() {
  return (
    <Suspense fallback={null}>
      <PerformanceVendasPageInner />
    </Suspense>
  );
}

function PerformanceVendasPageInner() {
  const { funis } = useFunis();
  const { membros: equipe } = useEquipe();
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [funilFiltro, setFuncilFiltro] = useState("Todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");
  const [metricaEvolucao, setMetricaEvolucao] = useState<MetricaEvolucao>("vendas");
  const [pessoaAberta, setPessoaAberta] = useState<string | null>(null);

  const funisFiltrados = funilFiltro === "Todos" ? funis : funis.filter((f) => f.nome === funilFiltro);
  const cardsTodos = todosOsCards(funisFiltrados);
  const cardsFiltrados =
    responsavelFiltro === "Todos" ? cardsTodos : cardsTodos.filter((c) => c.responsavel === responsavelFiltro);

  const taxaConversao = calcularTaxaConversao(cardsFiltrados);
  const valorVendido = calcularValorVendido(cardsFiltrados);
  const ticketMedio = calcularTicketMedio(cardsFiltrados);
  const totalOportunidades = cardsFiltrados.filter((c) => c.statusFechamento).length;
  const valorPerdido = calcularValorPerdido(cardsFiltrados);
  const motivoPrincipal = calcularMotivoPrincipalPerda(cardsFiltrados);
  const porResponsavel = calcularPorResponsavel(cardsTodos);
  const serieDiaria = calcularSerieDiaria(cardsFiltrados);

  const meta = 45000;
  const percentualMeta = Math.min(999, Math.round((valorVendido.valor / meta) * 100));

  const pessoaDetalhe = pessoaAberta ? porResponsavel.find((r) => r.nome === pessoaAberta) : null;

  const seriePonto = (dia: (typeof serieDiaria)[number]) => {
    if (metricaEvolucao === "vendas") return dia.vendas;
    if (metricaEvolucao === "receita") return dia.valorVendas;
    return dia.criadas > 0 ? Math.round((dia.vendas / dia.criadas) * 100) : 0;
  };

  const filtros: FiltroDef[] = [
    {
      chave: "responsavel",
      label: "Responsável",
      valor: responsavelFiltro,
      opcoes: [{ valor: "Todos", label: "Todos" }, ...equipe.map((m) => ({ valor: m.nome, label: m.nome }))],
    },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Performance</h2>
          </div>
          <p className="sub">Desempenho e conversão da equipe no período</p>
        </div>
      </div>

      <div className="content">
        <FilterBar
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          principalLabel="Funil"
          principalValor={funilFiltro}
          principalOpcoes={["Todos", ...funis.map((f) => f.nome)]}
          onPrincipalChange={setFuncilFiltro}
          filtros={filtros}
          onFiltroChange={(chave, valor) => {
            if (chave === "responsavel") setResponsavelFiltro(valor);
          }}
          onLimpar={() => {
            setPeriodo(PERIODO_PADRAO);
            setFuncilFiltro("Todos");
            setResponsavelFiltro("Todos");
          }}
          onExportar={() => window.print()}
          viewKey="performance"
        />

        {totalOportunidades === 0 ? (
          <div className="card mb14">
            <div className="dados-nao-conectados" style={{ padding: 17 }}>
              Você ainda não possui dados suficientes para gerar este indicador — marque negócios
              como ganhos/perdidos no Funil pra ver a performance aqui.
            </div>
          </div>
        ) : null}

        <div className="grid kpi4">
          <KpiCard label="Total de negociações encerradas" value={String(totalOportunidades)} />
          <KpiCard label="Taxa de conversão" value={taxaConversao.label} formula={taxaConversao.formula} />
          <KpiCard label="Receita" value={valorVendido.label} formula={valorVendido.formula} />
          <KpiCard label="Ticket médio" value={ticketMedio.label} formula={ticketMedio.formula} />
          <KpiCard
            label="Meta do período"
            value={`${percentualMeta}%`}
            sub={`${valorVendido.label} de ${formatarMoeda(meta)}`}
          />
          <KpiCard
            label="Valor perdido"
            value={valorPerdido.label}
            sub={`Principal motivo: ${motivoPrincipal.motivo}`}
            href="/motivos-perda"
          />
        </div>

        <div className="card mb14">
          <div className="panel-h">
            <h4>Desempenho por responsável</h4>
          </div>
          <div style={{ padding: 17 }}>
            {porResponsavel.length === 0 ? (
              <p className="hint">Nenhum negócio com responsável e desfecho registrado ainda.</p>
            ) : (
              <BarList
                items={porResponsavel.map((r) => {
                  const total = r.vendidas + r.perdidas;
                  const taxa = total > 0 ? Math.round((r.vendidas / total) * 100) : 0;
                  return {
                    chave: r.nome,
                    label: r.nome,
                    meta: `${r.vendidas} vendas · ${r.perdidas} perda${r.perdidas === 1 ? "" : "s"} · ${taxa}% de conversão · ${formatarMoeda(r.receita)}`,
                    percentual: taxa,
                    onClick: () => setPessoaAberta((atual) => (atual === r.nome ? null : r.nome)),
                  };
                })}
              />
            )}
          </div>
        </div>

        {pessoaDetalhe ? (
          <div className="card mb14">
            <div className="panel-h">
              <h4>{pessoaAberta}</h4>
              <button type="button" className="link" onClick={() => setPessoaAberta(null)}>
                Fechar ✕
              </button>
            </div>
            <div style={{ padding: 17 }}>
              <div className="stat-row">
                <span className="sl">Vendas</span>
                <span className="sv">{pessoaDetalhe.vendidas}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Perdas</span>
                <span className="sv">{pessoaDetalhe.perdidas}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Receita</span>
                <span className="sv">{formatarMoeda(pessoaDetalhe.receita)}</span>
              </div>
              <Link href={`/jornada-cliente`} className="link" style={{ display: "inline-block", marginTop: 8 }}>
                Ver atividades desta pessoa →
              </Link>
            </div>
          </div>
        ) : null}

        <ChartCard
          title="Evolução no período"
          action={
            <div className="filters-row" style={{ margin: 0 }}>
              {METRICAS_EVOLUCAO.map((m) => (
                <button
                  type="button"
                  key={m.chave}
                  className={`fchip${metricaEvolucao === m.chave ? " active" : ""}`}
                  onClick={() => setMetricaEvolucao(m.chave)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          }
        >
          {serieDiaria.length === 0 ? (
            <p className="hint" style={{ padding: 17 }}>
              Ainda sem movimento suficiente pra traçar uma evolução — o gráfico aparece assim que
              houver negócios criados/fechados em mais de um dia.
            </p>
          ) : (
            <LineChart
              series={[
                {
                  chave: metricaEvolucao,
                  cor: METRICAS_EVOLUCAO.find((m) => m.chave === metricaEvolucao)?.cor ?? "#2e6bff",
                  label: METRICAS_EVOLUCAO.find((m) => m.chave === metricaEvolucao)?.label ?? "",
                  pontos: serieDiaria.map((p) => ({ x: p.dia, y: seriePonto(p) })),
                },
              ]}
            />
          )}
        </ChartCard>

        <div className="card">
          <div className="panel-h">
            <h4>Motivos de perda</h4>
            <Link href="/motivos-perda" className="link">
              Ver análise completa de perdas →
            </Link>
          </div>
          <div style={{ padding: 17 }}>
            {valorPerdido.registros.length === 0 ? (
              <p className="hint">Nenhum negócio perdido registrado ainda.</p>
            ) : (
              <p className="hint">
                {valorPerdido.label} perdidos no período · principal motivo: {motivoPrincipal.motivo} (
                {motivoPrincipal.valor.toFixed(0)}%)
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
