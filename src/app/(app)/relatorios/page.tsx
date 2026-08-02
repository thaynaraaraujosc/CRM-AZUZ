"use client";

import Link from "next/link";
import { useState } from "react";

import {
  CAMPOS_FILTRO_PERSONALIZADO,
  TIPOS_RELATORIO_ANALISE,
  conversaoPorResponsavel,
  equipe,
  faturamentoPorResponsavel,
  ligacoesPorResponsavel,
  motivosPerda,
  oportunidadesPerdidas,
  relatorioAutomatico,
  relatorioManual,
  relatorioPorOrigem,
  relatoriosAnteriores,
  serieDashboardRelatorios,
  tarefas,
  tempoPrimeiroContatoPorResponsavel,
} from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { FloatingDropdown, Topbar } from "@/components/ui";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formata(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia} ${MESES[Number(mes) - 1]} ${ano}`;
}

type FiltroPersonalizado = { campo: string; valor: string };
type FiltroSalvo = { nome: string; filtros: FiltroPersonalizado[] };

const SERIES_DASHBOARD: {
  chave: "criadas" | "vendas" | "perdidas";
  cor: string;
  label: string;
}[] = [
  { chave: "criadas", cor: "#2e6bff", label: "Oportunidades criadas" },
  { chave: "vendas", cor: "#0f9d63", label: "Vendas" },
  { chave: "perdidas", cor: "#d64545", label: "Oportunidades perdidas" },
];

function DashboardAreaChart() {
  const largura = 800;
  const altura = 220;
  const pontos = serieDashboardRelatorios;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const maior = Math.max(
    1,
    ...pontos.map((p) => Math.max(p.criadas, p.vendas, p.perdidas)),
  );
  const passo = largura / (pontos.length - 1);

  function caminho(chave: "criadas" | "vendas" | "perdidas", area: boolean) {
    const linha = pontos
      .map((p, i) => {
        const x = i * passo;
        const y = altura - (p[chave] / maior) * (altura - 20) - 6;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    if (!area) return linha;
    return `${linha} L${largura},${altura} L0,${altura} Z`;
  }

  function aoMoverMouse(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRelativo = ((e.clientX - rect.left) / rect.width) * largura;
    const indice = Math.max(0, Math.min(pontos.length - 1, Math.round(xRelativo / passo)));
    setHoverIndex(indice);
  }

  const pontoHover = hoverIndex !== null ? pontos[hoverIndex] : null;

  return (
    <div style={{ position: "relative" }}>
      <p className="hint" style={{ marginBottom: 10, display: "flex", gap: 16 }}>
        {SERIES_DASHBOARD.map((s) => (
          <span key={s.chave}>
            <span style={{ color: s.cor }}>●</span> {s.label}
          </span>
        ))}
      </p>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ width: "100%", height: 220, overflow: "visible", cursor: "crosshair" }}
        onMouseMove={aoMoverMouse}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {SERIES_DASHBOARD.map((s) => (
          <path key={s.chave} d={caminho(s.chave, true)} fill={s.cor} opacity={0.14} />
        ))}
        {SERIES_DASHBOARD.map((s) => (
          <path
            key={`${s.chave}-linha`}
            d={caminho(s.chave, false)}
            fill="none"
            stroke={s.cor}
            strokeWidth={2}
          />
        ))}
        {hoverIndex !== null ? (
          <line
            x1={hoverIndex * passo}
            x2={hoverIndex * passo}
            y1={0}
            y2={altura}
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
        ) : null}
      </svg>
      {pontoHover ? (
        <div
          className="chart-tooltip"
          style={{
            left: `${Math.min(88, Math.max(2, (hoverIndex! / (pontos.length - 1)) * 100))}%`,
          }}
        >
          <b>Dia {pontoHover.dia}</b>
          {SERIES_DASHBOARD.map((s) => (
            <div key={s.chave}>
              <span style={{ color: s.cor }}>●</span> {s.label}: {pontoHover[s.chave]}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {pontos.map((p, i) => (
          <span
            key={p.dia}
            className="hint"
            style={{ fontSize: 10, visibility: i % 3 === 0 ? "visible" : "hidden" }}
          >
            {p.dia}
          </span>
        ))}
      </div>
    </div>
  );
}

function VendasPorDiaChart() {
  const pontos = serieDashboardRelatorios.filter((p) => p.valorVendas > 0);
  const maior = Math.max(1, ...serieDashboardRelatorios.map((p) => p.valorVendas));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, padding: "0 4px" }}>
      {serieDashboardRelatorios.map((p) => (
        <div
          key={p.dia}
          title={p.valorVendas > 0 ? `Dia ${p.dia}: ${formatarReaisSimples(p.valorVendas)}` : `Dia ${p.dia}: sem venda`}
          style={{
            flex: 1,
            height: `${Math.max(2, (p.valorVendas / maior) * 130)}px`,
            background: p.valorVendas > 0 ? "#0f9d63" : "var(--line)",
            borderRadius: "3px 3px 0 0",
          }}
        />
      ))}
      {pontos.length === 0 ? null : null}
    </div>
  );
}

function formatarReaisSimples(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function polarParaCartesiano(cx: number, cy: number, r: number, anguloDeg: number) {
  const rad = ((anguloDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function caminhoDaFatia(cx: number, cy: number, r: number, inicio: number, fim: number) {
  const p1 = polarParaCartesiano(cx, cy, r, fim);
  const p2 = polarParaCartesiano(cx, cy, r, inicio);
  const arcoGrande = fim - inicio > 180 ? 1 : 0;
  return `M${cx},${cy} L${p1.x},${p1.y} A${r},${r} 0 ${arcoGrande} 0 ${p2.x},${p2.y} Z`;
}

const CORES_PIZZA = ["#2e6bff", "#0f9d63", "#8a3ffc", "#e0a83c", "#d64545", "#0aa3a3"];

function PieCard({
  titulo,
  cor,
  dados,
  formatarValor,
}: {
  titulo: string;
  cor: string;
  dados: { nome: string; valor: number }[];
  formatarValor?: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ nome: string; valor: number; x: number; y: number } | null>(
    null,
  );
  const total = dados.reduce((s, d) => s + d.valor, 0) || 1;
  const comValor = dados.filter((d) => d.valor > 0);
  const limites = comValor.reduce<number[]>((acc, d) => {
    const anterior = acc.length > 0 ? acc[acc.length - 1] : 0;
    return [...acc, anterior + (d.valor / total) * 360];
  }, []);
  const fatias = comValor.map((d, i) => ({
    ...d,
    inicio: i > 0 ? limites[i - 1] : 0,
    fim: limites[i],
    cor: CORES_PIZZA[i % CORES_PIZZA.length],
  }));

  return (
    <div className="card">
      <div className="panel-h">
        <h4 style={{ color: cor }}>{titulo}</h4>
      </div>
      <div style={{ padding: 17, position: "relative" }}>
        <svg viewBox="0 0 200 200" style={{ width: 160, height: 160, margin: "0 auto", display: "block" }}>
          {fatias.map((f) => (
            <path
              key={f.nome}
              d={caminhoDaFatia(100, 100, 92, f.inicio, f.fim)}
              fill={f.cor}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) =>
                setHover({ nome: f.nome, valor: f.valor, x: e.clientX, y: e.clientY })
              }
              onMouseMove={(e) =>
                setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))
              }
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover ? (
          <div
            className="pie-tooltip"
            style={{ left: hover.x, top: hover.y }}
          >
            <b>{hover.nome}</b>
            <br />
            Valor: {formatarValor ? formatarValor(hover.valor) : hover.valor}
          </div>
        ) : null}
        <div className="pie-legenda">
          {fatias.map((f) => (
            <span key={f.nome} className="pie-legenda-item">
              <span className="dot" style={{ background: f.cor }} />
              {f.nome}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RelatoriosPage() {
  const { funis } = useFunis();
  const [modoPagina, setModoPagina] = useState<"analise" | "pdf">("analise");

  const [tipoRelatorio, setTipoRelatorio] = useState<(typeof TIPOS_RELATORIO_ANALISE)[number]>(
    "Dashboard",
  );
  const [tipoAberto, setTipoAberto] = useState(false);
  const [tipoRect, setTipoRect] = useState<DOMRect | null>(null);

  const [funilAnaliseAberto, setFunilAnaliseAberto] = useState(false);
  const [funilAnaliseRect, setFunilAnaliseRect] = useState<DOMRect | null>(null);
  const [funilAnaliseFiltro, setFunilAnaliseFiltro] = useState(
    "Funil PADRÃO (Não Alterar)",
  );

  const [responsavelAnaliseAberto, setResponsavelAnaliseAberto] = useState(false);
  const [responsavelAnaliseRect, setResponsavelAnaliseRect] = useState<DOMRect | null>(null);
  const [responsavelAnaliseFiltro, setResponsavelAnaliseFiltro] = useState(
    "Todas as oportunidades",
  );

  const [filtroPersonalizadoAberto, setFiltroPersonalizadoAberto] = useState(false);
  const [filtroPersonalizadoRect, setFiltroPersonalizadoRect] = useState<DOMRect | null>(null);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltroPersonalizado[]>([]);
  const [filtrosSalvos, setFiltrosSalvos] = useState<FiltroSalvo[]>([]);
  const [nomeFiltroSalvo, setNomeFiltroSalvo] = useState("");

  const [kpiDetalheAberto, setKpiDetalheAberto] = useState<
    "criadas" | "vendas" | "perdidas" | null
  >(null);

  function alternarCampoFiltro(campo: string) {
    setFiltrosAtivos((prev) =>
      prev.some((f) => f.campo === campo)
        ? prev.filter((f) => f.campo !== campo)
        : [...prev, { campo, valor: "" }],
    );
  }

  function mudarValorFiltro(campo: string, valor: string) {
    setFiltrosAtivos((prev) => prev.map((f) => (f.campo === campo ? { ...f, valor } : f)));
  }

  function salvarFiltroAtual() {
    const nome = nomeFiltroSalvo.trim();
    if (!nome || filtrosAtivos.length === 0) return;
    setFiltrosSalvos((prev) => [...prev, { nome, filtros: filtrosAtivos }]);
    setNomeFiltroSalvo("");
  }

  const totalCriadas = serieDashboardRelatorios.reduce((s, p) => s + p.criadas, 0);
  const totalVendas = serieDashboardRelatorios.reduce((s, p) => s + p.vendas, 0);
  const totalPerdidas = serieDashboardRelatorios.reduce((s, p) => s + p.perdidas, 0);
  const totalValorVendas = serieDashboardRelatorios.reduce((s, p) => s + p.valorVendas, 0);
  const ticketMedio = totalVendas > 0 ? totalValorVendas / totalVendas : 0;

  const tarefasPorResponsavel = equipe.map((m) => {
    let criadas = 0;
    let finalizadas = 0;
    let pendentes = 0;
    for (const coluna of tarefas) {
      for (const card of coluna.cards) {
        if (card.responsavel.nome !== m.nome) continue;
        criadas += 1;
        if (coluna.titulo === "Concluídas") finalizadas += 1;
        else pendentes += 1;
      }
    }
    return { nome: m.nome, criadas, finalizadas, pendentes };
  });

  const [dataDe, setDataDe] = useState("2026-07-01");
  const [dataAte, setDataAte] = useState("2026-07-31");
  const [editandoPeriodo, setEditandoPeriodo] = useState(false);
  const [origensSelecionadas, setOrigensSelecionadas] = useState(
    () => new Set(relatorioPorOrigem.map((o) => o.id)),
  );
  const [faturamento, setFaturamento] = useState("");
  const [percentualPago, setPercentualPago] = useState("");
  const [queixas, setQueixas] = useState("");

  function alternarOrigem(id: string) {
    setOrigensSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const origensParam = [...origensSelecionadas].join(",");
  const pdfParams = new URLSearchParams({
    de: dataDe,
    ate: dataAte,
    origens: origensParam,
    faturamento: faturamento.trim() || relatorioManual.faturamento,
    percentualPago: percentualPago.trim() || relatorioManual.percentualPago,
    queixas: queixas.trim() || relatorioManual.queixasPlaceholder,
  });

  return (
    <>
      <Topbar
        title="Relatórios"
        sub="Escolha o período pra montar na hora"
        actions={
          <Link
            className="btn primary"
            href={`/relatorio-pdf?${pdfParams.toString()}`}
            target="_blank"
          >
            Gerar PDF
          </Link>
        }
      />

      <div className="content">
        <div className="filters-row mb14">
          <button
            type="button"
            className={`fchip${modoPagina === "analise" ? " active" : ""}`}
            onClick={() => setModoPagina("analise")}
          >
            Análise
          </button>
          <button
            type="button"
            className={`fchip${modoPagina === "pdf" ? " active" : ""}`}
            onClick={() => setModoPagina("pdf")}
          >
            Relatório da clínica (PDF)
          </button>
        </div>

        {modoPagina === "analise" ? (
          <div className="rel-analise">
            <div className="filter-strip">
              <button
                type="button"
                className="fsel"
                onClick={(e) => {
                  setTipoRect(e.currentTarget.getBoundingClientRect());
                  setTipoAberto((v) => !v);
                }}
              >
                Tipo de relatório: {tipoRelatorio} ▾
              </button>
              <FloatingDropdown
                anchorRect={tipoAberto ? tipoRect : null}
                onClose={() => setTipoAberto(false)}
                width={240}
              >
                {TIPOS_RELATORIO_ANALISE.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => {
                      setTipoRelatorio(t);
                      setTipoAberto(false);
                    }}
                  >
                    <span className="n">{t}</span>
                  </button>
                ))}
              </FloatingDropdown>

              <button
                type="button"
                className="fsel"
                onClick={(e) => {
                  setFunilAnaliseRect(e.currentTarget.getBoundingClientRect());
                  setFunilAnaliseAberto((v) => !v);
                }}
              >
                Funil de vendas: {funilAnaliseFiltro} ▾
              </button>
              <FloatingDropdown
                anchorRect={funilAnaliseAberto ? funilAnaliseRect : null}
                onClose={() => setFunilAnaliseAberto(false)}
                width={240}
              >
                {["Funil PADRÃO (Não Alterar)", ...funis.map((f) => f.nome)].map((nome) => (
                  <button
                    type="button"
                    key={nome}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => {
                      setFunilAnaliseFiltro(nome);
                      setFunilAnaliseAberto(false);
                    }}
                  >
                    <span className="n">{nome}</span>
                  </button>
                ))}
              </FloatingDropdown>

              <button
                type="button"
                className="fsel"
                onClick={(e) => {
                  setResponsavelAnaliseRect(e.currentTarget.getBoundingClientRect());
                  setResponsavelAnaliseAberto((v) => !v);
                }}
              >
                Responsável: {responsavelAnaliseFiltro} ▾
              </button>
              <FloatingDropdown
                anchorRect={responsavelAnaliseAberto ? responsavelAnaliseRect : null}
                onClose={() => setResponsavelAnaliseAberto(false)}
                width={220}
              >
                <button
                  type="button"
                  className="dropdown-item"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => {
                    setResponsavelAnaliseFiltro("Todas as oportunidades");
                    setResponsavelAnaliseAberto(false);
                  }}
                >
                  <span className="n">Todas as oportunidades</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => {
                    setResponsavelAnaliseFiltro("Minhas oportunidades");
                    setResponsavelAnaliseAberto(false);
                  }}
                >
                  <span className="n">Minhas oportunidades</span>
                </button>
                {equipe.map((m) => (
                  <button
                    type="button"
                    key={m.nome}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => {
                      setResponsavelAnaliseFiltro(m.nome);
                      setResponsavelAnaliseAberto(false);
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
                  setFiltroPersonalizadoRect(e.currentTarget.getBoundingClientRect());
                  setFiltroPersonalizadoAberto((v) => !v);
                }}
              >
                🎚 Filtro personalizado
                {filtrosAtivos.length > 0 ? ` · ${filtrosAtivos.length} ativos` : ""} ▾
              </button>
              <FloatingDropdown
                anchorRect={filtroPersonalizadoAberto ? filtroPersonalizadoRect : null}
                onClose={() => setFiltroPersonalizadoAberto(false)}
                width={300}
                maxHeight={440}
              >
                {filtrosSalvos.length > 0 ? (
                  <>
                    <p className="hint" style={{ padding: "8px 12px 4px" }}>Filtros salvos</p>
                    {filtrosSalvos.map((fs) => (
                      <button
                        type="button"
                        key={fs.nome}
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => setFiltrosAtivos(fs.filtros)}
                      >
                        <span className="n">⭐ {fs.nome}</span>
                      </button>
                    ))}
                    <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />
                  </>
                ) : null}
                {CAMPOS_FILTRO_PERSONALIZADO.map((campo) => {
                  const ativo = filtrosAtivos.find((f) => f.campo === campo);
                  return (
                    <div key={campo} style={{ padding: "4px 12px" }}>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left", padding: "6px 0" }}
                        onClick={() => alternarCampoFiltro(campo)}
                      >
                        <span className="n">{ativo ? "☑" : "☐"} {campo}</span>
                      </button>
                      {ativo ? (
                        <input
                          className="input"
                          style={{ width: "100%", marginBottom: 6 }}
                          placeholder={`Valor de ${campo.toLowerCase()}…`}
                          value={ativo.valor}
                          onChange={(e) => mudarValorFiltro(campo, e.target.value)}
                        />
                      ) : null}
                    </div>
                  );
                })}
                {filtrosAtivos.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, padding: "8px 12px" }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="Nome do filtro…"
                      value={nomeFiltroSalvo}
                      onChange={(e) => setNomeFiltroSalvo(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={salvarFiltroAtual}
                      disabled={!nomeFiltroSalvo.trim()}
                    >
                      Salvar filtro
                    </button>
                  </div>
                ) : null}
              </FloatingDropdown>
            </div>

            {tipoRelatorio === "Dashboard" ? (
              <>
                <div className="grid kpi4">
                  <button
                    type="button"
                    className="card kpi"
                    style={{ textAlign: "left", cursor: "pointer" }}
                    onClick={() => setKpiDetalheAberto("criadas")}
                  >
                    <p className="l">Oportunidades criadas</p>
                    <p className="n">{totalCriadas}</p>
                    <p className="hint">Clique pra ver a lista</p>
                  </button>
                  <button
                    type="button"
                    className="card kpi"
                    style={{ textAlign: "left", cursor: "pointer" }}
                    onClick={() => setKpiDetalheAberto("vendas")}
                  >
                    <p className="l">Vendas — valor gerado</p>
                    <p className="n">{formatarReaisSimples(totalValorVendas)}</p>
                    <p className="hint">
                      {totalVendas} vendas · ticket médio {formatarReaisSimples(ticketMedio)}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="card kpi"
                    style={{ textAlign: "left", cursor: "pointer" }}
                    onClick={() => setKpiDetalheAberto("perdidas")}
                  >
                    <p className="l">Oportunidades perdidas</p>
                    <p className="n">{totalPerdidas}</p>
                    <p className="hint">Clique pra ver a lista</p>
                  </button>
                  <div className="card kpi">
                    <p className="l">Número de vendas</p>
                    <p className="n">{totalVendas}</p>
                    <p className="hint">No período selecionado</p>
                  </div>
                </div>

                {kpiDetalheAberto ? (
                  <div className="card mb14">
                    <div className="panel-h">
                      <h4>
                        {kpiDetalheAberto === "criadas"
                          ? "Oportunidades criadas no período"
                          : kpiDetalheAberto === "vendas"
                            ? "Oportunidades vendidas no período"
                            : "Oportunidades perdidas no período"}
                      </h4>
                      <button type="button" className="link" onClick={() => setKpiDetalheAberto(null)}>
                        Fechar ✕
                      </button>
                    </div>
                    {kpiDetalheAberto === "perdidas" ? (
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Oportunidade</th>
                            <th>Responsável</th>
                            <th>Motivo</th>
                            <th>Etapa</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {oportunidadesPerdidas.map((o) => (
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="hint" style={{ padding: 17 }}>
                        Abra cada dia no gráfico abaixo pra ver quantas oportunidades{" "}
                        {kpiDetalheAberto === "criadas" ? "entraram" : "foram vendidas"} — a lista
                        detalhada por oportunidade individual chega numa próxima leva, junto com o
                        cadastro completo de cada negociação.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="card mb14">
                  <div className="panel-h">
                    <h4>Oportunidades, vendas e perdas ao longo do período</h4>
                  </div>
                  <div style={{ padding: 17 }}>
                    <DashboardAreaChart />
                  </div>
                </div>

                <div className="card mb14">
                  <div className="panel-h">
                    <h4>Valor vendido por dia</h4>
                    <span className="hint">Passe o mouse pra ver o valor de cada dia</span>
                  </div>
                  <div style={{ padding: 17 }}>
                    <VendasPorDiaChart />
                  </div>
                </div>

                <div className="grid rel-pizzas mb14">
                  <PieCard
                    titulo="Oportunidades por vendedor"
                    cor="#2e6bff"
                    dados={tempoPrimeiroContatoPorResponsavel.map((r) => ({
                      nome: r.nome,
                      valor: r.oportunidades,
                    }))}
                  />
                  <PieCard
                    titulo="Vendas por vendedor"
                    cor="#0f9d63"
                    dados={conversaoPorResponsavel.map((r) => ({ nome: r.nome, valor: r.vendidas }))}
                  />
                  <PieCard
                    titulo="Faturamento por vendedor"
                    cor="#8a3ffc"
                    dados={faturamentoPorResponsavel}
                    formatarValor={formatarReaisSimples}
                  />
                  <PieCard
                    titulo="Funil por criação"
                    cor="#0aa3a3"
                    dados={
                      funis[0]?.colunas.map((c) => ({ nome: c.titulo, valor: c.total })) ?? []
                    }
                  />
                  <PieCard
                    titulo="Valor x Usuários"
                    cor="#e0a83c"
                    dados={faturamentoPorResponsavel}
                    formatarValor={formatarReaisSimples}
                  />
                  <PieCard
                    titulo="Motivos de perda"
                    cor="#d64545"
                    dados={motivosPerda.map((m) => ({ nome: m.motivo, valor: m.quantidade }))}
                  />
                </div>

                <div className="card">
                  <div className="panel-h">
                    <h4>Tarefas por vendedor</h4>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Vendedor</th>
                        <th>Criadas</th>
                        <th>Finalizadas</th>
                        <th>Pendentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarefasPorResponsavel.map((r) => (
                        <tr key={r.nome}>
                          <td>{r.nome}</td>
                          <td>{r.criadas}</td>
                          <td>{r.finalizadas}</td>
                          <td>{r.pendentes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : tipoRelatorio === "Pipeline" ? (
              <div className="card">
                <div className="panel-h">
                  <h4>Pipeline — {funilAnaliseFiltro}</h4>
                </div>
                <div style={{ padding: 17 }}>
                  {(funis[0]?.colunas ?? []).map((c) => (
                    <div className="camp-row" key={c.titulo}>
                      <div className="camp-body">
                        <p className="camp-name">{c.titulo}</p>
                        <div className="camp-track">
                          <div
                            className="camp-fill"
                            style={{
                              width: `${Math.min(100, (c.total / Math.max(1, ...(funis[0]?.colunas.map((x) => x.total) ?? [1]))) * 100)}%`,
                              background: "#2e6bff",
                            }}
                          />
                        </div>
                      </div>
                      <span className="camp-num">{c.total} contatos</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : tipoRelatorio === "Equipes" ? (
              <div className="card">
                <div className="panel-h">
                  <h4>Performance por vendedor</h4>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>Oportunidades</th>
                      <th>Vendas</th>
                      <th>Perdas</th>
                      <th>Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipe.map((m) => {
                      const conv = conversaoPorResponsavel.find((r) => r.nome === m.nome);
                      const opo = tempoPrimeiroContatoPorResponsavel.find((r) => r.nome === m.nome);
                      const fat = faturamentoPorResponsavel.find((r) => r.nome === m.nome);
                      return (
                        <tr key={m.nome}>
                          <td>{m.nome}</td>
                          <td>{opo?.oportunidades ?? "—"}</td>
                          <td>{conv?.vendidas ?? "—"}</td>
                          <td>{conv?.perdidas ?? "—"}</td>
                          <td>{fat ? formatarReaisSimples(fat.valor) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : tipoRelatorio === "Ligações" || tipoRelatorio === "Comparativo de ligações" ? (
              <>
                <div className="grid kpi4">
                  <div className="card kpi">
                    <p className="l">Ligações feitas</p>
                    <p className="n">
                      {ligacoesPorResponsavel.reduce((s, r) => s + r.quantidade, 0)}
                    </p>
                    <p className="hint">Pelo telefone virtual do CRM, no período</p>
                  </div>
                  <div className="card kpi">
                    <p className="l">Duração média</p>
                    <p className="n">3min 55s</p>
                  </div>
                </div>
                <div className="card">
                  <div className="panel-h">
                    <h4>Ligações por vendedor</h4>
                  </div>
                  <div style={{ padding: 17 }}>
                    {ligacoesPorResponsavel.map((r) => {
                      const maior = Math.max(...ligacoesPorResponsavel.map((x) => x.quantidade));
                      return (
                        <div className="camp-row" key={r.nome}>
                          <div className="camp-body">
                            <p className="camp-name">
                              {r.nome} · duração média {r.duracaoMedia}
                            </p>
                            <div className="camp-track">
                              <div
                                className="camp-fill"
                                style={{ width: `${(r.quantidade / maior) * 100}%`, background: "#2e6bff" }}
                              />
                            </div>
                          </div>
                          <span className="camp-num">{r.quantidade} ligações</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="card">
                <div style={{ padding: 40, textAlign: "center" }}>
                  <p className="n" style={{ marginBottom: 6 }}>🚧 {tipoRelatorio}</p>
                  <p className="hint">Esse relatório ainda está em construção.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
        <div className="grid rep-grid">
          <div>
            <button
              type="button"
              className="date-picker"
              style={{ cursor: "pointer", width: "100%", textAlign: "left" }}
              onClick={() => setEditandoPeriodo((v) => !v)}
            >
              {formata(dataDe)} <span className="arrow">→</span> {formata(dataAte)}
            </button>

            {editandoPeriodo ? (
              <div className="card mb14" style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: 17,
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                  }}
                >
                  <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                    <label>De</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="date"
                      value={dataDe}
                      onChange={(e) => setDataDe(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                    <label>Até</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="date"
                      value={dataAte}
                      onChange={(e) => setDataAte(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setEditandoPeriodo(false)}
                  >
                    Aplicar período
                  </button>
                </div>
              </div>
            ) : null}

            <div className="card mb14">
              <div className="panel-h">
                <h4>Automático</h4>
                <span className="badge-auto">Sistema</span>
              </div>
              {relatorioAutomatico.map((stat) => (
                <div className="stat-row" key={stat.label}>
                  <span className="sl">{stat.label}</span>
                  <span className="sv">{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="card mb14">
              <div className="panel-h">
                <h4>Origem do relatório</h4>
                <span className="badge-auto">Escolha o que entra no PDF</span>
              </div>
              <div className="filters-row" style={{ padding: "0 17px 14px" }}>
                {relatorioPorOrigem.map((origem) => (
                  <button
                    type="button"
                    key={origem.id}
                    className={`fchip${origensSelecionadas.has(origem.id) ? " active" : ""}`}
                    aria-pressed={origensSelecionadas.has(origem.id)}
                    onClick={() => alternarOrigem(origem.id)}
                  >
                    {origem.label}
                  </button>
                ))}
              </div>
              {[...origensSelecionadas].length === 0 ? (
                <p className="hint" style={{ padding: "0 17px 14px" }}>
                  Nenhuma origem escolhida — o PDF sai só com os dados gerais
                </p>
              ) : (
                relatorioPorOrigem
                  .filter((o) => origensSelecionadas.has(o.id))
                  .map((origem) => (
                    <div key={origem.id}>
                      <div className="panel-h divided">
                        <h4>{origem.label}</h4>
                      </div>
                      {origem.stats.map((stat) => (
                        <div className="stat-row" key={stat.label}>
                          <span className="sl">{stat.label}</span>
                          <span className="sv">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  ))
              )}
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>Preenchido pela secretária</h4>
                <span className="badge-manual">Opcional</span>
              </div>
              <div className="field">
                <label>Faturamento total da empresa</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  type="text"
                  inputMode="decimal"
                  value={faturamento}
                  onChange={(e) => setFaturamento(e.target.value)}
                  placeholder={relatorioManual.faturamento}
                />
              </div>
              <div className="field">
                <label>% vindo do tráfego pago</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  type="text"
                  value={percentualPago}
                  onChange={(e) => setPercentualPago(e.target.value)}
                  placeholder={relatorioManual.percentualPago}
                />
              </div>
              <div className="field">
                <label>Queixas mais frequentes</label>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                  value={queixas}
                  onChange={(e) => setQueixas(e.target.value)}
                  placeholder={relatorioManual.queixasPlaceholder}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="panel-h">
              <h4>Relatórios anteriores</h4>
            </div>
            <div className="prev-list">
              {relatoriosAnteriores.map((rel) => (
                <div className="prev-row" key={rel.nome}>
                  <div>
                    <p className="n">{rel.nome}</p>
                    <p className="d">{rel.gerado}</p>
                  </div>
                  <button type="button" className="btn ghost">
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  );
}
