"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { currentUser } from "@/lib/data";
import { compromissosDeTarefas, HOJE_ISO, useAgenda } from "@/lib/agenda-context";
import { useTarefas } from "@/lib/tarefas-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { Topbar } from "@/components/ui";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoDe(ano: number, mesIndex0: number, dia: number) {
  return `${ano}-${pad2(mesIndex0 + 1)}-${pad2(dia)}`;
}

export default function AgendaPage() {
  const { colunas } = useTarefas();
  const { compromissos, criarAgendamento: criarAgendamentoCtx, cancelar } = useAgenda();
  const [ano, setAno] = useState(2026);
  const [mesIndex0, setMesIndex0] = useState(6); // julho
  const [conexao, setConexao] = useState<"interna" | "google">("interna");
  const [googleConectado, setGoogleConectado] = useState(false);
  const [modo, setModo] = useState<"completa" | "manual">("completa");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [tituloNovo, setTituloNovo] = useState("");
  const [descricaoNovo, setDescricaoNovo] = useState("");
  const [horaNovo, setHoraNovo] = useState("09:00");
  const [menuConexaoAberto, setMenuConexaoAberto] = useState(false);
  const [menuConexaoAnchorRect, setMenuConexaoAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: menuConexaoRef, posicao: menuConexaoPos } = useFloatingPosition(menuConexaoAnchorRect, menuConexaoAberto);
  const [menuConteudoAberto, setMenuConteudoAberto] = useState(false);
  const [menuConteudoAnchorRect, setMenuConteudoAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: menuConteudoRef, posicao: menuConteudoPos } = useFloatingPosition(menuConteudoAnchorRect, menuConteudoAberto);

  const compromissosManuais = compromissos.filter((c) => c.origem === "manual" && c.status !== "cancelado");
  const compromissosAutomaticos = modo === "completa" ? compromissosDeTarefas(colunas, ano) : [];

  function eventosDoDia(dataIso: string) {
    return [
      ...compromissosManuais
        .filter((c) => c.dataIso === dataIso)
        .map((c) => ({ id: c.id, titulo: c.tipo, descricao: c.descricao ?? "", manual: true })),
      ...compromissosAutomaticos
        .filter((c) => c.dataIso === dataIso)
        .map((c) => ({ id: c.id, titulo: c.descricao ?? c.tipo, descricao: `Tarefa de ${c.contato} · ${c.tipo.replace("Tarefa · ", "")}`, manual: false })),
    ];
  }

  function mudarMes(delta: number) {
    let novoMes = mesIndex0 + delta;
    let novoAno = ano;
    if (novoMes < 0) {
      novoMes = 11;
      novoAno -= 1;
    } else if (novoMes > 11) {
      novoMes = 0;
      novoAno += 1;
    }
    setMesIndex0(novoMes);
    setAno(novoAno);
    setDiaSelecionado(null);
    setNovoAberto(false);
  }

  function criarAgendamento() {
    const titulo = tituloNovo.trim();
    if (!titulo || !diaSelecionado) return;
    criarAgendamentoCtx({
      contato: "—",
      responsavel: currentUser.name,
      dataIso: diaSelecionado,
      hora: horaNovo,
      tipo: titulo,
      descricao: descricaoNovo.trim(),
    });
    setTituloNovo("");
    setDescricaoNovo("");
    setNovoAberto(false);
  }

  const primeiroDiaSemana = new Date(ano, mesIndex0, 1).getDay();
  const totalDias = new Date(ano, mesIndex0 + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  return (
    <>
      <Topbar
        title="Agenda"
        sub={
          conexao === "google"
            ? googleConectado
              ? `Conectada ao Google Agenda · ${currentUser.email}`
              : "Conecte com o Google Agenda pra sincronizar"
            : "Agenda interna"
        }
        actions={
          <>
            <div className="dropdown-anchor">
              <button
                type="button"
                className="fsel"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  if (menuConexaoAberto) {
                    setMenuConexaoAberto(false);
                  } else {
                    setMenuConexaoAnchorRect(e.currentTarget.getBoundingClientRect());
                    setMenuConexaoAberto(true);
                  }
                }}
              >
                {conexao === "interna" ? "Agenda interna" : "Google Agenda"} ▾
              </button>
              {menuConexaoAberto && menuConexaoPos && typeof document !== "undefined"
                ? createPortal(
                    <>
                      <div
                        onClick={() => setMenuConexaoAberto(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 190 }}
                      />
                      <div
                        ref={menuConexaoRef}
                        className="dropdown-pop"
                        style={{ position: "fixed", top: menuConexaoPos.top, left: menuConexaoPos.left, zIndex: 200 }}
                      >
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setConexao("interna");
                        setMenuConexaoAberto(false);
                      }}
                    >
                      <span className="n">
                        Agenda interna {conexao === "interna" ? "✓" : ""}
                      </span>
                      <span className="r">Não é conectada em nada</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setConexao("google");
                        setMenuConexaoAberto(false);
                      }}
                    >
                      <span className="n">
                        Google Agenda {conexao === "google" ? "✓" : ""}
                      </span>
                      <span className="r">Sincroniza com sua conta Google</span>
                    </button>
                    {conexao === "google" && googleConectado ? (
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          setGoogleConectado(false);
                          setMenuConexaoAberto(false);
                        }}
                      >
                        <span className="n">Desconectar do Google</span>
                        <span className="r">{currentUser.email}</span>
                      </button>
                    ) : null}
                      </div>
                    </>,
                    document.body,
                  )
                : null}
            </div>

            <div className="dropdown-anchor">
              <button
                type="button"
                className="fsel"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  if (menuConteudoAberto) {
                    setMenuConteudoAberto(false);
                  } else {
                    setMenuConteudoAnchorRect(e.currentTarget.getBoundingClientRect());
                    setMenuConteudoAberto(true);
                  }
                }}
              >
                {modo === "completa" ? "Agenda completa" : "Agenda manual"} ▾
              </button>
              {menuConteudoAberto && menuConteudoPos && typeof document !== "undefined"
                ? createPortal(
                    <>
                  <div
                    onClick={() => setMenuConteudoAberto(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 190 }}
                  />
                  <div
                    ref={menuConteudoRef}
                    className="dropdown-pop"
                    style={{ position: "fixed", top: menuConteudoPos.top, left: menuConteudoPos.left, zIndex: 200 }}
                  >
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setModo("completa");
                        setMenuConteudoAberto(false);
                      }}
                    >
                      <span className="n">
                        Agenda completa {modo === "completa" ? "✓" : ""}
                      </span>
                      <span className="r">Traz tarefas e pacientes sozinha</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setModo("manual");
                        setMenuConteudoAberto(false);
                      }}
                    >
                      <span className="n">
                        Agenda manual {modo === "manual" ? "✓" : ""}
                      </span>
                      <span className="r">Só o que você adicionar aqui</span>
                    </button>
                  </div>
                </>,
                document.body,
              )
                : null}
            </div>
          </>
        }
      />

      <div className="content">
        {conexao === "google" && !googleConectado ? (
          <div
            className="card mb14"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "12px 17px",
            }}
          >
            <span className="hint">Conecte pra sincronizar com o Google Agenda</span>
            <button
              type="button"
              className="btn primary"
              onClick={() => setGoogleConectado(true)}
            >
              Conectar com o Google Agenda
            </button>
          </div>
        ) : null}

        <div className="card mb14">
          <div className="panel-h">
            <button type="button" className="btn ghost" onClick={() => mudarMes(-1)}>
              ← Mês anterior
            </button>
            <h4>
              {MESES[mesIndex0]} de {ano}
            </h4>
            <button type="button" className="btn ghost" onClick={() => mudarMes(1)}>
              Próximo mês →
            </button>
          </div>
          <div className="agenda-grid">
            {DIAS_SEMANA.map((d) => (
              <div className="agenda-dow" key={d}>
                {d}
              </div>
            ))}
            {celulas.map((dia, i) => {
              if (dia === null) return <div className="agenda-cell vazia" key={`v-${i}`} />;
              const dataIso = isoDe(ano, mesIndex0, dia);
              const eventos = eventosDoDia(dataIso);
              const ehHoje = dataIso === HOJE_ISO;
              const selecionado = dataIso === diaSelecionado;
              return (
                <button
                  type="button"
                  key={dataIso}
                  className={`agenda-cell${ehHoje ? " hoje" : ""}${selecionado ? " selecionada" : ""}`}
                  onClick={() => {
                    setDiaSelecionado(dataIso);
                    setNovoAberto(false);
                  }}
                >
                  <span className="agenda-daynum">{dia}</span>
                  {eventos.slice(0, 3).map((e, idx) => (
                    <span
                      key={idx}
                      className={`agenda-evento${e.manual ? "" : " automatico"}`}
                    >
                      {e.titulo}
                    </span>
                  ))}
                  {eventos.length > 3 ? (
                    <span className="agenda-evento-mais">
                      +{eventos.length - 3}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {diaSelecionado ? (
          <div className="card">
            <div className="panel-h">
              <h4>
                {Number(diaSelecionado.split("-")[2])} de {MESES[mesIndex0]}
              </h4>
              <button
                type="button"
                className="btn primary"
                onClick={() => setNovoAberto((v) => !v)}
              >
                {novoAberto ? "Cancelar" : "+ Novo agendamento"}
              </button>
            </div>

            {novoAberto ? (
              <>
                <div className="field">
                  <label>O que é</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={tituloNovo}
                    onChange={(e) => setTituloNovo(e.target.value)}
                    placeholder="Ex.: Retorno da Marina Costa"
                  />
                </div>
                <div className="field">
                  <label>Hora</label>
                  <input
                    className="input"
                    type="time"
                    value={horaNovo}
                    onChange={(e) => setHoraNovo(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Descrição (opcional)</label>
                  <textarea
                    className="input"
                    style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                    value={descricaoNovo}
                    onChange={(e) => setDescricaoNovo(e.target.value)}
                    placeholder="Anotações sobre esse agendamento"
                  />
                </div>
                <div className="section-foot">
                  <button
                    type="button"
                    className="btn primary block"
                    onClick={criarAgendamento}
                  >
                    Salvar agendamento
                  </button>
                </div>
              </>
            ) : null}

            {eventosDoDia(diaSelecionado).length === 0 && !novoAberto ? (
              <p className="hint" style={{ padding: "0 17px 17px" }}>
                Nada agendado nesse dia ainda.
              </p>
            ) : (
              eventosDoDia(diaSelecionado).map((e, i) => (
                <div className="activity-row" key={i}>
                  <div className="body">
                    <p className="name">{e.titulo}</p>
                    <p className="meta">{e.descricao || "Sem descrição"}</p>
                  </div>
                  <span className={`pill${e.manual ? "" : " on"}`}>
                    {e.manual ? "Manual" : "Automático"}
                  </span>
                  {e.manual ? (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => cancelar(e.id)}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
