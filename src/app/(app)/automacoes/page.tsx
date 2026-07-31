"use client";

import { Suspense, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { acoesAutomacao, automacaoIdeias, gatilhosAutomacao } from "@/lib/data";
import { useAutomacoes, type Automacao } from "@/lib/automacoes-context";
import { useFunis } from "@/lib/funis-context";
import { IconAutomacoes } from "@/components/icons";
import { Toggle, Topbar } from "@/components/ui";

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
  const [ramoForm, setRamoForm] = useState<"linear" | "condicional">("linear");
  const [acoesForm, setAcoesForm] = useState<string[]>([acoesAutomacao[0]]);
  const [condicaoPerguntaForm, setCondicaoPerguntaForm] = useState("");
  const [condicaoSeSimForm, setCondicaoSeSimForm] = useState(acoesAutomacao[0]);
  const [condicaoSeNaoForm, setCondicaoSeNaoForm] = useState(acoesAutomacao[0]);
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
    setRamoForm("linear");
    setAcoesForm(ideia === "zero" ? [acoesAutomacao[0]] : [ideia.acao]);
    setCondicaoPerguntaForm("");
    setCondicaoSeSimForm(acoesAutomacao[0]);
    setCondicaoSeNaoForm(acoesAutomacao[0]);
    setMensagemForm(ideia === "zero" ? "" : ideia.descricao);
    setAtivaForm(true);
  }

  function abrirEdicao(automacao: Automacao) {
    setEditandoId(automacao.id);
    setIdeiaEscolhida("zero");
    setConstrutorAberto(true);
    setTituloForm(automacao.titulo);
    setGatilhoForm(automacao.gatilho);
    setRamoForm(automacao.ramo);
    setAcoesForm(automacao.acoes.length ? automacao.acoes : [acoesAutomacao[0]]);
    setCondicaoPerguntaForm(automacao.condicao?.pergunta ?? "");
    setCondicaoSeSimForm(automacao.condicao?.seSim ?? acoesAutomacao[0]);
    setCondicaoSeNaoForm(automacao.condicao?.seNao ?? acoesAutomacao[0]);
    setMensagemForm(automacao.mensagem);
    setAtivaForm(automacao.ativa);
  }

  function salvarAutomacao() {
    if (!funilSelecionado) return;
    const titulo = tituloForm.trim() || "Automação sem nome";
    const dados = {
      titulo,
      gatilho: gatilhoForm,
      ramo: ramoForm,
      acoes: acoesForm,
      condicao:
        ramoForm === "condicional"
          ? {
              pergunta: condicaoPerguntaForm.trim() || "Condição sem nome",
              seSim: condicaoSeSimForm,
              seNao: condicaoSeNaoForm,
            }
          : undefined,
      mensagem: mensagemForm,
      ativa: ativaForm,
    };
    if (editandoId) {
      atualizarAutomacao(funilSelecionado.id, editandoId, dados);
    } else {
      criarAutomacao(funilSelecionado.id, dados);
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
    if (automacao.ramo === "condicional" && automacao.condicao) {
      const { pergunta, seSim, seNao } = automacao.condicao;
      return (
        <div className="auto-flow" style={{ flexWrap: "wrap" }}>
          <span className="flow-chip">{automacao.gatilho}</span>
          <span className="flow-arrow">→</span>
          <span className="flow-chip condicao">
            {pergunta.endsWith("?") ? pergunta : `${pergunta}?`}
          </span>
          <span className="flow-arrow">→</span>
          <span className="flow-chip sim">Se sim: {seSim}</span>
          <span className="flow-arrow">→</span>
          <span className="flow-chip nao">Se não: {seNao}</span>
        </div>
      );
    }
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

                <FlowEditor
                  gatilho={gatilhoForm}
                  onChangeGatilho={setGatilhoForm}
                  ramo={ramoForm}
                  onChangeRamo={setRamoForm}
                  acoes={acoesForm}
                  onChangeAcoes={setAcoesForm}
                  condicaoPergunta={condicaoPerguntaForm}
                  onChangeCondicaoPergunta={setCondicaoPerguntaForm}
                  condicaoSeSim={condicaoSeSimForm}
                  onChangeCondicaoSeSim={setCondicaoSeSimForm}
                  condicaoSeNao={condicaoSeNaoForm}
                  onChangeCondicaoSeNao={setCondicaoSeNaoForm}
                />

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

type FlowEditorProps = {
  gatilho: string;
  onChangeGatilho: (v: string) => void;
  ramo: "linear" | "condicional";
  onChangeRamo: (v: "linear" | "condicional") => void;
  acoes: string[];
  onChangeAcoes: (v: string[]) => void;
  condicaoPergunta: string;
  onChangeCondicaoPergunta: (v: string) => void;
  condicaoSeSim: string;
  onChangeCondicaoSeSim: (v: string) => void;
  condicaoSeNao: string;
  onChangeCondicaoSeNao: (v: string) => void;
};

/** Select embutido no nó, usado tanto pra gatilho quanto pra ação (troca só a lista de opções). */
function FlowNodeSelect({
  valor,
  opcoes,
  onEscolher,
}: {
  valor: string;
  opcoes: readonly string[];
  onEscolher: (v: string) => void;
}) {
  return (
    <select
      className="input"
      autoFocus
      style={{ width: "100%", cursor: "pointer" }}
      defaultValue={valor}
      onChange={(e) => onEscolher(e.target.value)}
      onBlur={() => onEscolher(valor)}
    >
      {opcoes.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Um nó do fluxograma: mostra o texto num botão; clicar abre o campo de edição (children). */
function FlowNode({
  tipo,
  texto,
  aberto,
  onAbrir,
  children,
}: {
  tipo: "gatilho" | "acao" | "condicao";
  texto: string;
  aberto: boolean;
  onAbrir: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`flow-node-box ${tipo}`}>
      {aberto ? (
        children
      ) : (
        <button type="button" className="flow-node-btn" onClick={onAbrir}>
          {texto}
        </button>
      )}
    </div>
  );
}

/**
 * Segunda visualização da mesma automação: em vez do formulário de campos,
 * mostra gatilho → ação(ões) (ou gatilho → condição → se sim/se não) como um
 * fluxograma. Cada nó, ao ser clicado, abre o mesmo campo de edição que
 * existe no formulário — é o mesmo estado, só muda como ele é mostrado.
 */
function FlowEditor({
  gatilho,
  onChangeGatilho,
  ramo,
  onChangeRamo,
  acoes,
  onChangeAcoes,
  condicaoPergunta,
  onChangeCondicaoPergunta,
  condicaoSeSim,
  onChangeCondicaoSeSim,
  condicaoSeNao,
  onChangeCondicaoSeNao,
}: FlowEditorProps) {
  const [noAberto, setNoAberto] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState(condicaoPergunta);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const arrastoRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  function fechar() {
    setNoAberto(null);
  }

  function iniciarArrasto(e: React.MouseEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("button, input, select, textarea")) return;
    arrastoRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setArrastando(true);
  }

  function moverArrasto(e: React.MouseEvent<HTMLDivElement>) {
    if (!arrastoRef.current) return;
    const dx = e.clientX - arrastoRef.current.x;
    const dy = e.clientY - arrastoRef.current.y;
    setPan({ x: arrastoRef.current.panX + dx, y: arrastoRef.current.panY + dy });
  }

  function pararArrasto() {
    arrastoRef.current = null;
    setArrastando(false);
  }

  return (
    <div className="field">
      <label>Fluxograma — clique num nó pra editar, arraste o fundo pra mover a tela</label>
      <div className="filters-row" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`fchip${ramo === "linear" ? " active" : ""}`}
          aria-pressed={ramo === "linear"}
          onClick={() => onChangeRamo("linear")}
        >
          Fluxo simples
        </button>
        <button
          type="button"
          className={`fchip${ramo === "condicional" ? " active" : ""}`}
          aria-pressed={ramo === "condicional"}
          onClick={() => onChangeRamo("condicional")}
        >
          Com condição
        </button>
        {pan.x !== 0 || pan.y !== 0 ? (
          <button
            type="button"
            className="fchip"
            onClick={() => setPan({ x: 0, y: 0 })}
          >
            ⟲ Centralizar
          </button>
        ) : null}
      </div>

      <div
        className="flow-canvas"
        style={{ cursor: arrastando ? "grabbing" : "grab" }}
        onMouseDown={iniciarArrasto}
        onMouseMove={moverArrasto}
        onMouseUp={pararArrasto}
        onMouseLeave={pararArrasto}
      >
        <div
          className="flow-col"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: arrastando ? "none" : "transform 0.12s ease-out",
          }}
        >
          <FlowNode
            tipo="gatilho"
            texto={gatilho}
            aberto={noAberto === "gatilho"}
            onAbrir={() => setNoAberto("gatilho")}
          >
            <FlowNodeSelect
              valor={gatilho}
              opcoes={gatilhosAutomacao}
              onEscolher={(v) => {
                onChangeGatilho(v);
                fechar();
              }}
            />
          </FlowNode>
          <div className="flow-connector" />

          {ramo === "linear" ? (
            <>
              {acoes.map((acao, i) => (
                <div className="flow-col" key={`${acao}-${i}`}>
                  <div style={{ position: "relative" }}>
                    <FlowNode
                      tipo="acao"
                      texto={acao}
                      aberto={noAberto === `acao-${i}`}
                      onAbrir={() => setNoAberto(`acao-${i}`)}
                    >
                      <FlowNodeSelect
                        valor={acao}
                        opcoes={acoesAutomacao}
                        onEscolher={(v) => {
                          const proximo = [...acoes];
                          proximo[i] = v;
                          onChangeAcoes(proximo);
                          fechar();
                        }}
                      />
                    </FlowNode>
                    {acoes.length > 1 ? (
                      <button
                        type="button"
                        className="flow-node-remove"
                        aria-label="Remover essa ação"
                        onClick={() =>
                          onChangeAcoes(acoes.filter((_, idx) => idx !== i))
                        }
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                  <div className="flow-connector" />
                </div>
              ))}
              <button
                type="button"
                className="btn ghost"
                onClick={() => onChangeAcoes([...acoes, acoesAutomacao[0]])}
              >
                + Adicionar ação
              </button>
            </>
          ) : (
            <>
              <FlowNode
                tipo="condicao"
                texto={(() => {
                  const base = condicaoPergunta || "Condição";
                  return base.endsWith("?") ? base : `${base}?`;
                })()}
                aberto={noAberto === "condicao"}
                onAbrir={() => {
                  setPergunta(condicaoPergunta);
                  setNoAberto("condicao");
                }}
              >
                <input
                  className="input"
                  autoFocus
                  style={{ width: "100%" }}
                  value={pergunta}
                  placeholder="Ex.: Cliente respondeu em 2h"
                  onChange={(e) => setPergunta(e.target.value)}
                  onBlur={() => {
                    onChangeCondicaoPergunta(pergunta);
                    fechar();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onChangeCondicaoPergunta(pergunta);
                      fechar();
                    }
                    if (e.key === "Escape") fechar();
                  }}
                />
              </FlowNode>
              <div className="flow-connector" />
              <div className="flow-branch-row">
                <div className="flow-branch-col">
                  <span className="flow-branch-label sim">Sim</span>
                  <FlowNode
                    tipo="acao"
                    texto={condicaoSeSim}
                    aberto={noAberto === "condicao-sim"}
                    onAbrir={() => setNoAberto("condicao-sim")}
                  >
                    <FlowNodeSelect
                      valor={condicaoSeSim}
                      opcoes={acoesAutomacao}
                      onEscolher={(v) => {
                        onChangeCondicaoSeSim(v);
                        fechar();
                      }}
                    />
                  </FlowNode>
                </div>
                <div className="flow-branch-col">
                  <span className="flow-branch-label nao">Não</span>
                  <FlowNode
                    tipo="acao"
                    texto={condicaoSeNao}
                    aberto={noAberto === "condicao-nao"}
                    onAbrir={() => setNoAberto("condicao-nao")}
                  >
                    <FlowNodeSelect
                      valor={condicaoSeNao}
                      opcoes={acoesAutomacao}
                      onEscolher={(v) => {
                        onChangeCondicaoSeNao(v);
                        fechar();
                      }}
                    />
                  </FlowNode>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
