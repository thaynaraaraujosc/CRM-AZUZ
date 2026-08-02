"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useFunis } from "@/lib/funis-context";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { resumoNo } from "@/lib/automation-flow/resumo";
import type {
  FlowNodeType,
  FluxoAutomacao,
  RegistroExecucao,
} from "@/lib/automation-flow/types";
import { IconAutomacoes } from "@/components/icons";
import { Toggle, Topbar } from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Derivações a partir de `FluxoAutomacao` / `RegistroExecucao`              */
/* -------------------------------------------------------------------------- */

function noGatilhoDoFluxo(fluxo: FluxoAutomacao) {
  return fluxo.nodes.find((n) => n.category === "gatilho");
}

function labelGatilho(tipo: FlowNodeType): string {
  return BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo)?.label ?? tipo;
}

/** "Lead entrou na etapa — Funil: x · Etapa: y" — rótulo do bloco + o resumo de uma linha que o próprio motor usa no canvas. */
function resumoGatilhoFluxo(fluxo: FluxoAutomacao): string {
  const no = noGatilhoDoFluxo(fluxo);
  if (!no) return "Sem gatilho definido";
  const detalhe = resumoNo(no);
  return detalhe && detalhe !== "Sem configuração adicional"
    ? `${labelGatilho(no.type)} — ${detalhe}`
    : labelGatilho(no.type);
}

type StatusFiltro = "rascunho" | "publicado" | "ativa" | "pausada";

const STATUS_FILTROS: { valor: StatusFiltro; label: string }[] = [
  { valor: "rascunho", label: "Rascunho" },
  { valor: "publicado", label: "Publicado" },
  { valor: "ativa", label: "Ativa" },
  { valor: "pausada", label: "Pausada" },
];

function statusBate(fluxo: FluxoAutomacao, filtro: StatusFiltro): boolean {
  switch (filtro) {
    case "rascunho":
      return fluxo.status === "rascunho";
    case "publicado":
      return fluxo.status === "publicado";
    case "ativa":
      return fluxo.status === "publicado" && fluxo.ativa;
    case "pausada":
      return fluxo.status === "publicado" && !fluxo.ativa;
    default:
      return true;
  }
}

function statusPill(fluxo: FluxoAutomacao): { label: string; on: boolean } {
  if (fluxo.status === "rascunho") return { label: "Rascunho", on: false };
  if (fluxo.ativa) return { label: "Ativa", on: true };
  return { label: "Pausada", on: false };
}

type Ordenacao = "nome" | "atualizado" | "execucoes";

const ORDENACOES: { valor: Ordenacao; label: string }[] = [
  { valor: "atualizado", label: "Última atualização" },
  { valor: "nome", label: "Nome" },
  { valor: "execucoes", label: "Execuções" },
];

