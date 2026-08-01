"use client";

import { useState } from "react";

import { useContatos } from "@/lib/contatos-context";
import {
  CORES_BOTAO_FORMULARIO,
  CORES_FUNDO_FORMULARIO,
  TIPOS_PERGUNTA_FORMULARIO,
  labelTipoPergunta,
  useFormularios,
  type PerguntaFormulario,
  type TipoPerguntaFormulario,
} from "@/lib/formularios-context";
import { Topbar } from "@/components/ui";

const GRUPOS_PERGUNTA = ["Campos", "Informações de contato"];

/** Um valor de exemplo plausível por tipo de pergunta, pra simular uma resposta. */
function valorSimulado(pergunta: PerguntaFormulario): string {
  switch (pergunta.tipo) {
    case "texto_curto":
      return pergunta.rotulo.toLowerCase().includes("nome")
        ? "Fernanda Costa"
        : "Resposta de exemplo";
    case "texto_longo":
      return "Resposta longa de exemplo, preenchida pra simular o envio.";
    case "data":
      return "15/08/2026";
    case "opcao_unica":
      return pergunta.opcoes?.[0] ?? "";
    case "multipla_escolha":
      return (pergunta.opcoes ?? []).slice(0, 2).join(", ");
    case "numero":
      return "250";
    case "upload":
      return "arquivo-exemplo.pdf";
    case "contato_email":
      return "fernanda.costa@exemplo.com";
    case "contato_telefone":
      return "+55 62 98888-1234";
    case "contato_site":
      return "instagram.com/fernanda.costa";
    case "contato_localizacao":
      return "Goiânia, GO";
    default:
      return "";
  }
}

