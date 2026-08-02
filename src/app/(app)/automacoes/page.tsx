"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  CANAIS_COMENTARIO,
  COMPORTAMENTO_FORA_JANELA,
  DIAS_SEMANA,
  DIAS_SEMANA_TODOS,
  GATILHOS_ETAPA,
  LIMITES_EXECUCAO,
  ORIGENS,
  TIPOS_ACAO_AUTOMACAO,
  UNIDADES_TEMPO,
  type CanalComentario,
  type DiaSemana,
  type Origem,
  type TipoAcaoAutomacao,
  type TipoGatilhoEtapa,
} from "@/lib/data";
import {
  useAutomacoes,
  type AcaoAutomacao,
  type Automacao,
  type ComportamentoForaJanela,
  type LimiteExecucao,
  type RegraComentario,
} from "@/lib/automacoes-context";
import { useFunis } from "@/lib/funis-context";
import { IconAutomacoes } from "@/components/icons";
import { Toggle, Topbar } from "@/components/ui";

const ICONE_ACAO: Record<TipoAcaoAutomacao, string> = {
  mensagem: "💬",
  mensagem_interativa: "🔀",
  documento: "📄",
  audio: "🎙",
  lembrete: "⏰",
  tarefa: "✅",
  mover_funil: "↪",
  adicionar_etiqueta: "🏷",
  remover_etiqueta: "🚫",
  webhook: "🔗",
};

function novaAcao(tipo: TipoAcaoAutomacao = "mensagem"): AcaoAutomacao {
  const base: AcaoAutomacao = { id: `acao-${Date.now()}-${Math.random()}`, tipo };
  if (tipo === "mensagem_interativa") {
    base.opcoes = [{ id: `op-${Date.now()}`, rotulo: "1 · Sim" }];
  }
  if (tipo === "lembrete" || tipo === "tarefa") {
    base.tempoValor = "1";
    base.tempoUnidade = "dias";
  }
  return base;
}

function labelGatilho(tipo: TipoGatilhoEtapa) {
  return GATILHOS_ETAPA.find((g) => g.tipo === tipo)?.label ?? tipo;
}

function resumoGatilho(automacao: Automacao) {
  const base = labelGatilho(automacao.gatilhoTipo);
  if (automacao.gatilhoTipo === "parado" && automacao.tempoValor) {
    return `${base} — ${automacao.tempoValor} ${automacao.tempoUnidade ?? "horas"}`;
  }
  return base;
}

function resumoJanela(automacao: Automacao) {
  const dias = automacao.diasAtivos ?? DIAS_SEMANA_TODOS;
  const partes: string[] = [];
  if (dias.length < DIAS_SEMANA_TODOS.length) {
    partes.push(
      dias
        .map((d) => DIAS_SEMANA.find((ds) => ds.valor === d)?.label ?? d)
        .join(", "),
    );
  }
  if (automacao.usarHorario && automacao.horarioInicio && automacao.horarioFim) {
    partes.push(`${automacao.horarioInicio}–${automacao.horarioFim}`);
  }
  return partes.length ? partes.join(" · ") : null;
}

export default function AutomacoesPage() {
  return (
    <Suspense fallback={null}>
      <AutomacoesPageInner />
    </Suspense>
  );
}

