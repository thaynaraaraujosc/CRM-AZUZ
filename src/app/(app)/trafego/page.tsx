"use client";

import { useState } from "react";

import { campanhas, kpisTrafego, workspace } from "@/lib/data";
import { FloatingDropdown, KpiCard, Topbar } from "@/components/ui";
import { calcularInvestimentoTrafego, calcularLeadsTrafego, calcularRoasMedio, formatarMoeda } from "@/lib/metrics";

const PLATAFORMAS = [
  { valor: "Todas", label: "Todas" },
  { valor: "M", label: "Meta Ads" },
  { valor: "G", label: "Google Ads" },
];

const PERIODOS = ["01 jul → 30 jul", "Últimos 7 dias", "Este mês", "Mês passado"];

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-08-05" → "05 ago" */
function formatarDataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia} ${MESES_ABREV[Number(mes) - 1]}`;
}

export default function TrafegoPage() {
  const [clinicaAberta, setClinicaAberta] = useState(false);
  const [clinicaRect, setClinicaRect] = useState<DOMRect | null>(null);

  const [plataformaAberta, setPlataformaAberta] = useState(false);
  const [plataformaRect, setPlataformaRect] = useState<DOMRect | null>(null);
  const [plataformaFiltro, setPlataformaFiltro] = useState("Todas");

  const [campanhaAberta, setCampanhaAberta] = useState(false);
  const [campanhaRect, setCampanhaRect] = useState<DOMRect | null>(null);
  const [campanhaFiltro, setCampanhaFiltro] = useState("Todas");

  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [periodoRect, setPeriodoRect] = useState<DOMRect | null>(null);
  const [periodoFiltro, setPeriodoFiltro] = useState(PERIODOS[0]);
  const [periodoPersonalizadoAberto, setPeriodoPersonalizadoAberto] =
    useState(false);
  const [dataPersonalizadaDe, setDataPersonalizadaDe] = useState("");
  const [dataPersonalizadaAte, setDataPersonalizadaAte] = useState("");

  function aplicarPeriodoPersonalizado() {
    if (!dataPersonalizadaDe || !dataPersonalizadaAte) return;
    setPeriodoFiltro(
      `${formatarDataCurta(dataPersonalizadaDe)} → ${formatarDataCurta(dataPersonalizadaAte)}`,
    );
    setPeriodoPersonalizadoAberto(false);
    setPeriodoAberto(false);
  }

  const campanhasFiltradas = campanhas.filter((c) => {
    if (plataformaFiltro !== "Todas" && c.plataforma !== plataformaFiltro) {
      return false;
    }
    if (campanhaFiltro !== "Todas" && c.nome !== campanhaFiltro) return false;
    return true;
  });

  const labelPlataforma =
    PLATAFORMAS.find((p) => p.valor === plataformaFiltro)?.label ?? "Todas";

  // Investido, leads e ROAS vêm de src/lib/metrics.ts a partir das campanhas
  // já filtradas — mesma fórmula usada em Início, então nunca dessincroniza
  // do "ROAS médio" mostrado lá. "Vendas" e "Custo/venda" continuam de
  // `kpisTrafego` porque o modelo de dados atual não liga venda à campanha
  // que a originou (ver limitações no relatório final).
  const investido = calcularInvestimentoTrafego(campanhasFiltradas);
  const leads = calcularLeadsTrafego(campanhasFiltradas);
  const roas = calcularRoasMedio(campanhasFiltradas);
  const custoPorLead = leads.valor > 0 ? investido.valor / leads.valor : 0;
  const vendasKpi = kpisTrafego.find((k) => k.label === "Vendas");
  const custoVendaKpi = kpisTrafego.find((k) => k.label === "Custo / venda");

  return (
    <>
      <Topbar
        title="Tráfego"
        sub="Julho 2026 · todas as contas de anúncio"
        actions={
          <button type="button" className="btn ghost">
            Exportar
          </button>
        }
      />

      <div className="content trafego-view">
        <div className="filter-strip">
          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setClinicaRect(e.currentTarget.getBoundingClientRect());
              setClinicaAberta((v) => !v);
            }}
          >
            Clínica: {workspace.name} ▾
          </button>
          <FloatingDropdown
            anchorRect={clinicaAberta ? clinicaRect : null}
            onClose={() => setClinicaAberta(false)}
            width={220}
          >
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }}>
              <span className="n">{workspace.name}</span>
            </button>
          </FloatingDropdown>

          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setPlataformaRect(e.currentTarget.getBoundingClientRect());
              setPlataformaAberta((v) => !v);
            }}
          >
            Plataforma: {labelPlataforma} ▾
          </button>
          <FloatingDropdown
            anchorRect={plataformaAberta ? plataformaRect : null}
            onClose={() => setPlataformaAberta(false)}
            width={200}
          >
            {PLATAFORMAS.map((p) => (
              <button
                type="button"
                key={p.valor}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setPlataformaFiltro(p.valor);
                  setPlataformaAberta(false);
                }}
              >
                <span className="n">{p.label}</span>
              </button>
            ))}
          </FloatingDropdown>

          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setCampanhaRect(e.currentTarget.getBoundingClientRect());
              setCampanhaAberta((v) => !v);
            }}
          >
            Campanha: {campanhaFiltro} ▾
          </button>
          <FloatingDropdown
            anchorRect={campanhaAberta ? campanhaRect : null}
            onClose={() => setCampanhaAberta(false)}
            width={260}
          >
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => {
                setCampanhaFiltro("Todas");
                setCampanhaAberta(false);
              }}
            >
              <span className="n">Todas</span>
            </button>
            {campanhas.map((c) => (
              <button
                type="button"
                key={c.nome}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setCampanhaFiltro(c.nome);
                  setCampanhaAberta(false);
                }}
              >
                <span className="n">{c.nome}</span>
              </button>
            ))}
          </FloatingDropdown>

          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setPeriodoRect(e.currentTarget.getBoundingClientRect());
              setPeriodoAberto((v) => !v);
            }}
          >
            {periodoFiltro} ▾
          </button>
          <FloatingDropdown
            anchorRect={periodoAberto ? periodoRect : null}
            onClose={() => {
              setPeriodoAberto(false);
              setPeriodoPersonalizadoAberto(false);
            }}
            width={240}
          >
            {periodoPersonalizadoAberto ? (
              <div style={{ padding: 14 }}>
                <p className="form-link-h" style={{ marginBottom: 10 }}>
                  📅 Escolha as datas
                </p>
                <div className="field" style={{ padding: 0, marginBottom: 10 }}>
                  <label>De</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="date"
                    value={dataPersonalizadaDe}
                    onChange={(e) => setDataPersonalizadaDe(e.target.value)}
                  />
                </div>
                <div className="field" style={{ padding: 0, marginBottom: 12 }}>
                  <label>Até</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="date"
                    value={dataPersonalizadaAte}
                    onChange={(e) => setDataPersonalizadaAte(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn primary block"
                  disabled={!dataPersonalizadaDe || !dataPersonalizadaAte}
                  onClick={aplicarPeriodoPersonalizado}
                >
                  Aplicar
                </button>
              </div>
            ) : (
              <>
                {PERIODOS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => {
                      setPeriodoFiltro(p);
                      setPeriodoAberto(false);
                    }}
                  >
                    <span className="n">{p}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="dropdown-item"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => setPeriodoPersonalizadoAberto(true)}
                >
                  <span className="n">📅 Personalizado…</span>
                </button>
              </>
            )}
          </FloatingDropdown>
        </div>

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

        <div className="card">
          <div className="panel-h">
            <h4>Por campanha</h4>
            <span className="link">ROAS</span>
          </div>
          {campanhasFiltradas.length === 0 ? (
            <p className="hint" style={{ padding: 17 }}>
              Nenhuma campanha com esses filtros.
            </p>
          ) : (
            campanhasFiltradas.map((campanha) => (
              <div className="camp-row" key={campanha.nome}>
                <div className="camp-icon">{campanha.plataforma}</div>
                <div className="camp-body">
                  <p className="camp-name">{campanha.nome}</p>
                  <p className="camp-sub">{campanha.sub}</p>
                  <div className="camp-track">
                    <div
                      className="camp-fill"
                      style={{ width: `${campanha.barra}%` }}
                    />
                  </div>
                </div>
                <span className="camp-num">{campanha.roas}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
