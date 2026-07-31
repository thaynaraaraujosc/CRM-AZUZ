"use client";

import { useState } from "react";

import {
  acoesAutomacao,
  automacaoIdeias,
  automacoes,
  gatilhosAutomacao,
} from "@/lib/data";
import { IconAutomacoes } from "@/components/icons";
import { ChipFilters, Toggle, Topbar } from "@/components/ui";

type Ideia = (typeof automacaoIdeias)[number];
type Modelo = "lista" | "mapa-mental";

export default function AutomacoesPage() {
  const ativas = automacoes.filter((a) => a.ativa).length;
  const [construtorAberto, setConstrutorAberto] = useState(false);
  const [ideiaEscolhida, setIdeiaEscolhida] = useState<Ideia | "zero" | null>(
    null,
  );
  const [modelo, setModelo] = useState<Modelo>("lista");
  const [modeloMenuAberto, setModeloMenuAberto] = useState(false);

  function fecharConstrutor() {
    setConstrutorAberto(false);
    setIdeiaEscolhida(null);
  }

  return (
    <>
      <Topbar
        title="Automações"
        sub={`${automacoes.length} automações · ${ativas} ativas — follow-up e movimentação de funil`}
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
              onClick={() => {
                setConstrutorAberto((v) => !v);
                setIdeiaEscolhida(null);
              }}
            >
              {construtorAberto ? "Cancelar" : "+ Nova automação"}
            </button>
          </>
        }
      />

      <div className="content">
        {construtorAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Nova automação</p>
                <p className="s">
                  Automatize qualquer movimento do funil ou das tarefas —
                  escolha uma ideia ou comece do zero
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
                    onClick={() => setIdeiaEscolhida(ideia)}
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
                  onClick={() => setIdeiaEscolhida("zero")}
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
                    defaultValue={
                      ideiaEscolhida === "zero" ? "" : ideiaEscolhida.titulo
                    }
                    placeholder="Ex.: Lead novo → mensagem de boas-vindas"
                  />
                </div>
                <div className="field">
                  <label>Gatilho — quando disparar</label>
                  <ChipFilters
                    options={gatilhosAutomacao}
                    initial={
                      ideiaEscolhida !== "zero"
                        ? gatilhosAutomacao.indexOf(ideiaEscolhida.gatilho)
                        : 0
                    }
                  />
                </div>
                <div className="field">
                  <label>Ação — o que fazer</label>
                  <ChipFilters
                    options={acoesAutomacao}
                    initial={
                      ideiaEscolhida !== "zero"
                        ? acoesAutomacao.indexOf(ideiaEscolhida.acao)
                        : 0
                    }
                  />
                </div>
                <div className="field">
                  <label>Mensagem ou observação (opcional)</label>
                  <textarea
                    className="input"
                    style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                    placeholder="Ex.: Oi! Recebemos sua mensagem, já já alguém te responde por aqui 💙"
                    defaultValue={
                      ideiaEscolhida !== "zero" ? ideiaEscolhida.descricao : ""
                    }
                  />
                </div>
                <div className="toggle-row">
                  <span className="tl">Ativar assim que criar</span>
                  <Toggle defaultOn label="Ativar assim que criar" />
                </div>
                <div className="section-foot">
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: 1 }}
                    onClick={() => setIdeiaEscolhida(null)}
                  >
                    ← Escolher outra ideia
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    style={{ flex: 1 }}
                    onClick={fecharConstrutor}
                  >
                    Salvar automação
                  </button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {modelo === "lista" ? (
          <div className="card">
            {automacoes.map((automacao) => (
              <div className="auto-row" key={automacao.titulo}>
                <div className="auto-icon">
                  <IconAutomacoes />
                </div>
                <div className="auto-body">
                  <p className="auto-title">{automacao.titulo}</p>
                  <div className="auto-flow">
                    {automacao.fluxo.map((passo, i) => (
                      <span key={passo} style={{ display: "contents" }}>
                        {i > 0 ? <span className="flow-arrow">→</span> : null}
                        <span className="flow-chip">{passo}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <span className="auto-stat">{automacao.execucoes}</span>
                <Toggle defaultOn={automacao.ativa} label={automacao.titulo} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mindmap">
            <div className="mindmap-root">
              <IconAutomacoes width={18} height={18} />
              Automações
            </div>
            <div className="mindmap-branches">
              {automacoes.map((automacao) => (
                <div className="mindmap-branch" key={automacao.titulo}>
                  <div className="mindmap-node">
                    <div className="auto-row" style={{ padding: 0, border: 0 }}>
                      <div className="auto-body">
                        <p className="auto-title">{automacao.titulo}</p>
                        <div className="auto-flow">
                          {automacao.fluxo.map((passo, i) => (
                            <span key={passo} style={{ display: "contents" }}>
                              {i > 0 ? (
                                <span className="flow-arrow">→</span>
                              ) : null}
                              <span className="flow-chip">{passo}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <Toggle defaultOn={automacao.ativa} label={automacao.titulo} />
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
