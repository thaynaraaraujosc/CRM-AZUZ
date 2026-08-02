"use client";

import { useState } from "react";

import {
  conversas,
  equipe,
  kpisPrimeiroContato,
  tarefas,
  tempoPrimeiroContatoPorResponsavel,
} from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { FloatingDropdown, Topbar } from "@/components/ui";

const ABAS = ["Tempo de primeiro contato", "Tarefas", "Interações"] as const;
type Aba = (typeof ABAS)[number];

const PERIODOS = [
  "Qualquer período",
  "Últimos 7 dias",
  "Este mês",
  "Mês passado",
];

export default function AtividadesVendasPage() {
  const { funis } = useFunis();
  const [abaAtiva, setAbaAtiva] = useState<Aba>("Tempo de primeiro contato");
  const [modoGrafico, setModoGrafico] = useState<"lista" | "barras">("barras");

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

  const dadosResponsavel = tempoPrimeiroContatoPorResponsavel.filter(
    (r) => responsavelFiltro === "Todos" || r.nome === responsavelFiltro,
  );
  const maiorMinutos = Math.max(
    ...tempoPrimeiroContatoPorResponsavel.map((r) => r.minutos),
  );

  const todasAsTarefas = tarefas.flatMap((c) => c.cards);

  return (
    <>
      <Topbar
        title="Atividades de venda"
        sub="Como a equipe está se comportando — tempo de resposta, tarefas e interações"
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

        {abaAtiva === "Tempo de primeiro contato" ? (
          <>
            <div className="grid kpi4">
              {kpisPrimeiroContato.map((kpi) => (
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
                <h4>Tempo de primeiro contato · agrupado por responsável</h4>
                <div className="filters-row" style={{ margin: 0 }}>
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
              <div style={{ padding: 17 }}>
                {dadosResponsavel.map((r) => (
                  <div className="camp-row" key={r.nome}>
                    <div className="camp-body">
                      <p className="camp-name">
                        {r.nome} · {r.oportunidades} contatadas
                      </p>
                      {modoGrafico === "barras" ? (
                        <div className="camp-track">
                          <div
                            className="camp-fill"
                            style={{
                              width: `${Math.max(6, (r.minutos / maiorMinutos) * 100)}%`,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <span className="camp-num">{r.tempoMedio}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {abaAtiva === "Tarefas" ? (
          <div className="card">
            <div className="panel-h">
              <h4>Tarefas por status</h4>
            </div>
            {tarefas.map((coluna) => (
              <div className="stat-row" key={coluna.titulo}>
                <span className="sl">{coluna.titulo}</span>
                <span className="sv">{coluna.cards.length} tarefas</span>
              </div>
            ))}
            <div className="panel-h divided">
              <h4>Por responsável</h4>
            </div>
            {equipe.map((m) => {
              const total = todasAsTarefas.filter(
                (t) => t.responsavel.nome === m.nome,
              ).length;
              return total > 0 ? (
                <div className="stat-row" key={m.nome}>
                  <span className="sl">{m.nome}</span>
                  <span className="sv">{total} tarefas</span>
                </div>
              ) : null;
            })}
          </div>
        ) : null}

        {abaAtiva === "Interações" ? (
          <div className="card">
            <div className="panel-h">
              <h4>Mensagens trocadas por conversa</h4>
            </div>
            {conversas.map((c) => (
              <div className="stat-row" key={c.id}>
                <span className="sl">{c.nome}</span>
                <span className="sv">{c.mensagens.length} mensagens</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
