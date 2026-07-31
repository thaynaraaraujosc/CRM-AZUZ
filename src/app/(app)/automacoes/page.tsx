"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { acoesAutomacao, automacaoIdeias, gatilhosAutomacao } from "@/lib/data";
import { useAutomacoes, type Automacao } from "@/lib/automacoes-context";
import { useFunis } from "@/lib/funis-context";
import { IconAutomacoes } from "@/components/icons";
import { ChipFilters, SegmentChips, Toggle, Topbar } from "@/components/ui";

type Ideia = (typeof automacaoIdeias)[number];
type Modelo = "lista" | "mapa-mental";

export default function AutomacoesPage() {
  return (
    <Suspense fallback={null}>
      <AutomacoesPageInner />
    </Suspense>
  );
}

function AutomacoesPageInner() {
  const searchParams = useSearchParams();
  const { funis, funilAtivoId } = useFunis();
  const {
    automacoesPorFunil,
    criarAutomacao,
    atualizarAutomacao,
    excluirAutomacao,
    alternarAtiva,
  } = useAutomacoes();

  const funilAlvoId = searchParams.get("criarPara");

  const [funilSelecionadoId, setFunilSelecionadoId] = useState(
    () => funilAlvoId ?? funilAtivoId ?? funis[0]?.id ?? "",
  );
  const funilSelecionado =
    funis.find((f) => f.id === funilSelecionadoId) ?? funis[0];
  const automacoes = funilSelecionado
    ? automacoesPorFunil[funilSelecionado.id] ?? []
    : [];
  const ativas = automacoes.filter((a) => a.ativa).length;

  const [construtorAberto, setConstrutorAberto] = useState(
    () => Boolean(funilAlvoId),
  );
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ideiaEscolhida, setIdeiaEscolhida] = useState<Ideia | "zero" | null>(
    () => (funilAlvoId ? "zero" : null),
  );
  const [modelo, setModelo] = useState<Modelo>("lista");
  const [modeloMenuAberto, setModeloMenuAberto] = useState(false);

  const [tituloForm, setTituloForm] = useState("");
  const [gatilhoForm, setGatilhoForm] = useState(gatilhosAutomacao[0]);
  const [acoesForm, setAcoesForm] = useState<string[]>([acoesAutomacao[0]]);
  const [mensagemForm, setMensagemForm] = useState("");
  const [ativaForm, setAtivaForm] = useState(true);

  function fecharConstrutor() {
    setConstrutorAberto(false);
    setIdeiaEscolhida(null);
    setEditandoId(null);
  }

  function abrirNovaAutomacao() {
    setConstrutorAberto((v) => !v);
    setIdeiaEscolhida(null);
    setEditandoId(null);
  }

  function escolherIdeia(ideia: Ideia | "zero") {
    setIdeiaEscolhida(ideia);
    setTituloForm(ideia === "zero" ? "" : ideia.titulo);
    setGatilhoForm(ideia === "zero" ? gatilhosAutomacao[0] : ideia.gatilho);
    setAcoesForm(ideia === "zero" ? [acoesAutomacao[0]] : [ideia.acao]);
    setMensagemForm(ideia === "zero" ? "" : ideia.descricao);
    setAtivaForm(true);
  }

  function abrirEdicao(automacao: Automacao) {
    setEditandoId(automacao.id);
    setIdeiaEscolhida("zero");
    setConstrutorAberto(true);
    setTituloForm(automacao.titulo);
    setGatilhoForm(automacao.gatilho);
    setAcoesForm(automacao.acoes.length ? automacao.acoes : [acoesAutomacao[0]]);
    setMensagemForm(automacao.mensagem);
    setAtivaForm(automacao.ativa);
  }

  function salvarAutomacao() {
    if (!funilSelecionado) return;
    const titulo = tituloForm.trim() || "Automação sem nome";
    if (editandoId) {
      atualizarAutomacao(funilSelecionado.id, editandoId, {
        titulo,
        gatilho: gatilhoForm,
        acoes: acoesForm,
        mensagem: mensagemForm,
        ativa: ativaForm,
      });
    } else {
      criarAutomacao(funilSelecionado.id, {
        titulo,
        gatilho: gatilhoForm,
        acoes: acoesForm,
        mensagem: mensagemForm,
        ativa: ativaForm,
      });
    }
    fecharConstrutor();
  }

  function pedirExclusao(automacao: Automacao) {
    if (!funilSelecionado) return;
    if (
      window.confirm(`Excluir a automação "${automacao.titulo}"?`)
    ) {
      excluirAutomacao(funilSelecionado.id, automacao.id);
      if (editandoId === automacao.id) fecharConstrutor();
    }
  }

  function renderFluxo(automacao: Automacao) {
    const passos = [automacao.gatilho, ...automacao.acoes];
    return (
      <div className="auto-flow">
        {passos.map((passo, i) => (
          <span key={`${passo}-${i}`} style={{ display: "contents" }}>
            {i > 0 ? <span className="flow-arrow">→</span> : null}
            <span className="flow-chip">{passo}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <>
      <Topbar
        title="Automações"
        sub={`${automacoes.length} automações · ${ativas} ativas — ${funilSelecionado?.nome ?? ""}`}
        actions={
          <>
            <div className="dropdown-anchor">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setModeloMenuAberto((v) => !v)}
              >
                Modelo de automação
              </button>
              {modeloMenuAberto ? (
                <>
                  <div
                    onClick={() => setModeloMenuAberto(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 50 }}
                  />
                  <div className="dropdown-pop">
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setModelo("lista");
                        setModeloMenuAberto(false);
                      }}
                    >
                      <span className="n">
                        Modelo lista {modelo === "lista" ? "✓" : ""}
                      </span>
                      <span className="r">Uma linha por automação</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setModelo("mapa-mental");
                        setModeloMenuAberto(false);
                      }}
                    >
                      <span className="n">
                        Modelo mapa mental {modelo === "mapa-mental" ? "✓" : ""}
                      </span>
                      <span className="r">
                        Todas as automações ligadas num diagrama só
                      </span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={abrirNovaAutomacao}
            >
              {construtorAberto && !editandoId ? "Cancelar" : "+ Nova automação"}
            </button>
          </>
        }
      />

      <div className="content">
        <div className="filters-row mb14">
          {funis.map((f) => (
            <button
              type="button"
              key={f.id}
              className={`fchip${f.id === funilSelecionadoId ? " active" : ""}`}
              aria-pressed={f.id === funilSelecionadoId}
              onClick={() => {
                setFunilSelecionadoId(f.id);
                fecharConstrutor();
              }}
            >
              {f.nome}
            </button>
          ))}
        </div>

        {construtorAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">
                  {editandoId ? "Editar automação" : "Nova automação"}
                </p>
                <p className="s">
                  {funilAlvoId && !editandoId
                    ? `Automação específica pro funil "${funilSelecionado?.nome}"`
                    : `Vale só pro funil "${funilSelecionado?.nome}"`}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={fecharConstrutor}
              >
                Fechar ✕
              </span>
            </div>

            {ideiaEscolhida === null ? (
              <div className="media-picker" style={{ flexWrap: "wrap" }}>
                {automacaoIdeias.map((ideia) => (
                  <button
                    type="button"
                    key={ideia.titulo}
                    className="media-opt"
                    style={{ flex: "1 1 220px", textAlign: "left" }}
                    onClick={() => escolherIdeia(ideia)}
                  >
                    <IconAutomacoes />
                    <span className="l" style={{ display: "block" }}>
                      {ideia.titulo}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "var(--text-faint)",
                        fontWeight: 500,
                        marginTop: 4,
                      }}
                    >
                      {ideia.descricao}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="media-opt"
                  style={{ flex: "1 1 220px", textAlign: "left" }}
                  onClick={() => escolherIdeia("zero")}
                >
                  <IconAutomacoes />
                  <span className="l" style={{ display: "block" }}>
                    Criar do zero
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--text-faint)",
                      fontWeight: 500,
                      marginTop: 4,
                    }}
                  >
                    Você escolhe o gatilho e a ação, do início.
                  </span>
                </button>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Nome da automação</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={tituloForm}
                    onChange={(e) => setTituloForm(e.target.value)}
                    placeholder="Ex.: Lead novo → mensagem de boas-vindas"
                  />
                </div>
                <div className="field">
                  <label>Gatilho — quando disparar</label>
                  <ChipFilters
                    options={gatilhosAutomacao}
                    initial={gatilhosAutomacao.indexOf(gatilhoForm)}
                    onChange={(g) => setGatilhoForm(g)}
                  />
                </div>
                <div className="field">
                  <label>
                    Ação — o que fazer (pode acrescentar ou retirar mais de uma)
                  </label>
                  <SegmentChips
                    options={acoesAutomacao.map((a) => ({
                      label: a,
                      ativo: acoesForm.includes(a),
                    }))}
                    onChange={(selecionadas) => setAcoesForm(selecionadas)}
                  />
                </div>
                <div className="field">
                  <label>Mensagem ou observação (opcional)</label>
                  <textarea
                    className="input"
                    style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                    placeholder="Ex.: Oi! Recebemos sua mensagem, já já alguém te responde por aqui 💙"
                    value={mensagemForm}
                    onChange={(e) => setMensagemForm(e.target.value)}
                  />
                </div>
                <div className="toggle-row">
                  <span className="tl">
                    {editandoId ? "Automação ativa" : "Ativar assim que criar"}
                  </span>
                  <Toggle
                    key={editandoId ?? "nova"}
                    defaultOn={ativaForm}
                    label="Automação ativa"
                  />
                </div>
                <div className="section-foot">
                  {editandoId ? (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ flex: 1 }}
                      onClick={() => {
                        const automacao = automacoes.find(
                          (a) => a.id === editandoId,
                        );
                        if (automacao) pedirExclusao(automacao);
                      }}
                    >
                      Excluir automação
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ flex: 1 }}
                      onClick={() => setIdeiaEscolhida(null)}
                    >
                      ← Escolher outra ideia
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn primary"
                    style={{ flex: 1 }}
                    onClick={salvarAutomacao}
                  >
                    {editandoId ? "Salvar alterações" : "Salvar automação"}
                  </button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {automacoes.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <p className="hint">
              Nenhuma automação ainda em {funilSelecionado?.nome ?? "esse funil"}
              . Clique em &quot;+ Nova automação&quot; pra criar a primeira.
            </p>
          </div>
        ) : modelo === "lista" ? (
          <div className="card">
            {automacoes.map((automacao) => (
              <div
                className="auto-row"
                key={automacao.id}
                onClick={() => abrirEdicao(automacao)}
                style={{ cursor: "pointer" }}
              >
                <div className="auto-icon">
                  <IconAutomacoes />
                </div>
                <div className="auto-body">
                  <p className="auto-title">{automacao.titulo}</p>
                  {renderFluxo(automacao)}
                </div>
                <span className="auto-stat">{automacao.execucoes}</span>
                <span
                  role="button"
                  aria-label={`Excluir automação ${automacao.titulo}`}
                  title="Excluir automação"
                  style={{ cursor: "pointer", color: "var(--text-faint)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    pedirExclusao(automacao);
                  }}
                >
                  ✕
                </span>
                <span onClick={(e) => e.stopPropagation()}>
                  <Toggle
                    defaultOn={automacao.ativa}
                    label={automacao.titulo}
                    onToggle={() =>
                      funilSelecionado &&
                      alternarAtiva(funilSelecionado.id, automacao.id)
                    }
                  />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mindmap">
            <div className="mindmap-root">
              <IconAutomacoes width={18} height={18} />
              {funilSelecionado?.nome ?? "Automações"}
            </div>
            <div className="mindmap-branches">
              {automacoes.map((automacao) => (
                <div className="mindmap-branch" key={automacao.id}>
                  <div
                    className="mindmap-node"
                    onClick={() => abrirEdicao(automacao)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="auto-row" style={{ padding: 0, border: 0 }}>
                      <div className="auto-body">
                        <p className="auto-title">{automacao.titulo}</p>
                        {renderFluxo(automacao)}
                      </div>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Toggle
                          defaultOn={automacao.ativa}
                          label={automacao.titulo}
                          onToggle={() =>
                            funilSelecionado &&
                            alternarAtiva(funilSelecionado.id, automacao.id)
                          }
                        />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
