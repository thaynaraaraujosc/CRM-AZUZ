"use client";

import { useState } from "react";
import Link from "next/link";

import {
  conversaoPorResponsavel,
  equipe,
  kpisConversao,
  kpisMotivosPerda,
  motivosPerda,
  oportunidadesPerdidas,
} from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import {
  FloatingDropdown,
  PERIODO_PADRAO,
  PeriodoPicker,
  Topbar,
  type PeriodoValor,
} from "@/components/ui";

const ABAS = ["Conversão", "Motivos de perda"] as const;
type Aba = (typeof ABAS)[number];

const CORES_MOTIVO: Record<string, string> = {
  "Achou caro / sem orçamento": "#d64545",
  "Escolheu outra clínica": "#e0a83c",
  "Sumiu, parou de responder": "#8a3ffc",
  "Não é o momento": "#2e6bff",
};

const AGRUPAMENTOS = ["Etapas do funil", "Responsável"] as const;
type Agrupamento = (typeof AGRUPAMENTOS)[number];

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

  const [criadasFiltro, setCriadasFiltro] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [fechadasFiltro, setFechadasFiltro] = useState<PeriodoValor>(PERIODO_PADRAO);

  const [agrupamentoAberto, setAgrupamentoAberto] = useState(false);
  const [agrupamentoRect, setAgrupamentoRect] = useState<DOMRect | null>(null);
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("Etapas do funil");
  const [modoValorPerda, setModoValorPerda] = useState<"volume" | "percentual">("volume");
  const [modoGraficoPerda, setModoGraficoPerda] = useState<"lista" | "barras">("barras");
  const [clienteFiltroPerda, setClienteFiltroPerda] = useState<string | null>(null);

  const dadosResponsavel = conversaoPorResponsavel.filter(
    (r) => responsavelFiltro === "Todos" || r.nome === responsavelFiltro,
  );
  const maiorTotal = Math.max(
    ...conversaoPorResponsavel.map((r) => r.vendidas + r.perdidas),
  );

  const chaveGrupo =
    agrupamento === "Etapas do funil"
      ? (o: (typeof oportunidadesPerdidas)[number]) => o.etapa
      : (o: (typeof oportunidadesPerdidas)[number]) => o.responsavel;

  const gruposPerda = Array.from(new Set(oportunidadesPerdidas.map(chaveGrupo))).map(
    (grupo) => {
      const doGrupo = oportunidadesPerdidas.filter((o) => chaveGrupo(o) === grupo);
      const porMotivo = motivosPerda
        .map((m) => ({
          motivo: m.motivo,
          quantidade: doGrupo.filter((o) => o.motivo === m.motivo).length,
        }))
        .filter((m) => m.quantidade > 0);
      return { grupo, total: doGrupo.length, porMotivo };
    },
  );
  const maiorGrupo = Math.max(...gruposPerda.map((g) => g.total), 1);

  const oportunidadesFiltradasPerda = clienteFiltroPerda
    ? oportunidadesPerdidas.filter((o) => o.motivo === clienteFiltroPerda)
    : oportunidadesPerdidas;

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

          <PeriodoPicker label="Criadas em" value={criadasFiltro} onChange={setCriadasFiltro} />
          <PeriodoPicker label="Fechadas em" value={fechadasFiltro} onChange={setFechadasFiltro} />
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
                  <button
                    type="button"
                    key={m.motivo}
                    className="camp-row"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      opacity: clienteFiltroPerda && clienteFiltroPerda !== m.motivo ? 0.5 : 1,
                    }}
                    onClick={() =>
                      setClienteFiltroPerda((atual) => (atual === m.motivo ? null : m.motivo))
                    }
                  >
                    <div className="camp-body">
                      <p className="camp-name">
                        {m.motivo} · {m.quantidade}{" "}
                        {m.quantidade === 1 ? "oportunidade" : "oportunidades"}
                      </p>
                      <div className="camp-track">
                        <div
                          className="camp-fill"
                          style={{
                            width: `${m.percentual}%`,
                            background: CORES_MOTIVO[m.motivo] ?? "#d64545",
                          }}
                        />
                      </div>
                    </div>
                    <span className="camp-num">{m.valor}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>Motivos de perda no período</h4>
                <div className="filters-row" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="fsel"
                    onClick={(e) => {
                      setAgrupamentoRect(e.currentTarget.getBoundingClientRect());
                      setAgrupamentoAberto((v) => !v);
                    }}
                  >
                    Agrupado por: {agrupamento} ▾
                  </button>
                  <FloatingDropdown
                    anchorRect={agrupamentoAberto ? agrupamentoRect : null}
                    onClose={() => setAgrupamentoAberto(false)}
                    width={200}
                  >
                    {AGRUPAMENTOS.map((a) => (
                      <button
                        type="button"
                        key={a}
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          setAgrupamento(a);
                          setAgrupamentoAberto(false);
                        }}
                      >
                        <span className="n">{a}</span>
                      </button>
                    ))}
                  </FloatingDropdown>
                  <button
                    type="button"
                    className={`fchip${modoValorPerda === "volume" ? " active" : ""}`}
                    onClick={() => setModoValorPerda("volume")}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    className={`fchip${modoValorPerda === "percentual" ? " active" : ""}`}
                    onClick={() => setModoValorPerda("percentual")}
                  >
                    Porcentagem
                  </button>
                  <button
                    type="button"
                    className={`fchip${modoGraficoPerda === "lista" ? " active" : ""}`}
                    onClick={() => setModoGraficoPerda("lista")}
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    className={`fchip${modoGraficoPerda === "barras" ? " active" : ""}`}
                    onClick={() => setModoGraficoPerda("barras")}
                  >
                    Gráfico
                  </button>
                </div>
              </div>
              <div style={{ padding: "10px 17px 17px" }}>
                <p className="hint" style={{ marginBottom: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {motivosPerda.map((m) => (
                    <span key={m.motivo}>
                      <span style={{ color: CORES_MOTIVO[m.motivo] ?? "#d64545" }}>●</span>{" "}
                      {m.motivo}
                    </span>
                  ))}
                </p>
                {gruposPerda.map((g) => (
                  <div className="camp-row" key={g.grupo}>
                    <div className="camp-body">
                      <p className="camp-name">
                        {g.grupo} · Perdidos: {g.total}
                      </p>
                      {modoGraficoPerda === "barras" ? (
                        <div className="camp-track" style={{ display: "flex" }}>
                          {g.porMotivo.map((pm, i) => (
                            <div
                              key={pm.motivo}
                              style={{
                                height: "100%",
                                borderRadius:
                                  i === 0
                                    ? "999px 0 0 999px"
                                    : i === g.porMotivo.length - 1
                                      ? "0 999px 999px 0"
                                      : 0,
                                background: CORES_MOTIVO[pm.motivo] ?? "#d64545",
                                width: `${
                                  modoValorPerda === "volume"
                                    ? (pm.quantidade / maiorGrupo) * 100
                                    : (pm.quantidade / g.total) * 100
                                }%`,
                              }}
                              title={`${pm.motivo}: ${pm.quantidade}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="camp-num">{g.total}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>Lista de oportunidades filtradas</h4>
                {clienteFiltroPerda ? (
                  <button type="button" className="link" onClick={() => setClienteFiltroPerda(null)}>
                    Limpar filtro: {clienteFiltroPerda} ✕
                  </button>
                ) : null}
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Oportunidade</th>
                    <th>Responsável</th>
                    <th>Motivo de perda</th>
                    <th>Etapa</th>
                    <th>Valor total</th>
                    <th>Data de fechamento</th>
                  </tr>
                </thead>
                <tbody>
                  {oportunidadesFiltradasPerda.map((o) => (
                    <tr key={o.cliente}>
                      <td>
                        <Link href={`/conversas?contato=${encodeURIComponent(o.cliente)}`} className="link">
                          {o.cliente}
                        </Link>
                      </td>
                      <td>{o.responsavel}</td>
                      <td>{o.motivo}</td>
                      <td>{o.etapa}</td>
                      <td>{o.valor}</td>
                      <td>{o.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