function taxaSucesso(execucoes: RegistroExecucao[]): string {
  if (execucoes.length === 0) return "—";
  const concluidas = execucoes.filter((e) => e.situacao === "concluida").length;
  return `${Math.round((concluidas / execucoes.length) * 100)}%`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ultimaExecucao(execucoes: RegistroExecucao[]): string {
  if (execucoes.length === 0) return "Nunca executada";
  const maisRecente = Math.max(...execucoes.map((e) => new Date(e.iniciadoEm).getTime()));
  return formatarData(new Date(maisRecente).toISOString());
}

/** Tipos de gatilho "de comentário" — usados só pra dar um atalho de filtro sem precisar escolher canal por canal. */
const TIPOS_GATILHO_COMENTARIO: FlowNodeType[] = ["comentario_instagram", "comentario_tiktok"];

/* -------------------------------------------------------------------------- */

export default function AutomacoesPage() {
  return (
    <Suspense fallback={null}>
      <AutomacoesPageInner />
    </Suspense>
  );
}

function AutomacoesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { funis } = useFunis();
  const {
    fluxos,
    execucoesDoFluxo,
    duplicarFluxo,
    atualizarFluxo,
    arquivarFluxo,
    excluirFluxo,
    alternarAtivo,
  } = useAutomationFlows();

  const funilParam = searchParams.get("funil");
  const etapaParam = searchParams.get("etapa");
  const criarParam = searchParams.get("criar") === "1";

  useEffect(() => {
    if (criarParam) router.replace("/automacoes/editor/novo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criarParam]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<Set<StatusFiltro>>(new Set());
  const [funilFiltroId, setFunilFiltroId] = useState(funilParam ?? "");
  const [etapaFiltroId, setEtapaFiltroId] = useState(etapaParam ?? "");
  const [gatilhoFiltro, setGatilhoFiltro] = useState<string>("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("atualizado");

  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [renomeandoValor, setRenomeandoValor] = useState("");
  const [exclusaoAlvo, setExclusaoAlvo] = useState<FluxoAutomacao | null>(null);

  const funilFiltroSelecionado = funis.find((f) => f.id === funilFiltroId);

  const gatilhosDisponiveis = useMemo(() => {
    const tipos = new Set<FlowNodeType>();
    fluxos.forEach((f) => {
      const no = noGatilhoDoFluxo(f);
      if (no) tipos.add(no.type);
    });
    return [...tipos]
      .map((tipo) => ({ tipo, label: labelGatilho(tipo) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [fluxos]);

  function alternarStatusFiltro(valor: StatusFiltro) {
    setStatusFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(valor)) next.delete(valor);
      else next.add(valor);
      return next;
    });
  }

  const fluxosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = fluxos.filter((f) => {
      if (termo && !f.nome.toLowerCase().includes(termo)) return false;
      if (statusFiltro.size > 0 && ![...statusFiltro].some((s) => statusBate(f, s))) return false;
      if (funilFiltroId && f.funilId !== funilFiltroId) return false;
      if (etapaFiltroId && f.etapaId !== etapaFiltroId) return false;
      if (gatilhoFiltro === "__comentario__") {
        const no = noGatilhoDoFluxo(f);
        if (!no || !TIPOS_GATILHO_COMENTARIO.includes(no.type)) return false;
      } else if (gatilhoFiltro) {
        const no = noGatilhoDoFluxo(f);
        if (!no || no.type !== gatilhoFiltro) return false;
      }
      return true;
    });

    lista = [...lista].sort((a, b) => {
      if (ordenacao === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      if (ordenacao === "execucoes") return b.execucoes - a.execucoes;
      return new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime();
    });

    return lista;
  }, [fluxos, busca, statusFiltro, funilFiltroId, etapaFiltroId, gatilhoFiltro, ordenacao]);

  const totalAtivas = fluxos.filter((f) => f.status === "publicado" && f.ativa).length;

  function abrirMenu(id: string) {
    setMenuAbertoId((atual) => (atual === id ? null : id));
  }

  function iniciarRenomeacao(fluxo: FluxoAutomacao) {
    setRenomeandoId(fluxo.id);
    setRenomeandoValor(fluxo.nome);
    setMenuAbertoId(null);
  }

  function confirmarRenomeacao() {
    if (!renomeandoId) return;
    const nome = renomeandoValor.trim();
    if (nome) atualizarFluxo(renomeandoId, { nome });
    setRenomeandoId(null);
  }

  function pedirExclusao(fluxo: FluxoAutomacao) {
    setExclusaoAlvo(fluxo);
    setMenuAbertoId(null);
  }

  function confirmarExclusao() {
    if (!exclusaoAlvo) return;
    excluirFluxo(exclusaoAlvo.id);
    setExclusaoAlvo(null);
  }

  return (
    <>
      <Topbar
        title="Automações"
        sub={`${fluxos.length} automações · ${totalAtivas} ativas`}
        actions={
          <button
            type="button"
            className="btn primary"
            onClick={() => router.push("/automacoes/editor/novo")}
          >
            + Nova automação
          </button>
        }
      />

      <div className="content">
        <section className="card mb14">
          <div className="field">
            <label>Buscar por nome</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="text"
              placeholder="Ex.: Boas-vindas pro lead novo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Status</label>
            <div className="filters-row">
              <button
                type="button"
                className={`fchip${statusFiltro.size === 0 ? " active" : ""}`}
                aria-pressed={statusFiltro.size === 0}
                onClick={() => setStatusFiltro(new Set())}
              >
                Todos os status
              </button>
              {STATUS_FILTROS.map((s) => (
                <button
                  type="button"
                  key={s.valor}
                  className={`fchip${statusFiltro.has(s.valor) ? " active" : ""}`}
                  aria-pressed={statusFiltro.has(s.valor)}
                  onClick={() => alternarStatusFiltro(s.valor)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Funil</label>
            <div className="filters-row">
              <button
                type="button"
                className={`fchip${funilFiltroId === "" ? " active" : ""}`}
                aria-pressed={funilFiltroId === ""}
                onClick={() => {
                  setFunilFiltroId("");
                  setEtapaFiltroId("");
                }}
              >
                Todos os funis
              </button>
              {funis.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className={`fchip${funilFiltroId === f.id ? " active" : ""}`}
                  aria-pressed={funilFiltroId === f.id}
                  onClick={() => {
                    setFunilFiltroId(f.id);
                    setEtapaFiltroId("");
                  }}
                >
                  {f.nome}
                </button>
              ))}
            </div>
            {funilFiltroSelecionado ? (
              <select
                className="input"
                style={{ width: "100%", marginTop: 8, cursor: "pointer" }}
                value={etapaFiltroId}
                onChange={(e) => setEtapaFiltroId(e.target.value)}
              >
                <option value="">Todas as etapas</option>
                {funilFiltroSelecionado.colunas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="field">
            <label>Gatilho</label>
            <div className="filters-row">
              <button
                type="button"
                className={`fchip${gatilhoFiltro === "" ? " active" : ""}`}
                aria-pressed={gatilhoFiltro === ""}
                onClick={() => setGatilhoFiltro("")}
              >
                Qualquer gatilho
              </button>
              <button
                type="button"
                className={`fchip${gatilhoFiltro === "__comentario__" ? " active" : ""}`}
                aria-pressed={gatilhoFiltro === "__comentario__"}
                onClick={() => setGatilhoFiltro("__comentario__")}
              >
                Comentário (Insta/TikTok)
              </button>
              {gatilhosDisponiveis
                .filter((g) => !TIPOS_GATILHO_COMENTARIO.includes(g.tipo))
                .map((g) => (
                  <button
                    type="button"
                    key={g.tipo}
                    className={`fchip${gatilhoFiltro === g.tipo ? " active" : ""}`}
                    aria-pressed={gatilhoFiltro === g.tipo}
                    onClick={() => setGatilhoFiltro(g.tipo)}
                  >
                    {g.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="field">
            <label>Ordenar por</label>
            <select
              className="input"
              style={{ cursor: "pointer" }}
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
            >
              {ORDENACOES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="card">
          {fluxosFiltrados.length === 0 ? (
            <p className="hint" style={{ padding: 17 }}>
              Nenhuma automação encontrada com esses filtros.
            </p>
          ) : (
            fluxosFiltrados.map((fluxo) => {
              const pill = statusPill(fluxo);
              const execs = execucoesDoFluxo(fluxo.id);
              const funilDoFluxo = funis.find((f) => f.id === fluxo.funilId);

              return (
                <div className="int-row" key={fluxo.id}>
                  <div
                    className="int-logo"
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/automacoes/editor/${fluxo.id}`)}
                    role="button"
                    aria-label={`Editar automação ${fluxo.nome}`}
                  >
                    <IconAutomacoes width={16} height={16} />
                  </div>

                  <div className="int-body">
                    {renomeandoId === fluxo.id ? (
                      <input
                        className="input"
                        autoFocus
                        style={{ width: "100%", marginBottom: 4 }}
                        value={renomeandoValor}
                        onChange={(e) => setRenomeandoValor(e.target.value)}
                        onBlur={confirmarRenomeacao}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmarRenomeacao();
                          if (e.key === "Escape") setRenomeandoId(null);
                        }}
                      />
                    ) : (
                      <p
                        className="int-title"
                        style={{ cursor: "pointer" }}
                        onClick={() => router.push(`/automacoes/editor/${fluxo.id}`)}
                      >
                        {fluxo.nome}
                      </p>
                    )}
                    <p className="int-sub">
                      {resumoGatilhoFluxo(fluxo)}
                      {funilDoFluxo ? ` · Funil: ${funilDoFluxo.nome}` : ""}
                    </p>
                    <p className="hint" style={{ marginTop: 4 }}>
                      {fluxo.execucoes} {fluxo.execucoes === 1 ? "execução" : "execuções"} · Sucesso:{" "}
                      {taxaSucesso(execs)} · {ultimaExecucao(execs)}
                    </p>
                  </div>

                  <span className={`pill${pill.on ? " on" : ""}`}>{pill.label}</span>

                  {fluxo.status === "publicado" ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Toggle
                        key={`${fluxo.id}-${fluxo.ativa}`}
                        defaultOn={fluxo.ativa}
                        label={`Ativar automação ${fluxo.nome}`}
                        onToggle={() => alternarAtivo(fluxo.id)}
                      />
                    </span>
                  ) : null}

                  <div className="dropdown-anchor">
                    <button
                      type="button"
                      className="icon-btn subtle"
                      aria-label={`Mais ações — ${fluxo.nome}`}
                      onClick={() => abrirMenu(fluxo.id)}
                    >
                      ⋯
                    </button>
                    {menuAbertoId === fluxo.id ? (
                      <>
                        <div
                          onClick={() => setMenuAbertoId(null)}
                          style={{ position: "fixed", inset: 0, zIndex: 50 }}
                        />
                        <div className="dropdown-pop dropdown-pop-right">
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              router.push(`/automacoes/editor/${fluxo.id}`);
                            }}
                          >
                            <span className="n">Editar</span>
                            <span className="r">Abre no construtor visual</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              router.push(`/automacoes/editor/${fluxo.id}`);
                            }}
                          >
                            <span className="n">Histórico</span>
                            <span className="r">Abre o construtor — o histórico de versões fica lá</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              duplicarFluxo(fluxo.id);
                              setMenuAbertoId(null);
                            }}
                          >
                            <span className="n">Duplicar</span>
                            <span className="r">Cria uma cópia em rascunho</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => iniciarRenomeacao(fluxo)}
                          >
                            <span className="n">Renomear</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            disabled={!fluxo.ativa}
                            onClick={() => {
                              arquivarFluxo(fluxo.id);
                              setMenuAbertoId(null);
                            }}
                          >
                            <span className="n">Arquivar</span>
                            <span className="r">
                              {fluxo.ativa ? "Pausa a automação sem apagar nada" : "Já está pausada"}
                            </span>
                          </button>
                          <div className="dropdown-sep" />
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => pedirExclusao(fluxo)}
                          >
                            <span className="n">Excluir</span>
                            <span className="r">Apaga a automação e o histórico de execuções</span>
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {exclusaoAlvo ? (
        <div className="flow-side-overlay" role="dialog" aria-label="Confirmar exclusão" onClick={() => setExclusaoAlvo(null)}>
          <div className="flow-side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-h">
              <h4>Excluir automação</h4>
              <button
                type="button"
                className="icon-btn subtle"
                aria-label="Cancelar"
                onClick={() => setExclusaoAlvo(null)}
              >
                ✕
              </button>
            </div>
            <div className="flow-side-body">
              <p className="n">&quot;{exclusaoAlvo.nome}&quot;</p>
              <p className="r" style={{ marginTop: 8 }}>
                Isso vai apagar a automação e todo o histórico de execuções ({execucoesDoFluxo(exclusaoAlvo.id).length}{" "}
                {execucoesDoFluxo(exclusaoAlvo.id).length === 1 ? "registro" : "registros"}). Essa ação não pode ser
                desfeita.
              </p>
            </div>
            <div className="section-foot">
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setExclusaoAlvo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn primary" style={{ flex: 1 }} onClick={confirmarExclusao}>
                Excluir mesmo assim
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