function AutomacoesPageInner() {
  const searchParams = useSearchParams();
  const { funis } = useFunis();
  const {
    automacoesDaEtapa,
    criarAutomacao,
    atualizarAutomacao,
    excluirAutomacao,
    alternarAtiva,
    regrasComentario,
    criarRegraComentario,
    atualizarRegraComentario,
    excluirRegraComentario,
    alternarRegraComentarioAtiva,
  } = useAutomacoes();

  const funilParam = searchParams.get("funil");
  const etapaParam = searchParams.get("etapa");
  const criarParam = searchParams.get("criar") === "1";

  const [funilSelecionadoId, setFunilSelecionadoId] = useState(
    () => funilParam ?? funis[0]?.id ?? "",
  );
  const funilSelecionado =
    funis.find((f) => f.id === funilSelecionadoId) ?? funis[0];

  const totalAutomacoes =
    funilSelecionado?.colunas.reduce(
      (soma, c) => soma + automacoesDaEtapa(funilSelecionado.id, c.id).length,
      0,
    ) ?? 0;
  const totalAtivas =
    funilSelecionado?.colunas.reduce(
      (soma, c) =>
        soma +
        automacoesDaEtapa(funilSelecionado.id, c.id).filter((a) => a.ativa)
          .length,
      0,
    ) ?? 0;

  const [editorAberto, setEditorAberto] = useState(() => criarParam);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [etapaAlvo, setEtapaAlvo] = useState<{ id: string; titulo: string } | null>(
    () => {
      if (!criarParam || !etapaParam || !funilSelecionado) return null;
      const etapa = funilSelecionado.colunas.find((c) => c.id === etapaParam);
      return etapa ? { id: etapa.id, titulo: etapa.titulo } : null;
    },
  );

  const [tituloForm, setTituloForm] = useState("");
  const [gatilhoForm, setGatilhoForm] = useState<TipoGatilhoEtapa>("entrou");
  const [tempoValorForm, setTempoValorForm] = useState("2");
  const [tempoUnidadeForm, setTempoUnidadeForm] = useState<string>("horas");
  const [acoesForm, setAcoesForm] = useState<AcaoAutomacao[]>([novaAcao()]);
  const [ativaForm, setAtivaForm] = useState(true);

  const [diasAtivosForm, setDiasAtivosForm] =
    useState<DiaSemana[]>(DIAS_SEMANA_TODOS);
  const [usarHorarioForm, setUsarHorarioForm] = useState(false);
  const [horarioInicioForm, setHorarioInicioForm] = useState("08:00");
  const [horarioFimForm, setHorarioFimForm] = useState("20:00");
  const [foraDaJanelaForm, setForaDaJanelaForm] =
    useState<ComportamentoForaJanela>("aguardar");
  const [condicaoOrigemForm, setCondicaoOrigemForm] = useState<Origem | "">("");
  const [condicaoValorMinimoForm, setCondicaoValorMinimoForm] = useState("");
  const [limiteExecucaoForm, setLimiteExecucaoForm] =
    useState<LimiteExecucao>("sempre");

  const gatilhoPrecisaTempo = GATILHOS_ETAPA.find(
    (g) => g.tipo === gatilhoForm,
  )?.precisaTempo;
  const gatilhoEhAgendado = gatilhoForm === "agendado";

  function alternarDiaAtivo(dia: DiaSemana) {
    setDiasAtivosForm((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia],
    );
  }

  function fecharEditor() {
    setEditorAberto(false);
    setEditandoId(null);
    setEtapaAlvo(null);
  }

  function abrirNovaAutomacao(etapaId: string, etapaTitulo: string) {
    setEditandoId(null);
    setEtapaAlvo({ id: etapaId, titulo: etapaTitulo });
    setTituloForm("");
    setGatilhoForm("entrou");
    setTempoValorForm("2");
    setTempoUnidadeForm("horas");
    setAcoesForm([novaAcao()]);
    setAtivaForm(true);
    setDiasAtivosForm(DIAS_SEMANA_TODOS);
    setUsarHorarioForm(false);
    setHorarioInicioForm("08:00");
    setHorarioFimForm("20:00");
    setForaDaJanelaForm("aguardar");
    setCondicaoOrigemForm("");
    setCondicaoValorMinimoForm("");
    setLimiteExecucaoForm("sempre");
    setEditorAberto(true);
  }

  function abrirEdicao(automacao: Automacao, etapaTitulo: string) {
    setEditandoId(automacao.id);
    setEtapaAlvo({ id: automacao.etapaId, titulo: etapaTitulo });
    setTituloForm(automacao.titulo);
    setGatilhoForm(automacao.gatilhoTipo);
    setTempoValorForm(automacao.tempoValor ?? "2");
    setTempoUnidadeForm(automacao.tempoUnidade ?? "horas");
    setAcoesForm(automacao.acoes.length ? automacao.acoes : [novaAcao()]);
    setAtivaForm(automacao.ativa);
    setDiasAtivosForm(automacao.diasAtivos ?? DIAS_SEMANA_TODOS);
    setUsarHorarioForm(automacao.usarHorario ?? false);
    setHorarioInicioForm(automacao.horarioInicio ?? "08:00");
    setHorarioFimForm(automacao.horarioFim ?? "20:00");
    setForaDaJanelaForm(automacao.foraDaJanela ?? "aguardar");
    setCondicaoOrigemForm(automacao.condicaoOrigem ?? "");
    setCondicaoValorMinimoForm(automacao.condicaoValorMinimo ?? "");
    setLimiteExecucaoForm(automacao.limiteExecucao ?? "sempre");
    setEditorAberto(true);
  }

  function atualizarAcao(index: number, patch: Partial<AcaoAutomacao>) {
    setAcoesForm((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );
  }

  function trocarTipoAcao(index: number, tipo: TipoAcaoAutomacao) {
    setAcoesForm((prev) => prev.map((a, i) => (i === index ? novaAcao(tipo) : a)));
  }

  function adicionarAcao() {
    setAcoesForm((prev) => [...prev, novaAcao()]);
  }

  function removerAcao(index: number) {
    setAcoesForm((prev) => prev.filter((_, i) => i !== index));
  }

  function adicionarOpcao(index: number) {
    setAcoesForm((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        const opcoes = a.opcoes ?? [];
        return {
          ...a,
          opcoes: [
            ...opcoes,
            { id: `op-${Date.now()}`, rotulo: `${opcoes.length + 1} · ` },
          ],
        };
      }),
    );
  }

  function removerOpcao(index: number, opcaoId: string) {
    setAcoesForm((prev) =>
      prev.map((a, i) =>
        i === index
          ? { ...a, opcoes: (a.opcoes ?? []).filter((o) => o.id !== opcaoId) }
          : a,
      ),
    );
  }

  function salvarAutomacao() {
    if (!funilSelecionado || !etapaAlvo) return;
    const titulo = tituloForm.trim() || "Automação sem nome";
    const dados = {
      funilId: funilSelecionado.id,
      etapaId: etapaAlvo.id,
      titulo,
      gatilhoTipo: gatilhoForm,
      tempoValor: gatilhoPrecisaTempo ? tempoValorForm : undefined,
      tempoUnidade: gatilhoPrecisaTempo ? tempoUnidadeForm : undefined,
      acoes: acoesForm,
      ativa: ativaForm,
      diasAtivos: diasAtivosForm,
      usarHorario: gatilhoEhAgendado ? true : usarHorarioForm,
      horarioInicio: usarHorarioForm || gatilhoEhAgendado ? horarioInicioForm : undefined,
      horarioFim: usarHorarioForm || gatilhoEhAgendado ? horarioFimForm : undefined,
      foraDaJanela: foraDaJanelaForm,
      condicaoOrigem: condicaoOrigemForm || undefined,
      condicaoValorMinimo: condicaoValorMinimoForm.trim() || undefined,
      limiteExecucao: limiteExecucaoForm,
    };
    if (editandoId) {
      atualizarAutomacao(editandoId, dados);
    } else {
      criarAutomacao(dados);
    }
    fecharEditor();
  }

  function pedirExclusao(automacao: Automacao) {
    if (window.confirm(`Excluir a automação "${automacao.titulo}"?`)) {
      excluirAutomacao(automacao.id);
      if (editandoId === automacao.id) fecharEditor();
    }
  }

  const [regraEditorAberto, setRegraEditorAberto] = useState(false);
  const [regraEditandoId, setRegraEditandoId] = useState<string | null>(null);
  const [canalRegraForm, setCanalRegraForm] = useState<CanalComentario>(
    CANAIS_COMENTARIO[0],
  );
  const [palavraChaveForm, setPalavraChaveForm] = useState("");
  const [mensagemDirectForm, setMensagemDirectForm] = useState("");
  const [ativaRegraForm, setAtivaRegraForm] = useState(true);
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const [proximoToastId, setProximoToastId] = useState(0);

  function avisar(texto: string) {
    const id = `toast-${proximoToastId}`;
    setProximoToastId((v) => v + 1);
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  function fecharRegraEditor() {
    setRegraEditorAberto(false);
    setRegraEditandoId(null);
  }

  function abrirNovaRegra() {
    setRegraEditandoId(null);
    setCanalRegraForm(CANAIS_COMENTARIO[0]);
    setPalavraChaveForm("");
    setMensagemDirectForm("");
    setAtivaRegraForm(true);
    setRegraEditorAberto(true);
  }

  function abrirEdicaoRegra(regra: RegraComentario) {
    setRegraEditandoId(regra.id);
    setCanalRegraForm(regra.canal);
    setPalavraChaveForm(regra.palavraChave);
    setMensagemDirectForm(regra.mensagemDirect);
    setAtivaRegraForm(regra.ativa);
    setRegraEditorAberto(true);
  }

  function salvarRegra() {
    const palavraChave = palavraChaveForm.trim().toUpperCase();
    if (!palavraChave) return;
    const dados = {
      canal: canalRegraForm,
      palavraChave,
      mensagemDirect: mensagemDirectForm,
      ativa: ativaRegraForm,
    };
    if (regraEditandoId) {
      atualizarRegraComentario(regraEditandoId, dados);
    } else {
      criarRegraComentario(dados);
    }
    fecharRegraEditor();
  }

  function pedirExclusaoRegra(regra: RegraComentario) {
    if (
      window.confirm(
        `Excluir a regra de comentário "${regra.palavraChave}" (${regra.canal})?`,
      )
    ) {
      excluirRegraComentario(regra.id);
      if (regraEditandoId === regra.id) fecharRegraEditor();
    }
  }

  function testarRegra(regra: RegraComentario) {
    avisar(
      `Alguém comentou "${regra.palavraChave}" num post do ${regra.canal} → direct enviado automaticamente`,
    );
  }

  return (
    <>
      <Topbar
        title="Automações"
        sub={`${totalAutomacoes} automações · ${totalAtivas} ativas — ${funilSelecionado?.nome ?? ""}`}
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
                fecharEditor();
              }}
            >
              {f.nome}
            </button>
          ))}
        </div>

        <p className="hint mb14">
          Cada etapa do funil tem seu próprio quadro de automações — clique em
          &quot;+ Nova automação&quot; dentro da coluna pra criar uma ligada
          àquela etapa
          {funilSelecionado?.responsavel
            ? `, atendida por ${funilSelecionado.responsavel}`
            : ""}
          .
        </p>

        {editorAberto && etapaAlvo ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">
                  {editandoId ? "Editar automação" : "Nova automação"}
                </p>
                <p className="s">
                  Funil &quot;{funilSelecionado?.nome}&quot; · Etapa &quot;
                  {etapaAlvo.titulo}&quot;
                  {funilSelecionado?.responsavel
                    ? ` · atendente: ${funilSelecionado.responsavel}`
                    : ""}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={fecharEditor}
              >
                Fechar ✕
              </span>
            </div>

            <div className="field">
              <label>Nome da automação</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={tituloForm}
                onChange={(e) => setTituloForm(e.target.value)}
                placeholder="Ex.: Boas-vindas pro lead novo"
              />
            </div>

            <div className="field">
              <label>Gatilho — o que dispara essa automação</label>
              <div className="filters-row">
                {GATILHOS_ETAPA.map((g) => (
                  <button
                    type="button"
                    key={g.tipo}
                    className={`fchip${gatilhoForm === g.tipo ? " active" : ""}`}
                    aria-pressed={gatilhoForm === g.tipo}
                    onClick={() => setGatilhoForm(g.tipo)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {gatilhoPrecisaTempo ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    style={{ width: 80 }}
                    value={tempoValorForm}
                    onChange={(e) => setTempoValorForm(e.target.value)}
                  />
                  <select
                    className="input"
                    style={{ cursor: "pointer" }}
                    value={tempoUnidadeForm}
                    onChange={(e) => setTempoUnidadeForm(e.target.value)}
                  >
                    {UNIDADES_TEMPO.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="field">
              <label>
                Janela de atividade — em quais dias e horários ela pode disparar
              </label>
              <div className="filters-row">
                {DIAS_SEMANA.map((d) => (
                  <button
                    type="button"
                    key={d.valor}
                    className={`fchip${diasAtivosForm.includes(d.valor) ? " active" : ""}`}
                    aria-pressed={diasAtivosForm.includes(d.valor)}
                    onClick={() => alternarDiaAtivo(d.valor)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {gatilhoEhAgendado ? (
                <p className="hint" style={{ marginTop: 6 }}>
                  Esse gatilho é recorrente — ela dispara nos dias e no horário
                  definidos aqui, pros cards que estiverem na etapa.
                </p>
              ) : null}

              {!gatilhoEhAgendado ? (
                <div className="toggle-row" style={{ marginTop: 8 }}>
                  <span className="tl">Restringir a um horário do dia</span>
                  <Toggle
                    key={`${editandoId ?? "nova"}-horario`}
                    defaultOn={usarHorarioForm}
                    label="Restringir a um horário do dia"
                    onToggle={setUsarHorarioForm}
                  />
                </div>
              ) : null}

              {usarHorarioForm || gatilhoEhAgendado ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <input
                    className="input"
                    type="time"
                    value={horarioInicioForm}
                    onChange={(e) => setHorarioInicioForm(e.target.value)}
                  />
                  <span className="hint">até</span>
                  <input
                    className="input"
                    type="time"
                    value={horarioFimForm}
                    onChange={(e) => setHorarioFimForm(e.target.value)}
                  />
                </div>
              ) : null}

              {diasAtivosForm.length < DIAS_SEMANA_TODOS.length || usarHorarioForm || gatilhoEhAgendado ? (
                <div style={{ marginTop: 8 }}>
                  <label className="hint" style={{ display: "block", marginBottom: 6 }}>
                    Se o gatilho acontecer fora da janela
                  </label>
                  <select
                    className="input"
                    style={{ cursor: "pointer" }}
                    value={foraDaJanelaForm}
                    onChange={(e) =>
                      setForaDaJanelaForm(e.target.value as ComportamentoForaJanela)
                    }
                  >
                    {COMPORTAMENTO_FORA_JANELA.map((op) => (
                      <option key={op.valor} value={op.valor}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="field">
              <label>Condições — só dispara se o card bater com isso (opcional)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="input"
                  style={{ flex: 1, cursor: "pointer" }}
                  value={condicaoOrigemForm}
                  onChange={(e) => setCondicaoOrigemForm(e.target.value as Origem | "")}
                >
                  <option value="">Qualquer origem</option>
                  {ORIGENS.map((o) => (
                    <option key={o} value={o}>
                      Origem: {o}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  type="text"
                  placeholder="Valor mínimo do negócio (ex.: 500)"
                  value={condicaoValorMinimoForm}
                  onChange={(e) => setCondicaoValorMinimoForm(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Limite de disparo</label>
              <select
                className="input"
                style={{ cursor: "pointer" }}
                value={limiteExecucaoForm}
                onChange={(e) => setLimiteExecucaoForm(e.target.value as LimiteExecucao)}
              >
                {LIMITES_EXECUCAO.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Ações — o que ela faz (pode ter mais de uma)</label>
              {acoesForm.map((acao, i) => (
                <div className="auto-acao-row" key={acao.id}>
                  <div className="auto-acao-row-h">
                    <span className="auto-acao-icone">{ICONE_ACAO[acao.tipo]}</span>
                    <select
                      className="input"
                      style={{ flex: 1, cursor: "pointer" }}
                      value={acao.tipo}
                      onChange={(e) =>
                        trocarTipoAcao(i, e.target.value as TipoAcaoAutomacao)
                      }
                    >
                      {TIPOS_ACAO_AUTOMACAO.map((t) => (
                        <option key={t.tipo} value={t.tipo}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {acoesForm.length > 1 ? (
                      <button
                        type="button"
                        className="remove-chip"
                        aria-label="Remover essa ação"
                        onClick={() => removerAcao(i)}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>

                  {acao.tipo === "mensagem" || acao.tipo === "mensagem_interativa" ? (
                    <textarea
                      className="input"
                      style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                      placeholder="Ex.: Oi! Recebemos sua mensagem 💙"
                      value={acao.mensagem ?? ""}
                      onChange={(e) => atualizarAcao(i, { mensagem: e.target.value })}
                    />
                  ) : null}

                  {acao.tipo === "mensagem_interativa" ? (
                    <div style={{ marginTop: 8 }}>
                      <p className="hint" style={{ marginBottom: 6 }}>
                        Opções de resposta — a pessoa escolhe uma
                      </p>
                      {(acao.opcoes ?? []).map((op) => (
                        <div
                          key={op.id}
                          style={{ display: "flex", gap: 6, marginBottom: 6 }}
                        >
                          <input
                            className="input"
                            style={{ flex: 1 }}
                            value={op.rotulo}
                            onChange={(e) =>
                              atualizarAcao(i, {
                                opcoes: (acao.opcoes ?? []).map((o) =>
                                  o.id === op.id
                                    ? { ...o, rotulo: e.target.value }
                                    : o,
                                ),
                              })
                            }
                          />
                          {(acao.opcoes ?? []).length > 1 ? (
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => removerOpcao(i, op.id)}
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => adicionarOpcao(i)}
                      >
                        + Adicionar opção
                      </button>
                    </div>
                  ) : null}

                  {acao.tipo === "documento" || acao.tipo === "audio" ? (
                    <div style={{ marginTop: 8 }}>
                      <input
                        className="input"
                        type="file"
                        accept={acao.tipo === "audio" ? "audio/*" : undefined}
                        onChange={(e) =>
                          atualizarAcao(i, {
                            arquivoNome: e.target.files?.[0]?.name,
                          })
                        }
                      />
                      {acao.arquivoNome ? (
                        <p className="hint" style={{ marginTop: 6 }}>
                          {acao.arquivoNome}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {acao.tipo === "lembrete" ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        className="input"
                        style={{ width: "100%", minHeight: 50, resize: "vertical" }}
                        placeholder="O que lembrar — ex.: confirmar presença na consulta"
                        value={acao.mensagem ?? ""}
                        onChange={(e) =>
                          atualizarAcao(i, { mensagem: e.target.value })
                        }
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <span className="hint" style={{ alignSelf: "center" }}>
                          Lembrar em
                        </span>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          style={{ width: 70 }}
                          value={acao.tempoValor ?? "1"}
                          onChange={(e) =>
                            atualizarAcao(i, { tempoValor: e.target.value })
                          }
                        />
                        <select
                          className="input"
                          style={{ cursor: "pointer" }}
                          value={acao.tempoUnidade ?? "dias"}
                          onChange={(e) =>
                            atualizarAcao(i, { tempoUnidade: e.target.value })
                          }
                        >
                          {UNIDADES_TEMPO.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}

                  {acao.tipo === "mover_funil" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <select
                        className="input"
                        style={{ flex: 1, cursor: "pointer" }}
                        value={acao.moverFunilId ?? ""}
                        onChange={(e) =>
                          atualizarAcao(i, {
                            moverFunilId: e.target.value,
                            moverEtapaTitulo:
                              funis
                                .find((f) => f.id === e.target.value)
                                ?.colunas[0]?.titulo ?? "",
                          })
                        }
                      >
                        <option value="">Escolha o funil</option>
                        {funis
                          .filter((f) => f.id !== funilSelecionado?.id)
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nome}
                            </option>
                          ))}
                      </select>
                      <select
                        className="input"
                        style={{ flex: 1, cursor: "pointer" }}
                        value={acao.moverEtapaTitulo ?? ""}
                        onChange={(e) =>
                          atualizarAcao(i, { moverEtapaTitulo: e.target.value })
                        }
                        disabled={!acao.moverFunilId}
                      >
                        {(
                          funis.find((f) => f.id === acao.moverFunilId)
                            ?.colunas ?? []
                        ).map((c) => (
                          <option key={c.id} value={c.titulo}>
                            {c.titulo}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {acao.tipo === "tarefa" ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        className="input"
                        style={{ width: "100%", minHeight: 50, resize: "vertical" }}
                        placeholder="O que precisa ser feito — ex.: ligar pra confirmar interesse"
                        value={acao.mensagem ?? ""}
                        onChange={(e) =>
                          atualizarAcao(i, { mensagem: e.target.value })
                        }
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <span className="hint" style={{ alignSelf: "center" }}>
                          Prazo em
                        </span>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          style={{ width: 70 }}
                          value={acao.tempoValor ?? "1"}
                          onChange={(e) =>
                            atualizarAcao(i, { tempoValor: e.target.value })
                          }
                        />
                        <select
                          className="input"
                          style={{ cursor: "pointer" }}
                          value={acao.tempoUnidade ?? "dias"}
                          onChange={(e) =>
                            atualizarAcao(i, { tempoUnidade: e.target.value })
                          }
                        >
                          {UNIDADES_TEMPO.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}

                  {acao.tipo === "adicionar_etiqueta" ||
                  acao.tipo === "remover_etiqueta" ? (
                    <input
                      className="input"
                      style={{ width: "100%", marginTop: 8 }}
                      type="text"
                      placeholder="Nome da etiqueta — ex.: Quente"
                      value={acao.etiquetaNome ?? ""}
                      onChange={(e) =>
                        atualizarAcao(i, { etiquetaNome: e.target.value })
                      }
                    />
                  ) : null}

                  {acao.tipo === "webhook" ? (
                    <input
                      className="input"
                      style={{ width: "100%", marginTop: 8 }}
                      type="url"
                      placeholder="https://sua-ferramenta.com/webhook"
                      value={acao.webhookUrl ?? ""}
                      onChange={(e) =>
                        atualizarAcao(i, { webhookUrl: e.target.value })
                      }
                    />
                  ) : null}

                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <span className="hint">Esperar antes de executar</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      style={{ width: 70 }}
                      placeholder="0"
                      value={acao.atrasoValor ?? ""}
                      onChange={(e) =>
                        atualizarAcao(i, { atrasoValor: e.target.value })
                      }
                    />
                    <select
                      className="input"
                      style={{ cursor: "pointer" }}
                      value={acao.atrasoUnidade ?? "minutos"}
                      onChange={(e) =>
                        atualizarAcao(i, { atrasoUnidade: e.target.value })
                      }
                    >
                      {UNIDADES_TEMPO.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button type="button" className="btn ghost" onClick={adicionarAcao}>
                + Adicionar ação
              </button>
            </div>

            <div className="toggle-row">
              <span className="tl">
                {editandoId ? "Automação ativa" : "Ativar assim que criar"}
              </span>
              <Toggle
                key={editandoId ?? "nova"}
                defaultOn={ativaForm}
                label="Automação ativa"
                onToggle={setAtivaForm}
              />
            </div>

            <div className="section-foot">
              {editandoId ? (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ flex: 1 }}
                  onClick={() => {
                    if (!funilSelecionado || !etapaAlvo) return;
                    const automacao = automacoesDaEtapa(
                      funilSelecionado.id,
                      etapaAlvo.id,
                    ).find((a) => a.id === editandoId);
                    if (automacao) pedirExclusao(automacao);
                  }}
                >
                  Excluir automação
                </button>
              ) : null}
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={salvarAutomacao}
              >
                {editandoId ? "Salvar alterações" : "Salvar automação"}
              </button>
            </div>
          </section>
        ) : null}

        <div className="kanban">
          {funilSelecionado?.colunas.map((coluna) => {
            const automacoesEtapa = automacoesDaEtapa(
              funilSelecionado.id,
              coluna.id,
            );
            return (
              <div key={coluna.id} style={{ minHeight: 60 }}>
                <div className="kcol-h">
                  <span className="t">
                    <span className="dot" />
                    {coluna.titulo}
                  </span>
                  <span className="c">{automacoesEtapa.length}</span>
                </div>
                <button
                  type="button"
                  className="btn ghost block mb14"
                  onClick={() => abrirNovaAutomacao(coluna.id, coluna.titulo)}
                >
                  + Nova automação
                </button>
                {automacoesEtapa.length === 0 ? (
                  <p className="hint">Nenhuma automação nessa etapa ainda.</p>
                ) : (
                  automacoesEtapa.map((automacao) => (
                    <button
                      type="button"
                      className="auto-kanban-card"
                      key={automacao.id}
                      onClick={() => abrirEdicao(automacao, coluna.titulo)}
                    >
                      <span className="auto-kanban-card-h">
                        <IconAutomacoes width={14} height={14} />
                        <span className="titulo">{automacao.titulo}</span>
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
                      </span>
                      <span className="auto-kanban-card-gatilho">
                        {resumoGatilho(automacao)}
                        {resumoJanela(automacao) ? ` · ${resumoJanela(automacao)}` : ""}
                      </span>
                      <span className="auto-kanban-card-acoes">
                        {automacao.acoes.map((acao) => (
                          <span key={acao.id} title={acao.tipo}>
                            {ICONE_ACAO[acao.tipo]}
                          </span>
                        ))}
                      </span>
                      <span
                        className="auto-kanban-card-foot"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="hint">{automacao.execucoes}</span>
                        <Toggle
                          defaultOn={automacao.ativa}
                          label={automacao.titulo}
                          onToggle={() => alternarAtiva(automacao.id)}
                        />
                      </span>
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>

        <div className="int-group" style={{ marginTop: 24 }}>
          <p className="int-group-h">
            Comentário vira Direct — Instagram e TikTok
          </p>
          <p className="hint mb14">
            Quando alguém comenta a palavra-chave num post, o CRM manda essa
            mensagem no direct/inbox automaticamente. Isso ainda é simulado
            aqui — a conexão de verdade com a API oficial da Meta e do TikTok
            entra depois que a estrutura estiver fechada.
          </p>

          {regraEditorAberto ? (
            <section className="open-conv mb14">
              <div className="open-conv-h">
                <div>
                  <p className="n">
                    {regraEditandoId ? "Editar regra" : "Nova regra de comentário"}
                  </p>
                  <p className="s">Comentário com a palavra → direct automático</p>
                </div>
                <span
                  className="close"
                  style={{ cursor: "pointer" }}
                  onClick={fecharRegraEditor}
                >
                  Fechar ✕
                </span>
              </div>

              <div className="field">
                <label>Canal</label>
                <div className="filters-row">
                  {CANAIS_COMENTARIO.map((canal) => (
                    <button
                      type="button"
                      key={canal}
                      className={`fchip${canalRegraForm === canal ? " active" : ""}`}
                      aria-pressed={canalRegraForm === canal}
                      onClick={() => setCanalRegraForm(canal)}
                    >
                      {canal}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Palavra-chave no comentário</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  type="text"
                  placeholder="Ex.: QUERO"
                  value={palavraChaveForm}
                  onChange={(e) => setPalavraChaveForm(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Mensagem enviada no direct</label>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                  placeholder="Ex.: Oi! Vi seu comentário 💙 Aqui está o link..."
                  value={mensagemDirectForm}
                  onChange={(e) => setMensagemDirectForm(e.target.value)}
                />
              </div>

              <div className="toggle-row">
                <span className="tl">
                  {regraEditandoId ? "Regra ativa" : "Ativar assim que criar"}
                </span>
                <Toggle
                  key={regraEditandoId ?? "nova-regra"}
                  defaultOn={ativaRegraForm}
                  label="Regra ativa"
                  onToggle={setAtivaRegraForm}
                />
              </div>

              <div className="section-foot">
                {regraEditandoId ? (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const regra = regrasComentario.find(
                        (r) => r.id === regraEditandoId,
                      );
                      if (regra) pedirExclusaoRegra(regra);
                    }}
                  >
                    Excluir regra
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn primary"
                  style={{ flex: 1 }}
                  onClick={salvarRegra}
                >
                  {regraEditandoId ? "Salvar alterações" : "Salvar regra"}
                </button>
              </div>
            </section>
          ) : null}

          <button
            type="button"
            className="btn ghost mb14"
            onClick={abrirNovaRegra}
          >
            + Nova regra de comentário
          </button>

          <div className="card">
            {regrasComentario.length === 0 ? (
              <p className="hint" style={{ padding: 17 }}>
                Nenhuma regra criada ainda.
              </p>
            ) : (
              regrasComentario.map((regra) => (
                <div
                  className="int-row"
                  key={regra.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => abrirEdicaoRegra(regra)}
                >
                  <div className="int-body">
                    <p className="int-title">
                      {regra.canal} · comentário com &quot;{regra.palavraChave}
                      &quot;
                    </p>
                    <p className="int-sub">{regra.mensagemDirect}</p>
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      testarRegra(regra);
                    }}
                  >
                    Testar
                  </button>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Toggle
                      defaultOn={regra.ativa}
                      label={`Ativar regra ${regra.palavraChave}`}
                      onToggle={() => alternarRegraComentarioAtiva(regra.id)}
                    />
                  </span>
                  <span
                    role="button"
                    aria-label={`Excluir regra ${regra.palavraChave}`}
                    title="Excluir regra"
                    style={{ cursor: "pointer", color: "var(--text-faint)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      pedirExclusaoRegra(regra);
                    }}
                  >
                    ✕
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {toasts.length > 0 ? (
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <IconAutomacoes width={14} height={14} />
              {toast.texto}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
