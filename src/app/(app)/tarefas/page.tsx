"use client";

import { useState } from "react";

import { equipe, tarefas as tarefasIniciais } from "@/lib/data";
import type { ColunaTarefas } from "@/lib/data";
import { IconConfiguracoes, IconDoc } from "@/components/icons";
import { ChipFilters, RadioList, Toggle, Topbar } from "@/components/ui";

const NIVEIS_URGENCIA = ["Baixa", "Média", "Alta"];

const RESPONSAVEIS = equipe.map((m) => ({ nome: m.nome, descricao: m.papel }));

function cloneColunas(colunas: ColunaTarefas[]): ColunaTarefas[] {
  return colunas.map((c) => ({ ...c, cards: c.cards.map((card) => ({ ...card })) }));
}

export default function TarefasPage() {
  const [colunas, setColunas] = useState<ColunaTarefas[]>(() =>
    cloneColunas(tarefasIniciais),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novaTarefaAberta, setNovaTarefaAberta] = useState(false);
  const [arrastando, setArrastando] = useState<{
    coluna: number;
    card: number;
  } | null>(null);

  const todasAsTarefas = colunas.flatMap((coluna) => coluna.cards);
  const aberta = todasAsTarefas.find((t) => t.id === selectedId) ?? null;

  function abrirTarefa(id: string) {
    setNovaTarefaAberta(false);
    setSelectedId((atual) => (atual === id ? null : id));
  }

  function moverTarefa(colunaDestino: number) {
    if (!arrastando) return;
    const { coluna: colunaOrigem, card: indiceCard } = arrastando;
    setArrastando(null);
    if (colunaOrigem === colunaDestino) return;

    setColunas((prev) => {
      const proximo = cloneColunas(prev);
      const [card] = proximo[colunaOrigem].cards.splice(indiceCard, 1);
      if (!card) return prev;

      const tituloDestino = proximo[colunaDestino].titulo;
      card.concluida = tituloDestino === "Concluídas";
      card.atrasada = tituloDestino === "Atrasadas";

      proximo[colunaDestino].cards.push(card);
      return proximo;
    });
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
                      {card.valor ? (
                        <span className="tc-val">{card.valor}</span>
                      ) : null}
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
              <div>
                <p className="n">{aberta.titulo}</p>
                <p className="s">
                  Vinculada a {aberta.contato} · atribuída a{" "}
                  {aberta.responsavel.nome}
                </p>
              </div>
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
                {aberta.valor ? (
                  <div className="field">
                    <label>Valor combinado</label>
                    <div className="input">{aberta.valor}</div>
                  </div>
                ) : null}
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
                  >
                    Salvar tarefa
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const colOrigem = colunas.findIndex((c) =>
                        c.cards.some((card) => card.id === aberta.id),
                      );
                      const colDestino = colunas.findIndex(
                        (c) => c.titulo === "Concluídas",
                      );
                      const cardIndex = colunas[colOrigem]?.cards.findIndex(
                        (card) => card.id === aberta.id,
                      );
                      if (colOrigem < 0 || colDestino < 0 || cardIndex === undefined || cardIndex < 0)
                        return;
                      setArrastando({ coluna: colOrigem, card: cardIndex });
                      setTimeout(() => moverTarefa(colDestino), 0);
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
