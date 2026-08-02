"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ORIGENS, campanhas, contatos, funilJulho, funis as funisPadrao, kpisTrafego, type Origem } from "@/lib/data";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import { ChartCard, FunnelSteps } from "@/components/charts";
import {
  calcularInvestimentoTrafego,
  calcularLeadsTrafego,
  calcularRoasMedio,
  calcularValorVendido,
  formatarMoeda,
  parseSubCampanha,
} from "@/lib/metrics";

type ColunaOrdenavel = "nome" | "investido" | "leads" | "cpl" | "roas";

/**
 * Visão completa da aquisição — do investimento até a receita. Campos que o
 * modelo de dados atual não liga de verdade (ex.: venda por campanha
 * específica) mostram "Dados não conectados" em vez de número inventado.
 */
export default function TrafegoPage() {
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [plataformaFiltro, setPlataformaFiltro] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<ColunaOrdenavel>("investido");
  const [ordemDesc, setOrdemDesc] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [campanhaAberta, setCampanhaAberta] = useState<string | null>(null);

  const campanhasFiltradas = useMemo(
    () =>
      campanhas.filter((c) => {
        if (plataformaFiltro !== "Todas" && c.plataforma !== plataformaFiltro) return false;
        if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
        return true;
      }),
    [plataformaFiltro, busca],
  );

  const linhasCampanha = useMemo(() => {
    const linhas = campanhasFiltradas.map((c) => {
      const { leads, investido } = parseSubCampanha(c.sub);
      const roasNum = Number(c.roas.replace(",", ".").replace("x", "")) || 0;
      const cpl = leads > 0 ? investido / leads : 0;
      return { ...c, leads, investido, cpl, roasNum };
    });
    const chave = (l: (typeof linhas)[number]) =>
      ordenarPor === "nome" ? l.nome : ordenarPor === "roas" ? l.roasNum : l[ordenarPor];
    linhas.sort((a, b) => {
      const av = chave(a);
      const bv = chave(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return ordemDesc ? -cmp : cmp;
    });
    return linhas;
  }, [campanhasFiltradas, ordenarPor, ordemDesc]);

  function alternarOrdenacao(col: ColunaOrdenavel) {
    if (ordenarPor === col) setOrdemDesc((v) => !v);
    else {
      setOrdenarPor(col);
      setOrdemDesc(true);
    }
  }

  function alternarSelecao(nome: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  const investido = calcularInvestimentoTrafego(campanhasFiltradas);
  const leads = calcularLeadsTrafego(campanhasFiltradas);
  const roas = calcularRoasMedio(campanhasFiltradas);
  const custoPorLead = leads.valor > 0 ? investido.valor / leads.valor : 0;
  const vendasKpi = kpisTrafego.find((k) => k.label === "Vendas");
  const custoVendaKpi = kpisTrafego.find((k) => k.label === "Custo / venda");
  const receita = calcularValorVendido();

  const funilSteps = [
    { chave: "gerados", label: "Leads gerados", quantidade: funilJulho[0]?.total ?? 0 },
    { chave: "qualificados", label: "Leads qualificados", quantidade: funilJulho[1]?.total ?? 0 },
    { chave: "negociacoes", label: "Negociações", quantidade: funilJulho[2]?.total ?? 0 },
    {
      chave: "vendas",
      label: "Vendas",
      quantidade: funilJulho[3]?.total ?? 0,
      valorLabel: receita.label,
    },
  ];

  const origensComDados = ORIGENS.map((origem: Origem) => {
    const leadsOrigem = contatos.filter((c) => c.origem === origem).length;
    const vendasOrigem = funisPadrao
      .flatMap((f) => f.colunas.filter((c) => c.titulo.startsWith("Fechado")).flatMap((c) => c.cards))
      .filter((card) => card.origem === origem).length;
    const investimentoOrigem =
      origem === "Meta Ads" || origem === "Google Ads"
        ? campanhas
            .filter((c) => (origem === "Meta Ads" ? c.plataforma === "M" : c.plataforma === "G"))
            .reduce((s, c) => s + parseSubCampanha(c.sub).investido, 0)
        : null;
    return { origem, leadsOrigem, vendasOrigem, investimentoOrigem };
  });

  const campanhaDetalhe = campanhaAberta ? campanhas.find((c) => c.nome === campanhaAberta) : null;

  const filtros: FiltroDef[] = [
    {
      chave: "plataforma",
      label: "Plataforma",
      valor: plataformaFiltro,
      opcoes: [
        { valor: "Todas", label: "Todas" },
        { valor: "M", label: "Meta Ads" },
        { valor: "G", label: "Google Ads" },
      ],
    },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Tráfego</h2>
          </div>
          <p className="sub">Da aquisição de leads até a receita atribuída às campanhas</p>
        </div>
        <div className="top-actions">
          <Link className="btn primary" href="/relatorios?tipo=trafego">
            Gerar relatório de tráfego
          </Link>
        </div>
      </div>

      <div className="content trafego-view">
        <FilterBar
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          principalLabel="Plataforma"
          principalValor={plataformaFiltro === "M" ? "Meta Ads" : plataformaFiltro === "G" ? "Google Ads" : "Todas"}
          principalOpcoes={["Todas", "Meta Ads", "Google Ads"]}
          onPrincipalChange={(v) => setPlataformaFiltro(v === "Meta Ads" ? "M" : v === "Google Ads" ? "G" : "Todas")}
          filtros={filtros}
          onFiltroChange={(chave, valor) => {
            if (chave === "plataforma") setPlataformaFiltro(valor);
          }}
          onLimpar={() => {
            setPeriodo(PERIODO_PADRAO);
            setPlataformaFiltro("Todas");
          }}
          onExportar={() => window.print()}
          viewKey="trafego"
        />

        <div className="grid kpi6">
          <KpiCard label="Investido" value={investido.label} formula={investido.formula} />
          <KpiCard label="Leads" value={leads.label} formula={leads.formula} href="/funil" />
          <KpiCard
            label="Custo / lead"
            value={formatarMoeda(custoPorLead)}
            formula="Investido em tráfego ÷ leads gerados, nas campanhas filtradas"
          />
          {vendasKpi ? <KpiCard label={vendasKpi.label} value={vendasKpi.value} href="/performance-vendas" /> : null}
          {custoVendaKpi ? <KpiCard label={custoVendaKpi.label} value={custoVendaKpi.value} /> : null}
          <KpiCard label="ROAS" value={roas.label} formula={roas.formula} />
        </div>

        <ChartCard title="Funil de tráfego">
          <FunnelSteps etapas={funilSteps} />
        </ChartCard>

        <div className="card mb14">
          <div className="panel-h">
            <h4>Desempenho por campanha</h4>
            <div className="filters-row" style={{ margin: 0 }}>
              <input
                className="input"
                placeholder="Pesquisar campanha…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: 180 }}
              />
              {selecionadas.size > 1 ? (
                <span className="hint">{selecionadas.size} selecionadas pra comparar</span>
              ) : null}
            </div>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Plataforma</th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("nome")}>
                    Campanha {ordenarPor === "nome" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("investido")}>
                    Investimento {ordenarPor === "investido" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("leads")}>
                    Leads {ordenarPor === "leads" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("cpl")}>
                    CPL {ordenarPor === "cpl" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("roas")}>
                    ROAS {ordenarPor === "roas" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhasCampanha.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <p className="hint" style={{ padding: 17 }}>Nenhuma campanha com esses filtros.</p>
                    </td>
                  </tr>
                ) : null}
                {linhasCampanha.map((c) => (
                  <tr key={c.nome}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionadas.has(c.nome)}
                        onChange={() => alternarSelecao(c.nome)}
                        aria-label={`Selecionar ${c.nome}`}
                      />
                    </td>
                    <td>{c.plataforma === "M" ? "Meta Ads" : "Google Ads"}</td>
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={() => setCampanhaAberta((atual) => (atual === c.nome ? null : c.nome))}
                      >
                        {c.nome}
                      </button>
                    </td>
                    <td>{formatarMoeda(c.investido)}</td>
                    <td>{c.leads}</td>
                    <td>{formatarMoeda(c.cpl)}</td>
                    <td>{c.roas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ padding: "0 17px 14px" }}>
            Leads qualificados, vendas, receita por campanha e custo por venda entram aqui quando a
            negociação puder ser ligada à campanha de origem no back-end.
          </p>
        </div>

        {campanhaDetalhe ? (
          <div className="card mb14">
            <div className="panel-h">
              <h4>{campanhaDetalhe.nome}</h4>
              <button type="button" className="link" onClick={() => setCampanhaAberta(null)}>
                Fechar ✕
              </button>
            </div>
            <div style={{ padding: 17 }}>
              <div className="stat-row">
                <span className="sl">Plataforma</span>
                <span className="sv">{campanhaDetalhe.plataforma === "M" ? "Meta Ads" : "Google Ads"}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Investimento</span>
                <span className="sv">{formatarMoeda(parseSubCampanha(campanhaDetalhe.sub).investido)}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Leads</span>
                <span className="sv">{parseSubCampanha(campanhaDetalhe.sub).leads}</span>
              </div>
              <div className="stat-row">
                <span className="sl">ROAS</span>
                <span className="sv">{campanhaDetalhe.roas}</span>
              </div>
              <Link
                href={`/contatos`}
                className="link"
                style={{ display: "inline-block", marginTop: 8 }}
              >
                Ver leads dessa plataforma →
              </Link>
              <p className="hint" style={{ marginTop: 10 }}>
                Evolução no período, anúncios individuais e motivos de perda por campanha entram aqui
                quando o back-end ligar cada negociação à campanha que a originou.
              </p>
            </div>
          </div>
        ) : null}

        <ChartCard title="Origens">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Leads</th>
                  <th>Vendas</th>
                  <th>Investimento</th>
                </tr>
              </thead>
              <tbody>
                {origensComDados.map((o) => (
                  <tr key={o.origem}>
                    <td>{o.origem}</td>
                    <td>{o.leadsOrigem}</td>
                    <td>{o.vendasOrigem}</td>
                    <td>{o.investimentoOrigem !== null ? formatarMoeda(o.investimentoOrigem) : "Dados não conectados"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </>
  );
}