export default function FormulariosPage() {
  const { criarContato } = useContatos();
  const {
    formularios,
    criarFormulario,
    atualizarFormulario,
    excluirFormulario,
    adicionarPergunta,
    atualizarPergunta,
    removerPergunta,
    alternarPublicacao,
    registrarResposta,
    respostasDoFormulario,
  } = useFormularios();

  const [formularioAbertoId, setFormularioAbertoId] = useState<string | null>(
    null,
  );
  const [tipoPerguntaMenuAberto, setTipoPerguntaMenuAberto] = useState(false);
  const [modoPreview, setModoPreview] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const formularioAberto =
    formularios.find((f) => f.id === formularioAbertoId) ?? null;

  function abrirNovoFormulario() {
    const id = criarFormulario();
    setFormularioAbertoId(id);
    setModoPreview(false);
  }

  function voltarParaLista() {
    setFormularioAbertoId(null);
    setModoPreview(false);
    setTipoPerguntaMenuAberto(false);
  }

  function pedirExclusao(id: string, nome: string) {
    if (window.confirm(`Excluir o formulário "${nome}"?`)) {
      excluirFormulario(id);
      if (formularioAbertoId === id) voltarParaLista();
    }
  }

  function escolherCapa(e: React.ChangeEvent<HTMLInputElement>) {
    if (!formularioAberto) return;
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    atualizarFormulario(formularioAberto.id, {
      capaUrl: URL.createObjectURL(arquivo),
    });
  }

  function copiarLink() {
    if (!formularioAberto) return;
    const link = `azuzcrm.com/f/${formularioAberto.id}`;
    navigator.clipboard?.writeText(link);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  function atualizarOpcao(
    pergunta: PerguntaFormulario,
    indice: number,
    valor: string,
  ) {
    if (!formularioAberto) return;
    const novasOpcoes = [...(pergunta.opcoes ?? [])];
    novasOpcoes[indice] = valor;
    atualizarPergunta(formularioAberto.id, pergunta.id, { opcoes: novasOpcoes });
  }

  function removerOpcao(pergunta: PerguntaFormulario, indice: number) {
    if (!formularioAberto) return;
    atualizarPergunta(formularioAberto.id, pergunta.id, {
      opcoes: (pergunta.opcoes ?? []).filter((_, i) => i !== indice),
    });
  }

  function adicionarOpcao(pergunta: PerguntaFormulario) {
    if (!formularioAberto) return;
    const opcoes = pergunta.opcoes ?? [];
    atualizarPergunta(formularioAberto.id, pergunta.id, {
      opcoes: [...opcoes, `Opção ${opcoes.length + 1}`],
    });
  }

  function simularResposta() {
    if (!formularioAberto) return;
    const valores: Record<string, string> = {};
    let nomeContato = "";
    let emailContato: string | undefined;
    let telefoneContato: string | undefined;

    formularioAberto.perguntas.forEach((pergunta) => {
      const valor = valorSimulado(pergunta);
      valores[pergunta.id] = valor;
      if (pergunta.tipo === "texto_curto" && pergunta.rotulo.toLowerCase().includes("nome")) {
        nomeContato = valor;
      }
      if (pergunta.tipo === "contato_email") emailContato = valor;
      if (pergunta.tipo === "contato_telefone") telefoneContato = valor;
    });

    registrarResposta(formularioAberto.id, valores);
    criarContato({
      nome: nomeContato || `Resposta — ${formularioAberto.nome}`,
      email: emailContato,
      whatsapp: telefoneContato,
    });
  }

  const respostas = formularioAberto
    ? respostasDoFormulario(formularioAberto.id)
    : [];

  return (
    <>
      <Topbar
        title="Formulário"
        sub={
          formularioAberto
            ? formularioAberto.nome
            : `${formularios.length} formulários criados`
        }
        actions={
          formularioAberto ? null : (
            <button type="button" className="btn primary" onClick={abrirNovoFormulario}>
              + Criar formulário
            </button>
          )
        }
      />

      <div className="content">
        {!formularioAberto ? (
          <div className="card">
            {formularios.length === 0 ? (
              <p className="hint" style={{ padding: 24, textAlign: "center" }}>
                Nenhum formulário ainda. Clique em &quot;+ Criar formulário&quot;
                pra criar o primeiro.
              </p>
            ) : (
              formularios.map((f) => (
                <div
                  className="int-row"
                  key={f.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setFormularioAbertoId(f.id);
                    setModoPreview(false);
                  }}
                >
                  <div className="int-body">
                    <p className="int-title">{f.nome}</p>
                    <p className="int-sub">
                      {f.perguntas.length}{" "}
                      {f.perguntas.length === 1 ? "pergunta" : "perguntas"} ·{" "}
                      {respostasDoFormulario(f.id).length} respostas
                    </p>
                  </div>
                  <span
                    className={`int-status ${f.publicado ? "connected" : "off"}`}
                  >
                    {f.publicado ? "Publicado" : "Rascunho"}
                  </span>
                  <span
                    role="button"
                    aria-label={`Excluir formulário ${f.nome}`}
                    title="Excluir formulário"
                    style={{ cursor: "pointer", color: "var(--text-faint)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      pedirExclusao(f.id, f.nome);
                    }}
                  >
                    ✕
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn ghost mb14"
              onClick={voltarParaLista}
            >
              ← Voltar pros formulários
            </button>

            <div className="form-builder-layout">
              <div className="form-builder-main">
                <div className="card mb14">
                  <label className="doc-cover" style={{ margin: 17 }}>
                    {formularioAberto.capaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={formularioAberto.capaUrl} alt="" />
                    ) : (
                      <span className="doc-cover-empty">
                        + Adicionar capa
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={escolherCapa}
                    />
                  </label>
                  <div style={{ padding: "0 17px 17px" }}>
                    <input
                      className="input"
                      style={{ width: "100%", fontWeight: 700, fontSize: 16 }}
                      value={formularioAberto.nome}
                      onChange={(e) =>
                        atualizarFormulario(formularioAberto.id, {
                          nome: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="card">
                  <div className="panel-h">
                    <h4>Perguntas</h4>
                  </div>
                  {formularioAberto.perguntas.length === 0 ? (
                    <p className="hint" style={{ padding: "0 17px 14px" }}>
                      Nenhuma pergunta ainda — adicione a primeira abaixo.
                    </p>
                  ) : (
                    formularioAberto.perguntas.map((pergunta) => (
                      <div className="form-pergunta-row" key={pergunta.id}>
                        <span className="form-pergunta-tipo">
                          {labelTipoPergunta(pergunta.tipo)}
                        </span>
                        <input
                          className="input"
                          style={{ flex: 1 }}
                          value={pergunta.rotulo}
                          onChange={(e) =>
                            atualizarPergunta(formularioAberto.id, pergunta.id, {
                              rotulo: e.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          className="remove-chip"
                          aria-label="Remover pergunta"
                          onClick={() =>
                            removerPergunta(formularioAberto.id, pergunta.id)
                          }
                        >
                          ✕
                        </button>

                        {pergunta.tipo === "opcao_unica" ||
                        pergunta.tipo === "multipla_escolha" ? (
                          <div className="form-pergunta-opcoes">
                            {(pergunta.opcoes ?? []).map((op, i) => (
                              <div className="form-opcao-row" key={i}>
                                <input
                                  className="input"
                                  style={{ flex: 1 }}
                                  value={op}
                                  onChange={(e) =>
                                    atualizarOpcao(pergunta, i, e.target.value)
                                  }
                                />
                                {(pergunta.opcoes?.length ?? 0) > 1 ? (
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={() => removerOpcao(pergunta, i)}
                                  >
                                    ✕
                                  </button>
                                ) : null}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => adicionarOpcao(pergunta)}
                            >
                              + Adicionar opção
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}

                  <div
                    className="dropdown-anchor"
                    style={{ padding: 17, position: "relative" }}
                  >
                    <button
                      type="button"
                      className="btn ghost block"
                      onClick={() => setTipoPerguntaMenuAberto((v) => !v)}
                    >
                      + Adicionar pergunta
                    </button>
                    {tipoPerguntaMenuAberto ? (
                      <>
                        <div
                          onClick={() => setTipoPerguntaMenuAberto(false)}
                          style={{ position: "fixed", inset: 0, zIndex: 50 }}
                        />
                        <div
                          className="dropdown-pop"
                          style={{ maxHeight: 320, overflowY: "auto" }}
                        >
                          {GRUPOS_PERGUNTA.map((grupo) => (
                            <div key={grupo}>
                              <p className="doc-sidebar-h" style={{ padding: "8px 14px 4px" }}>
                                {grupo}
                              </p>
                              {TIPOS_PERGUNTA_FORMULARIO.filter(
                                (t) => t.grupo === grupo,
                              ).map((t) => (
                                <button
                                  type="button"
                                  key={t.tipo}
                                  className="dropdown-item"
                                  style={{ width: "100%", textAlign: "left" }}
                                  onClick={() => {
                                    adicionarPergunta(
                                      formularioAberto.id,
                                      t.tipo as TipoPerguntaFormulario,
                                    );
                                    setTipoPerguntaMenuAberto(false);
                                  }}
                                >
                                  <span className="n">{t.label}</span>
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="form-builder-side">
                <div className="card" style={{ padding: 17, marginBottom: 14 }}>
                  <div className="field" style={{ padding: 0, marginBottom: 12 }}>
                    <label>Rótulo do botão</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      value={formularioAberto.rotuloBotao}
                      onChange={(e) =>
                        atualizarFormulario(formularioAberto.id, {
                          rotuloBotao: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field" style={{ padding: 0, marginBottom: 12 }}>
                    <label>URL de redirecionamento (opcional)</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      placeholder="Ex.: https://wa.me/5562999999999"
                      value={formularioAberto.urlRedirecionamento}
                      onChange={(e) =>
                        atualizarFormulario(formularioAberto.id, {
                          urlRedirecionamento: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field" style={{ padding: 0, marginBottom: 12 }}>
                    <label>Cor de fundo</label>
                    <div className="cor-chips">
                      {CORES_FUNDO_FORMULARIO.map((c) => (
                        <button
                          type="button"
                          key={c}
                          aria-label={`Cor de fundo ${c}`}
                          className={`cor-chip${formularioAberto.corFundo === c ? " active" : ""}`}
                          style={{ background: c }}
                          onClick={() =>
                            atualizarFormulario(formularioAberto.id, {
                              corFundo: c,
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div className="field" style={{ padding: 0 }}>
                    <label>Cor do botão</label>
                    <div className="cor-chips">
                      {CORES_BOTAO_FORMULARIO.map((c) => (
                        <button
                          type="button"
                          key={c}
                          aria-label={`Cor do botão ${c}`}
                          className={`cor-chip${formularioAberto.corBotao === c ? " active" : ""}`}
                          style={{ background: c }}
                          onClick={() =>
                            atualizarFormulario(formularioAberto.id, {
                              corBotao: c,
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 17, marginBottom: 14 }}>
                  <button
                    type="button"
                    className="btn ghost block mb14"
                    onClick={() => setModoPreview((v) => !v)}
                  >
                    {modoPreview ? "Fechar pré-visualização" : "Pré-visualizar"}
                  </button>
                  {formularioAberto.publicado ? (
                    <>
                      <div className="key-row" style={{ padding: 0, marginBottom: 10 }}>
                        <div className="key-box">
                          azuzcrm.com/f/{formularioAberto.id}
                        </div>
                        <button type="button" className="btn ghost" onClick={copiarLink}>
                          {linkCopiado ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn ghost block"
                        style={{ color: "#d64545" }}
                        onClick={() => alternarPublicacao(formularioAberto.id)}
                      >
                        Remover publicação
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn primary block"
                      onClick={() => alternarPublicacao(formularioAberto.id)}
                    >
                      Publicar
                    </button>
                  )}
                </div>

                <div className="card" style={{ padding: 17 }}>
                  <p className="hint mb14">
                    Sem API pública ainda — use este botão pra simular alguém
                    respondendo (a resposta vira contato em Contatos).
                  </p>
                  <button
                    type="button"
                    className="btn ghost block"
                    onClick={simularResposta}
                    disabled={formularioAberto.perguntas.length === 0}
                  >
                    Simular resposta
                  </button>
                </div>
              </div>
            </div>

            {modoPreview ? (
              <div
                className="form-preview-overlay"
                onClick={() => setModoPreview(false)}
              >
                <div
                  className="form-preview-card"
                  style={{ background: formularioAberto.corFundo }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {formularioAberto.capaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formularioAberto.capaUrl}
                      alt=""
                      className="form-preview-cover"
                    />
                  ) : null}
                  <h2>{formularioAberto.nome}</h2>
                  {formularioAberto.perguntas.map((pergunta) => (
                    <div className="field" key={pergunta.id} style={{ padding: "10px 0" }}>
                      <label>{pergunta.rotulo}</label>
                      {pergunta.tipo === "texto_longo" ? (
                        <textarea className="input" style={{ width: "100%", minHeight: 60 }} disabled />
                      ) : pergunta.tipo === "opcao_unica" ||
                        pergunta.tipo === "multipla_escolha" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {(pergunta.opcoes ?? []).map((op, i) => (
                            <label key={i} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                              <input
                                type={
                                  pergunta.tipo === "opcao_unica" ? "radio" : "checkbox"
                                }
                                disabled
                              />
                              {op}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input className="input" style={{ width: "100%" }} disabled />
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn block"
                    style={{ background: formularioAberto.corBotao, color: "#fff", marginTop: 10 }}
                    disabled
                  >
                    {formularioAberto.rotuloBotao}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="int-group" style={{ marginTop: 24 }}>
              <p className="int-group-h">Respostas ({respostas.length})</p>
              <div className="card">
                {respostas.length === 0 ? (
                  <p className="hint" style={{ padding: 17 }}>
                    Nenhuma resposta ainda — cada resposta enviada vira
                    automaticamente um contato em Contatos.
                  </p>
                ) : (
                  respostas.map((r) => (
                    <div className="int-row" key={r.id}>
                      <div className="int-body">
                        <p className="int-title">
                          {Object.values(r.valores)[0] ?? "Resposta"}
                        </p>
                        <p className="int-sub">
                          {Object.values(r.valores).slice(1).join(" · ")}
                        </p>
                      </div>
                      <span className="hint">{r.criadoEm}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
