"use client";

import { useState } from "react";

import {
  conversaoPorResponsavel,
  equipe,
  kpisConversao,
  kpisMotivosPerda,
  motivosPerda,
} from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { FloatingDropdown, Topbar } from "@/components/ui";

const ABAS = ["Conversão", "Motivos de perda"] as const;
type Aba = (typeof ABAS)[number];

const PERIODOS = [
  "Qualquer período",
  "Últimos 7 dias",
  "Este mês",
  "Mês passado",
];

export default function PerformanceVendasPage() {
  const { funis } = useFunis();
  const [abaAtiva, setAbaAtiva] = useState<Aba>("Conversão");
  const [modoGrafico, setModoGrafico] = useState<"lista" | "barras">("barras");
  const [modoValor, setModoValor] = useState<"volume" | "percentual">("volume");

  const [funilAberto, setFunilAberto] = useState(false);
  const [funilRect, setFunilRect] = useState<DOMRect | null>(null);
  const [funilFiltro, setFuncilFiltro] = useState("Todos");

  const [responsavelAberto, setResponsavelAberto] = useState(false);
  const [responsavelRect, setResponsavelRect] = useState<DOMRect | null>(null);
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");

  const [criadasAberto, setCriadasAberto] = useState(false);
  const [criadasRect, setCriadasRect] = useState<DOMRect | null>(null);
  const [criadasFiltro, setCriadasFiltro] = useState(PERIODOS[0]);

  const [fechadasAberto, setFechadasAberto] = useState(false);
  const [fechadasRect, setFechadasRect] = useState<DOMRect | null>(null);
  const [fechadasFiltro, setFechadasFiltro] = useState(PERIODOS[0]);

  const dadosResponsavel = conversaoPorResponsavel.filter(
    (r) => responsavelFiltro === "Todos" || r.nome === responsavelFiltro,
  );
  const maiorTotal = Math.max(
    ...conversaoPorResponsavel.map((r) => r.vendidas + r.perdidas),
  );

  return (
    <>
      <Topbar
        title="Performance de venda"
        sub="Taxa de conversão e motivos de perda da operação, comparado ao período anterior"
      />

      <div className="content atividades-vendas">
        <div className="filter-strip">
          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setFunilRect(e.currentTarget.getBoundingClientRect());
              setFunilAberto((v) => !v);
            }}
          >
            Funil: {funilFiltro} ▾
          </button>
          <FloatingDropdown
            anchorRect={funilAberto ? funilRect : null}
            onClose={() => setFunilAberto(false)}
            width={220}
          >
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => {
                setFuncilFiltro("Todos");
                setFunilAberto(false);
              }}
            >
              <span className="n">Todos</span>
            </button>
            {funis.map((f) => (
              <button
                type="button"
                key={f.id}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setFuncilFiltro(f.nome);
                  setFunilAberto(false);
                }}
              >
                <span className="n">{f.nome}</span>
              </button>
            ))}
          </FloatingDropdown>

          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setResponsavelRect(e.currentTarget.getBoundingClientRect());
              setResponsavelAberto((v) => !v);
            }}
          >
            Responsável: {responsavelFiltro} ▾
          </button>
          <FloatingDropdown
            anchorRect={responsavelAberto ? responsavelRect : null}
            onClose={() => setResponsavelAberto(false)}
            width={220}
          >
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => {
                setResponsavelFiltro("Todos");
                setResponsavelAberto(false);
              }}
            >
              <span className="n">Todos os responsáveis</span>
            </button>
            {equipe.map((m) => (
              <button
                type="button"
                key={m.nome}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setResponsavelFiltro(m.nome);
                  setResponsavelAberto(false);
                }}
              >
                <span className="n">{m.nome}</span>
              </button>
            ))}
          </FloatingDropdown>

          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setCriadasRect(e.currentTarget.getBoundingClientRect());
              setCriadasAberto((v) => !v);
            }}
          >
            Criadas em: {criadasFiltro} ▾
          </button>
          <FloatingDropdown
            anchorRect={criadasAberto ? criadasRect : null}
            onClose={() => setCriadasAberto(false)}
            width={200}
          >
            {PERIODOS.map((p) => (
              <button
                type="button"
                key={p}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setCriadasFiltro(p);
                  setCriadasAberto(false);
                }}
              >
                <span className="n">{p}</span>
              </button>
            ))}
          </FloatingDropdown>

          <button
            type="button"
            className="fsel"
            onClick={(e) => {
              setFechadasRect(e.currentTarget.getBoundingClientRect());
              setFechadasAberto((v) => !v);
            }}
          >
            Fechadas em: {fechadasFiltro} ▾
          </button>
          <FloatingDropdown
            anchorRect={fechadasAberto ? fechadasRect : null}
            onClose={() => setFechadasAberto(false)}
            width={200}
          >
            {PERIODOS.map((p) => (
              <button
                type="button"
                key={p}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setFechadasFiltro(p);
                  setFechadasAberto(false);
                }}
              >
                <span className="n">{p}</span>
              </button>
            ))}
          </FloatingDropdown>
        </div>

        <div className="filters-row mb14">
          {ABAS.map((aba) => (
            <button
              type="button"
              key={aba}
              className={`fchip${abaAtiva === aba ? " active" : ""}`}
              aria-pressed={abaAtiva === aba}
              onClick={() => setAbaAtiva(aba)}
            >
              {aba}
            </button>
          ))}
        </div>

        {abaAtiva === "Conversão" ? (
          <>
            <div className="grid kpi4">
              {kpisConversao.map((kpi) => (
                <div className="card kpi" key={kpi.label}>
                  <p className="l">{kpi.label}</p>
                  <p className="n">{kpi.value}</p>
                  {kpi.sub ? <p className="hint">{kpi.sub}</p> : null}
                  <p className="delta">{kpi.delta}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>Conversão de oportunidades no período</h4>
                <div className="filters-row" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={`fchip${modoValor === "volume" ? " active" : ""}`}
                    onClick={() => setModoValor("volume")}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    className={`fchip${modoValor === "percentual" ? " active" : ""}`}
                    onClick={() => setModoValor("percentual")}
                  >
                    Percentagem
                  </button>
                  <button
                    type="button"
                    className={`fchip${modoGrafico === "lista" ? " active" : ""}`}
                    onClick={() => setModoGrafico("lista")}
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    className={`fchip${modoGrafico === "barras" ? " active" : ""}`}
                    onClick={() => setModoGrafico("barras")}
                  >
                    Gráfico
                  </button>
                </div>
              </div>
              <div style={{ padding: "8px 17px 17px" }}>
                <p className="hint" style={{ marginBottom: 10 }}>
                  <span style={{ color: "#0f9d63" }}>● Oportunidades vendidas</span>
                  {"   "}
                  <span style={{ color: "#d64545" }}>● Oportunidades perdidas</span>
                </p>
                {dadosResponsavel.map((r) => {
                  const total = r.vendidas + r.perdidas;
                  const taxa = total > 0 ? Math.round((r.vendidas / total) * 100) : 0;
                  return (
                    <div className="camp-row" key={r.nome}>
                      <div className="camp-body">
                        <p className="camp-name">
                          {r.nome} · {taxa}% de conversão
                        </p>
                        {modoGrafico === "barras" ? (
                          <div className="camp-track" style={{ display: "flex" }}>
                            <div
                              style={{
                                height: "100%",
                                borderRadius: "999px 0 0 999px",
                                background: "#0f9d63",
                                width: `${
                                  modoValor === "volume"
                                    ? (r.vendidas / maiorTotal) * 100
                                    : taxa
                                }%`,
                              }}
                            />
                            <div
                              style={{
                                height: "100%",
                                borderRadius: "0 999px 999px 0",
                                background: "#d64545",
                                width: `${
                                  modoValor === "volume"
                                    ? (r.perdidas / maiorTotal) * 100
                                    : 100 - taxa
                                }%`,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                      <span className="camp-num">
                        {modoValor === "volume"
                          ? `${r.vendidas} vendidas · ${r.perdidas} perdidas`
                          : `${taxa}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid kpi4">
              {kpisMotivosPerda.map((kpi) => (
                <div className="card kpi" key={kpi.label}>
                  <p className="l">{kpi.label}</p>
                  <p className="n">{kpi.value}</p>
                  {kpi.sub ? <p className="hint">{kpi.sub}</p> : null}
                  {kpi.delta ? <p className="delta">{kpi.delta}</p> : null}
                </div>
              ))}
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>Motivos de perda no período</h4>
              </div>
              <div style={{ padding: 17 }}>
                {motivosPerda.map((m) => (
                  <div className="camp-row" key={m.motivo}>
                    <div className="camp-body">
                      <p className="camp-name">
                        {m.motivo} · {m.quantidade}{" "}
                        {m.quantidade === 1 ? "oportunidade" : "oportunidades"}
                      </p>
                      <div className="camp-track">
                        <div
                          className="camp-fill"
                          style={{ width: `${m.percentual}%`, background: "#d64545" }}
                        />
                      </div>
                    </div>
                    <span className="camp-num">{m.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
