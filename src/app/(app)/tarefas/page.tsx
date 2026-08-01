"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { equipe, tarefas as tarefasIniciais } from "@/lib/data";
import type { ColunaTarefas } from "@/lib/data";
import { IconConfiguracoes, IconDoc } from "@/components/icons";
import { ChipFilters, RadioList, Toggle, Topbar } from "@/components/ui";

const NIVEIS_URGENCIA = ["Baixa", "Média", "Alta"];

const RESPONSAVEIS = equipe.map((m) => ({ nome: m.nome, descricao: m.papel }));

function cloneColunas(colunas: ColunaTarefas[]): ColunaTarefas[] {
  return colunas.map((c) => ({ ...c, cards: c.cards.map((card) => ({ ...card })) }));
}

function TarefasContent() {
  const searchParams = useSearchParams();
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

  const todasAsTarefas = colunas.flatMap((coluna) => coluna.cards);
  const aberta = todasAsTarefas.find((t) => t.id === selectedId) ?? null;
  const colunaDaAberta = aberta
    ? colunas.findIndex((c) => c.cards.some((card) => card.id === aberta.id))
    : -1;

  const [tituloEditavel, setTituloEditavel] = useState(aberta?.titulo ?? "");
  const [abertaIdAnterior, setAbertaIdAnterior] = useState(selectedId);
  if (selectedId !== abertaIdAnterior) {
    setAbertaIdAnterior(selectedId);
    setTituloEditavel(aberta?.titulo ?? "");
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
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setNovaTarefaAberta((v) => !v);
              setSelectedId(null);
            }}
          >
            {novaTarefaAberta ? "Cancelar" : "+ Nova tarefa"}
          </button>
        }
      />

      <div className="content">
        {novaTarefaAberta ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Nova tarefa</p>
                <p className="s">Preencha e salve — ela entra no kanban abaixo</p>
              </div>
              <span className="close" style={{ cursor: "pointer" }} onClick={() => setNovaTarefaAberta(false)}>
                Fechar ✕
              </span>
            </div>
            <div className="field">
              <label>Título</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                placeholder="Ex.: Ligar pra confirmar presença"
              />
            </div>
            <div className="field">
              <label>O que fazer</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 80, resize: "vertical" }}
                placeholder="Descreva o que precisa ser feito nessa tarefa"
              />
            </div>
            <div className="field">
              <label>Nível de urgência</label>
              <ChipFilters options={NIVEIS_URGENCIA} initial={1} />
            </div>
            <div className="field">
              <label>Data</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                placeholder="dd/mm/aaaa · hora"
              />
            </div>
            <div className="field">
              <label>Atribuir para</label>
              <RadioList options={RESPONSAVEIS} initial={RESPONSAVEIS[0]?.nome} />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={() => setNovaTarefaAberta(false)}
              >
                Criar tarefa
              </button>
            </div>
          </section>
        ) : null}

        <div className="kanban">
          {colunas.map((coluna, colIndex) => (
            <div
              key={coluna.titulo}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                moverTarefa(colIndex);
              }}
              style={{ minHeight: 60 }}
            >
              <div className="kcol-h">
                <span className="t">
                  <span className="dot" />
                  {coluna.titulo}
                </span>
                <span className="c">{coluna.cards.length}</span>
              </div>

              {coluna.cards.map((card, cardIndex) => {
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
          ))}
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
