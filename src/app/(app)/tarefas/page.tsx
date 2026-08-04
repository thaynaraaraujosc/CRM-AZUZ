"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  equipe,
  EQUIPE_PADRAO_TAREFA,
  tarefas as tarefasIniciais,
} from "@/lib/data";
import type { ColunaTarefas, Urgencia } from "@/lib/data";
import { useNotificacoes } from "@/lib/notificacoes-context";
import { IconConfiguracoes, IconDoc } from "@/components/icons";
import { ChipFilters, RadioList, Toggle, Topbar } from "@/components/ui";

const NIVEIS_URGENCIA: Urgencia[] = ["Baixa", "Média", "Alta"];

const RESPONSAVEIS = equipe.map((m) => ({ nome: m.nome, descricao: m.papel }));

function cloneColunas(colunas: ColunaTarefas[]): ColunaTarefas[] {
  return colunas.map((c) => ({ ...c, cards: c.cards.map((card) => ({ ...card })) }));
}

function TarefasContent() {
  const searchParams = useSearchParams();
  const { simularNovaTarefa } = useNotificacoes();
  const [colunas, setColunas] = useState<ColunaTarefas[]>(() =>
    cloneColunas(tarefasIniciais),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novaTarefaAberta, setNovaTarefaAberta] = useState(
    () => searchParams.get("nova") === "1",
  );
  const [arrastando, setArrastando] = useState<{
    coluna: number;
    card: number;
  } | null>(null);
  const [filtroModelo, setFiltroModelo] = useState<string>(EQUIPE_PADRAO_TAREFA);
  const [pastasExtras, setPastasExtras] = useState<string[]>([]);
  const [novaPastaAberta, setNovaPastaAberta] = useState(false);
  const [novaPastaInput, setNovaPastaInput] = useState("");
  const novaPastaRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!novaPastaAberta) return;
    function aoClicarFora(e: MouseEvent) {
      if (novaPastaRef.current && !novaPastaRef.current.contains(e.target as Node)) {
        setNovaPastaAberta(false);
        setNovaPastaInput("");
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [novaPastaAberta]);
  const [colunaRenomeando, setColunaRenomeando] = useState<number | null>(null);
  const [nomeRenomeando, setNomeRenomeando] = useState("");
  const [colunaArrastando, setColunaArrastando] = useState<number | null>(null);
  const [novaEtapaAberta, setNovaEtapaAberta] = useState(false);
  const [nomeNovaEtapa, setNomeNovaEtapa] = useState("");

  const [tituloNovaTarefa, setTituloNovaTarefa] = useState("");
  const [descricaoNovaTarefa, setDescricaoNovaTarefa] = useState("");
  const [urgenciaNovaTarefa, setUrgenciaNovaTarefa] = useState<
    (typeof NIVEIS_URGENCIA)[number]
  >(NIVEIS_URGENCIA[1]);
  const [dataNovaTarefa, setDataNovaTarefa] = useState("");
  const [responsavelNovaTarefa, setResponsavelNovaTarefa] = useState(
    RESPONSAVEIS[0]?.nome ?? "",
  );
  const [equipeNovaTarefa, setEquipeNovaTarefa] = useState(EQUIPE_PADRAO_TAREFA);
  const [novaEquipeInput, setNovaEquipeInput] = useState("");

  const todasAsTarefas = colunas.flatMap((coluna) => coluna.cards);
  const equipesExistentes = Array.from(
    new Set([
      EQUIPE_PADRAO_TAREFA,
      ...todasAsTarefas.map((t) => t.modelo || EQUIPE_PADRAO_TAREFA),
      ...pastasExtras,
    ]),
  );
  const aberta = todasAsTarefas.find((t) => t.id === selectedId) ?? null;
  const colunaDaAberta = aberta
    ? colunas.findIndex((c) => c.cards.some((card) => card.id === aberta.id))
    : -1;

  const [tituloEditavel, setTituloEditavel] = useState(aberta?.titulo ?? "");
  const [siblingsAbertos, setSiblingsAbertos] = useState(false);
  const [abertaIdAnterior, setAbertaIdAnterior] = useState(selectedId);
  if (selectedId !== abertaIdAnterior) {
    setAbertaIdAnterior(selectedId);
    setTituloEditavel(aberta?.titulo ?? "");
    setSiblingsAbertos(false);
  }

  function abrirTarefa(id: string) {
    setNovaTarefaAberta(false);
    setSelectedId((atual) => (atual === id ? null : id));
  }

  function moverTarefaPara(
    colOrigem: number,
    indiceOrigem: number,
    colDestino: number,
    indiceDestino?: number,
  ) {
    setColunas((prev) => {
      const proximo = cloneColunas(prev);
      const [card] = proximo[colOrigem].cards.splice(indiceOrigem, 1);
      if (!card) return prev;

      const tituloDestino = proximo[colDestino].titulo;
      card.concluida = tituloDestino === "Concluídas";
      card.atrasada = tituloDestino === "Atrasadas";

      const destino = proximo[colDestino].cards;
      const posicao = indiceDestino ?? destino.length;
      const posicaoAjustada =
        colOrigem === colDestino && indiceOrigem < posicao ? posicao - 1 : posicao;
      destino.splice(posicaoAjustada, 0, card);
      return proximo;
    });
  }

  function moverTarefa(colunaDestino: number, indiceDestino?: number) {
    if (!arrastando) return;
    const { coluna: colunaOrigem, card: indiceCard } = arrastando;
    setArrastando(null);
    if (colunaOrigem === colunaDestino && indiceCard === indiceDestino) return;
    moverTarefaPara(colunaOrigem, indiceCard, colunaDestino, indiceDestino);
  }

  function mudarStatus(novoColIndex: number) {
    if (!aberta || colunaDaAberta < 0) return;
    const indiceOrigem = colunas[colunaDaAberta].cards.findIndex(
      (card) => card.id === aberta.id,
    );
    if (indiceOrigem < 0) return;
    moverTarefaPara(colunaDaAberta, indiceOrigem, novoColIndex);
  }

  function renomearEtapa(colIndex: number) {
    const titulo = nomeRenomeando.trim();
    if (!titulo) {
      setColunaRenomeando(null);
      return;
    }
    setColunas((prev) =>
      prev.map((c, i) => (i === colIndex ? { ...c, titulo } : c)),
    );
    setColunaRenomeando(null);
  }

  function reordenarEtapa(origem: number, destino: number) {
    setColunaArrastando(null);
    if (origem === destino) return;
    setColunas((prev) => {
      const proximo = [...prev];
      const [movida] = proximo.splice(origem, 1);
      if (!movida) return prev;
      proximo.splice(destino, 0, movida);
      return proximo;
    });
  }

  function criarEtapa() {
    const titulo = nomeNovaEtapa.trim();
    if (!titulo) return;
    setColunas((prev) => [...prev, { titulo, cards: [] }]);
    setNomeNovaEtapa("");
    setNovaEtapaAberta(false);
  }

  function excluirEtapa(colIndex: number) {
    setColunas((prev) => prev.filter((_, i) => i !== colIndex));
  }

  function fecharNovaTarefa() {
    setNovaTarefaAberta(false);
    setTituloNovaTarefa("");
    setDescricaoNovaTarefa("");
    setUrgenciaNovaTarefa(NIVEIS_URGENCIA[1]);
    setDataNovaTarefa("");
    setResponsavelNovaTarefa(RESPONSAVEIS[0]?.nome ?? "");
    setEquipeNovaTarefa(EQUIPE_PADRAO_TAREFA);
    setNovaEquipeInput("");
  }

  function adicionarNovaEquipe() {
    const nome = novaEquipeInput.trim();
    if (!nome) return;
    setEquipeNovaTarefa(nome);
    setNovaEquipeInput("");
  }

  function criarNovaPasta() {
    const nome = novaPastaInput.trim();
    if (!nome) return;
    setPastasExtras((prev) => (prev.includes(nome) ? prev : [...prev, nome]));
    setFiltroModelo(nome);
    setNovaPastaInput("");
    setNovaPastaAberta(false);
  }

  function criarTarefa() {
    const titulo = tituloNovaTarefa.trim();
    if (!titulo) return;
    const responsavelEscolhido =
      equipe.find((m) => m.nome === responsavelNovaTarefa) ?? equipe[0];
    const novaTarefa = {
      id: `tarefa-${Date.now()}`,
      titulo,
      contato: "—",
      data: dataNovaTarefa.trim() || "Sem data",
      responsavel: {
        nome: responsavelEscolhido?.nome ?? "—",
        initials: responsavelEscolhido?.initials ?? "—",
      },
      urgencia: urgenciaNovaTarefa,
      descricao: descricaoNovaTarefa.trim() || "Sem descrição.",
      anexo: null,
      modelo: equipeNovaTarefa,
    };
    setColunas((prev) => {
      const proximo = cloneColunas(prev);
      const colunaDestino =
        proximo.find((c) => c.titulo === "Hoje") ?? proximo[0];
      colunaDestino?.cards.push(novaTarefa);
      return proximo;
    });
    simularNovaTarefa(titulo);
    fecharNovaTarefa();
  }

  function salvarTitulo() {
    if (!aberta) return;
    const titulo = tituloEditavel.trim() || aberta.titulo;
    setColunas((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.map((card) =>
          card.id === aberta.id ? { ...card, titulo } : card,
        ),
      })),
    );
  }

  return (
    <>
      <Topbar
        title="Tarefas"
        sub="Kanban por prazo — arraste um card pra mudar o status, até chegar em Concluídas"
        actions={
          <>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setNovaEtapaAberta((v) => !v)}
            >
              {novaEtapaAberta ? "Cancelar" : "+ Nova etapa"}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setNovaTarefaAberta((v) => !v);
                setSelectedId(null);
                setEquipeNovaTarefa(filtroModelo);
              }}
            >
              {novaTarefaAberta ? "Cancelar" : "+ Nova tarefa"}
            </button>
          </>
        }
      />

      <div className="content">
        {novaEtapaAberta ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Nova etapa</p>
                <p className="s">Entra como uma coluna nova no kanban</p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovaEtapaAberta(false)}
              >
                Fechar ✕
              </span>
            </div>
            <div className="field">
              <label>Nome da etapa</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNovaEtapa}
                onChange={(e) => setNomeNovaEtapa(e.target.value)}
                placeholder="Ex.: Aguardando retorno"
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarEtapa();
                }}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarEtapa}
              >
                Criar etapa
              </button>
            </div>
          </section>
        ) : null}

        <div className="view-switch-row mb14">
            <div className="filters-row" style={{ flex: 1 }}>
              {equipesExistentes.map((m) => (
                <button
                  type="button"
                  key={m}
                  className={`fchip${filtroModelo === m ? " active" : ""}`}
                  aria-pressed={filtroModelo === m}
                  onClick={() => setFiltroModelo(m)}
                >
                  📁 {m}
                </button>
              ))}
              {novaPastaAberta ? (
                <span ref={novaPastaRef} className="nova-pasta-inline">
                  <input
                    className="nova-pasta-input"
                    autoFocus
                    value={novaPastaInput}
                    onChange={(e) => setNovaPastaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        criarNovaPasta();
                      }
                      if (e.key === "Escape") {
                        setNovaPastaAberta(false);
                        setNovaPastaInput("");
                      }
                    }}
                    placeholder="Nome da pasta"
                  />
                  <button type="button" className="btn ghost" onClick={criarNovaPasta}>
                    Criar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="fchip"
                  onClick={() => setNovaPastaAberta(true)}
                >
                  + Nova pasta
                </button>
              )}
            </div>
        </div>

        {novaTarefaAberta ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Nova tarefa</p>
                <p className="s">Preencha e salve — ela entra no kanban abaixo</p>
              </div>
              <span className="close" style={{ cursor: "pointer" }} onClick={fecharNovaTarefa}>
                Fechar ✕
              </span>
            </div>
            <div className="field">
              <label>Título</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={tituloNovaTarefa}
                onChange={(e) => setTituloNovaTarefa(e.target.value)}
                placeholder="Ex.: Ligar pra confirmar presença"
              />
            </div>
            <div className="field">
              <label>O que fazer</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 80, resize: "vertical" }}
                value={descricaoNovaTarefa}
                onChange={(e) => setDescricaoNovaTarefa(e.target.value)}
                placeholder="Descreva o que precisa ser feito nessa tarefa"
              />
            </div>
            <div className="field">
              <label>Nível de urgência</label>
              <ChipFilters
                options={NIVEIS_URGENCIA}
                initial={1}
                onChange={(v) => setUrgenciaNovaTarefa(v as Urgencia)}
              />
            </div>
            <div className="field">
              <label>Data</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={dataNovaTarefa}
                onChange={(e) => setDataNovaTarefa(e.target.value)}
                placeholder="dd/mm/aaaa · hora"
              />
            </div>
            <div className="field">
              <label>Atribuir para</label>
              <RadioList
                options={RESPONSAVEIS}
                initial={RESPONSAVEIS[0]?.nome}
                onChange={(v) => setResponsavelNovaTarefa(v)}
              />
            </div>
            <div className="field">
              <label>Equipe</label>
              <div className="filters-row" style={{ marginBottom: 8 }}>
                {equipesExistentes.map((eq) => (
                  <button
                    type="button"
                    key={eq}
                    className={`fchip${equipeNovaTarefa === eq ? " active" : ""}`}
                    aria-pressed={equipeNovaTarefa === eq}
                    onClick={() => setEquipeNovaTarefa(eq)}
                  >
                    {eq}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  type="text"
                  value={novaEquipeInput}
                  onChange={(e) => setNovaEquipeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarNovaEquipe();
                    }
                  }}
                  placeholder="Criar equipe nova (ex.: Marketing)"
                />
                <button
                  type="button"
                  className="btn ghost"
                  onClick={adicionarNovaEquipe}
                >
                  + Equipe
                </button>
              </div>
              {equipeNovaTarefa ? (
                <p className="hint" style={{ marginTop: 6 }}>
                  Essa tarefa vai pra equipe &quot;{equipeNovaTarefa}&quot;
                </p>
              ) : null}
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarTarefa}
              >
                Criar tarefa
              </button>
            </div>
          </section>
        ) : null}

        <div className="kanban">
          {colunas.map((coluna, colIndex) => {
            const cardsComIndice = coluna.cards.map((card, cardIndex) => ({
              card,
              cardIndex,
            }));
            const cardsVisiveis = cardsComIndice.filter(
              ({ card }) => (card.modelo || EQUIPE_PADRAO_TAREFA) === filtroModelo,
            );

            return (
            <div
              key={colIndex}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (colunaArrastando !== null) {
                  reordenarEtapa(colunaArrastando, colIndex);
                } else {
                  moverTarefa(colIndex);
                }
              }}
              style={{
                minHeight: 60,
                opacity: colunaArrastando === colIndex ? 0.5 : 1,
              }}
            >
              <div className="kcol-h">
                <span
                  className="kcol-drag-handle"
                  draggable
                  onDragStart={() => setColunaArrastando(colIndex)}
                  onDragEnd={() => setColunaArrastando(null)}
                  title="Arraste pra reordenar a etapa"
                >
                  ⠿
                </span>
                {colunaRenomeando === colIndex ? (
                  <input
                    className="input"
                    autoFocus
                    style={{ flex: 1, marginRight: 8 }}
                    value={nomeRenomeando}
                    onChange={(e) => setNomeRenomeando(e.target.value)}
                    onBlur={() => renomearEtapa(colIndex)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renomearEtapa(colIndex);
                      if (e.key === "Escape") setColunaRenomeando(null);
                    }}
                  />
                ) : (
                  <span
                    className="t"
                    style={{ cursor: "pointer" }}
                    title="Clique pra renomear"
                    onClick={() => {
                      setColunaRenomeando(colIndex);
                      setNomeRenomeando(coluna.titulo);
                    }}
                  >
                    <span className="dot" />
                    {coluna.titulo}
                  </span>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
                  <span className="c">{cardsVisiveis.length}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Excluir etapa ${coluna.titulo}`}
                    title="Excluir etapa"
                    style={{ cursor: "pointer", color: "var(--text-faint)" }}
                    onClick={() => excluirEtapa(colIndex)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        excluirEtapa(colIndex);
                      }
                    }}
                  >
                    ✕
                  </span>
                </span>
              </div>

              {cardsVisiveis.map(({ card, cardIndex }) => {
                const isOpen = card.id === aberta?.id;
                const classes = [
                  "task-card",
                  isOpen ? "open" : "",
                  card.concluida ? "done" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    type="button"
                    key={card.id}
                    className={classes}
                    draggable
                    onDragStart={() =>
                      setArrastando({ coluna: colIndex, card: cardIndex })
                    }
                    onDragEnd={() => setArrastando(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      moverTarefa(colIndex, cardIndex);
                    }}
                    onClick={() => abrirTarefa(card.id)}
                    style={{ cursor: "grab" }}
                  >
                    <span className="tc-r1">
                      <span className="tc-title">{card.titulo}</span>
                      {isOpen ? (
                        <span className="gear-btn">
                          <IconConfiguracoes />
                        </span>
                      ) : (
                        <span
                          className={`tc-date${card.atrasada ? " late" : ""}`}
                        >
                          {card.data}
                        </span>
                      )}
                    </span>
                    <span className="tc-meta" style={{ display: "block" }}>
                      {card.contato}
                      {isOpen ? ` · ${card.data}` : ""}
                    </span>
                    <span className="tc-r3">
                      <span className="task-who">
                        <span className="avatar xs">
                          {card.responsavel.initials}
                        </span>
                        {card.responsavel.nome}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            );
          })}
        </div>

        {/* Tarefa aberta, embaixo do kanban */}
        {aberta ? (
          <section className="open-conv">
            <div className="open-conv-h">
              <div className="avatar">{aberta.responsavel.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  className="input"
                  style={{
                    width: "100%",
                    fontWeight: 700,
                    fontSize: 13.5,
                    padding: "5px 8px",
                    marginBottom: 3,
                  }}
                  value={tituloEditavel}
                  onChange={(e) => setTituloEditavel(e.target.value)}
                  onBlur={salvarTitulo}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <p className="s">
                  Vinculada a {aberta.contato} · atribuída a{" "}
                  {aberta.responsavel.nome}
                </p>
              </div>
              {colunaDaAberta >= 0 ? (
                <select
                  className="input"
                  style={{ width: "auto", cursor: "pointer" }}
                  value={colunaDaAberta}
                  onChange={(e) => mudarStatus(Number(e.target.value))}
                >
                  {colunas.map((c, i) => (
                    <option key={c.titulo} value={i}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
              ) : null}
              <span className="close" style={{ cursor: "pointer" }} onClick={() => setSelectedId(null)}>
                Fechar ✕
              </span>
            </div>

            <div className="open-conv-body">
              <div>
                <div className="panel-h">
                  <h4>O que precisa ser feito</h4>
                </div>
                <div className="field">
                  <label>Nível de urgência</label>
                  <span className={`pill${aberta.urgencia === "Alta" ? " on" : ""}`}>
                    {aberta.urgencia}
                  </span>
                </div>
                <div className="field">
                  <div className="input" style={{ minHeight: 80 }}>
                    {aberta.descricao}
                  </div>
                </div>

                <div className="panel-h divided">
                  <h4>Anexos</h4>
                </div>
                <div style={{ padding: "14px 17px" }}>
                  {aberta.anexo ? (
                    <div className="attach-chip" style={{ marginBottom: 8 }}>
                      <IconDoc />
                      <span className="fn">{aberta.anexo.arquivo}</span>
                      <span className="fs">{aberta.anexo.detalhe}</span>
                    </div>
                  ) : null}
                  <button type="button" className="btn ghost block">
                    + Anexar documento
                  </button>
                </div>

                {aberta.modelo ? (
                  <>
                    <div
                      className="panel-h divided"
                      style={{ cursor: "pointer" }}
                      onClick={() => setSiblingsAbertos((v) => !v)}
                    >
                      <h4>
                        Tarefas do modelo &quot;{aberta.modelo}&quot;{" "}
                        {siblingsAbertos ? "▾" : "▸"}
                      </h4>
                    </div>
                    {siblingsAbertos ? (
                      <div style={{ padding: "0 17px 14px" }}>
                        {todasAsTarefas.filter(
                          (t) => t.modelo === aberta.modelo && t.id !== aberta.id,
                        ).length === 0 ? (
                          <p className="hint">Nenhuma outra tarefa nesse modelo.</p>
                        ) : (
                          todasAsTarefas
                            .filter(
                              (t) =>
                                t.modelo === aberta.modelo && t.id !== aberta.id,
                            )
                            .map((t) => (
                              <div
                                className="stat-row"
                                key={t.id}
                                style={{ cursor: "pointer" }}
                                onClick={() => abrirTarefa(t.id)}
                              >
                                <span className="sl">{t.titulo}</span>
                                <span className="sv">{t.data}</span>
                              </div>
                            ))
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div>
                <div className="panel-h">
                  <h4>Detalhes</h4>
                </div>
                <div className="field">
                  <label>Data</label>
                  <div className="input">{aberta.data}</div>
                </div>
                <div className="field">
                  <label>Atribuir para</label>
                  <RadioList
                    key={aberta.id}
                    options={RESPONSAVEIS}
                    initial={aberta.responsavel.nome}
                  />
                </div>
                <div className="toggle-row">
                  <span className="tl">Avisar por WhatsApp perto do vencimento</span>
                  <Toggle defaultOn label="Avisar por WhatsApp perto do vencimento" />
                </div>
                <div className="section-foot">
                  <button
                    type="button"
                    className="btn primary"
                    style={{ flex: 1 }}
                    onClick={salvarTitulo}
                  >
                    Salvar tarefa
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const colDestino = colunas.findIndex(
                        (c) => c.titulo === "Concluídas",
                      );
                      if (colDestino >= 0) mudarStatus(colDestino);
                    }}
                  >
                    Marcar concluída
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

export default function TarefasPage() {
  return (
    <Suspense fallback={null}>
      <TarefasContent />
    </Suspense>
  );
}
