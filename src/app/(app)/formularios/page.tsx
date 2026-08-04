"use client";

import { useState } from "react";

import { useContatos } from "@/lib/contatos-context";
import {
  CORES_BOTAO_FORMULARIO,
  CORES_FUNDO_FORMULARIO,
  MENSAGEM_FINAL_PADRAO,
  TIPOS_PERGUNTA_FORMULARIO,
  labelTipoPergunta,
  useFormularios,
  type Formulario,
  type PerguntaFormulario,
  type RespostaFormulario,
  type TipoPerguntaFormulario,
} from "@/lib/formularios-context";
import { FloatingDropdown, Topbar } from "@/components/ui";
import { CampoResposta, PerguntaVisualizacao } from "@/components/campo-resposta";

const GRUPOS_PERGUNTA = ["Campos", "Informações de contato"];
const LIMITE_PERGUNTAS_VISIVEIS = 3;

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
    registrarResposta,
    respostasDoFormulario,
  } = useFormularios();

  const [formularioAbertoId, setFormularioAbertoId] = useState<string | null>(
    null,
  );
  const [tipoPerguntaMenuAberto, setTipoPerguntaMenuAberto] = useState(false);
  const [tipoPerguntaRect, setTipoPerguntaRect] = useState<DOMRect | null>(null);
  const [perguntaEditandoId, setPerguntaEditandoId] = useState<string | null>(null);
  const [perguntasExpandidas, setPerguntasExpandidas] = useState(false);
  const [modoRespostas, setModoRespostas] = useState(false);
  const [respostaFormularioId, setRespostaFormularioId] = useState<string | null>(
    null,
  );
  const [respostaAbertaId, setRespostaAbertaId] = useState<string | null>(null);
  const [menuLinkAberto, setMenuLinkAberto] = useState(false);
  const [menuLinkRect, setMenuLinkRect] = useState<DOMRect | null>(null);
  const [linkPrivadoCopiado, setLinkPrivadoCopiado] = useState(false);
  const [linkPublicoCopiado, setLinkPublicoCopiado] = useState(false);
  const [formularioSalvo, setFormularioSalvo] = useState(false);
  const [paginaFormulario, setPaginaFormulario] = useState<"inicial" | "final">(
    "inicial",
  );

  const formularioAberto =
    formularios.find((f) => f.id === formularioAbertoId) ?? null;

  function abrirFormulario(id: string) {
    setFormularioAbertoId(id);
    setPaginaFormulario("inicial");
  }

  function abrirNovoFormulario() {
    const id = criarFormulario();
    abrirFormulario(id);
  }

  function voltarParaLista() {
    setFormularioAbertoId(null);
    setTipoPerguntaMenuAberto(false);
    setPerguntaEditandoId(null);
    setPerguntasExpandidas(false);
    setPaginaFormulario("inicial");
  }

  function abrirRespostas() {
    setModoRespostas(true);
    setRespostaFormularioId(null);
    setRespostaAbertaId(null);
  }

  function fecharRespostas() {
    setModoRespostas(false);
    setRespostaFormularioId(null);
    setRespostaAbertaId(null);
  }

  /** Nome de quem respondeu — usa a primeira pergunta de texto curto com "nome" no rótulo. */
  function nomeResposta(
    formulario: Formulario,
    resposta: RespostaFormulario,
  ): string {
    const perguntaNome = formulario.perguntas.find(
      (p) => p.tipo === "texto_curto" && p.rotulo.toLowerCase().includes("nome"),
    );
    if (perguntaNome && resposta.valores[perguntaNome.id]) {
      return resposta.valores[perguntaNome.id];
    }
    const primeiroValor = Object.values(resposta.valores)[0];
    return primeiroValor || "Resposta sem nome";
  }

  function pedirExclusao(id: string, nome: string) {
    if (window.confirm(`Excluir o formulário "${nome}"?`)) {
      excluirFormulario(id);
      if (formularioAbertoId === id) voltarParaLista();
    }
  }

  function salvarFormulario() {
    setFormularioSalvo(true);
    setTimeout(() => setFormularioSalvo(false), 2000);
  }

  function copiarLinkPrivado() {
    if (!formularioAberto) return;
    const link = `azuzcrm.com/f/${formularioAberto.id}?chave=${
      formularioAberto.senha || "sem-senha"
    }`;
    navigator.clipboard?.writeText(link);
    setLinkPrivadoCopiado(true);
    setTimeout(() => setLinkPrivadoCopiado(false), 2000);
  }

  function copiarLinkPublico() {
    if (!formularioAberto) return;
    const link = `azuzcrm.com/f/${formularioAberto.id}`;
    navigator.clipboard?.writeText(link);
    setLinkPublicoCopiado(true);
    setTimeout(() => setLinkPublicoCopiado(false), 2000);
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

  const respostaFormulario = respostaFormularioId
    ? formularios.find((f) => f.id === respostaFormularioId) ?? null
    : null;
  const respostasDoFormularioAberto = respostaFormulario
    ? respostasDoFormulario(respostaFormulario.id)
    : [];
  const respostaAberta = respostaAbertaId
    ? respostasDoFormularioAberto.find((r) => r.id === respostaAbertaId) ?? null
    : null;

  return (
    <>
      <Topbar
        title="Formulário"
        titleActions={
          !formularioAberto ? (
            <span className="topbar-tabs">
              <button
                type="button"
                className={`topbar-tab${!modoRespostas ? " active" : ""}`}
                onClick={fecharRespostas}
              >
                Formulários
              </button>
              <button
                type="button"
                className={`topbar-tab${modoRespostas ? " active" : ""}`}
                onClick={abrirRespostas}
              >
                📋 Respostas
              </button>
            </span>
          ) : null
        }
        sub={
          modoRespostas
            ? respostaAberta && respostaFormulario
              ? `${respostaFormulario.nome} · ${nomeResposta(respostaFormulario, respostaAberta)}`
              : respostaFormulario
                ? respostaFormulario.nome
                : "Respostas — escolha um formulário"
            : formularioAberto
              ? formularioAberto.nome
              : `${formularios.length} formulários criados`
        }
        actions={
          formularioAberto ? (
            <button
              type="button"
              className="btn primary"
              onClick={salvarFormulario}
            >
              {formularioSalvo ? "✓ Formulário salvo" : "💾 Salvar formulário"}
            </button>
          ) : null
        }
      />

      <div className="content form-studio">
        {modoRespostas ? (
          <>
            {respostaAberta && respostaFormulario ? (
              <>
                <button
                  type="button"
                  className="btn ghost mb14"
                  onClick={() => setRespostaAbertaId(null)}
                >
                  ← Voltar pras respostas
                </button>
                <div className="card">
                  <div className="panel-h">
                    <h4>{nomeResposta(respostaFormulario, respostaAberta)}</h4>
                  </div>
                  {respostaFormulario.perguntas.map((pergunta) => (
                    <div className="field" key={pergunta.id}>
                      <label>{pergunta.rotulo}</label>
                      <div className="input">
                        {respostaAberta.valores[pergunta.id] || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : respostaFormulario ? (
              <>
                <button
                  type="button"
                  className="btn ghost mb14"
                  onClick={() => setRespostaFormularioId(null)}
                >
                  ← Voltar pros formulários
                </button>
                <p className="int-group-h">{respostaFormulario.nome}</p>
                <div className="card">
                  {respostasDoFormularioAberto.length === 0 ? (
                    <p className="hint" style={{ padding: 24, textAlign: "center" }}>
                      Nenhuma resposta ainda pra esse formulário.
                    </p>
                  ) : (
                    respostasDoFormularioAberto.map((r) => (
                      <div
                        className="int-row"
                        key={r.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => setRespostaAbertaId(r.id)}
                      >
                        <div className="int-body">
                          <p className="int-title">
                            {nomeResposta(respostaFormulario, r)} respondeu o formulário
                          </p>
                          <p className="int-sub">{r.criadoEm}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="int-group-h">Escolha um formulário</p>
                <div className="card">
                  {formularios.length === 0 ? (
                    <p className="hint" style={{ padding: 24, textAlign: "center" }}>
                      Nenhum formulário criado ainda.
                    </p>
                  ) : (
                    formularios.map((f) => (
                      <div
                        className="int-row"
                        key={f.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => setRespostaFormularioId(f.id)}
                      >
                        <div className="int-body">
                          <p className="int-title">{f.nome}</p>
                          <p className="int-sub">
                            {respostasDoFormulario(f.id).length} respostas
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        ) : !formularioAberto ? (
          <>
            <button
              type="button"
              className="form-scratch-card"
              onClick={abrirNovoFormulario}
            >
              <span className="form-scratch-icon">+</span>
              <span>
                <span className="form-scratch-title">
                  Criar formulário do zero
                </span>
                <span className="form-scratch-sub">
                  Escolha o título, a descrição e monte as perguntas do seu
                  jeito — nenhuma pergunta vem pronta
                </span>
              </span>
            </button>

            <p className="int-group-h" style={{ marginTop: 22 }}>
              Seus formulários
            </p>
            <div className="card">
              {formularios.length === 0 ? (
                <p className="hint" style={{ padding: 24, textAlign: "center" }}>
                  Nenhum formulário ainda — clique em &quot;Criar formulário do
                  zero&quot; acima pra criar o primeiro.
                </p>
              ) : (
                formularios.map((f) => (
                <div
                  className="int-row"
                  key={f.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => abrirFormulario(f.id)}
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
                    role="button"
                    tabIndex={0}
                    aria-label={`Excluir formulário ${f.nome}`}
                    title="Excluir formulário"
                    style={{ cursor: "pointer", color: "var(--text-faint)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      pedirExclusao(f.id, f.nome);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        pedirExclusao(f.id, f.nome);
                      }
                    }}
                  >
                    ✕
                  </span>
                </div>
              ))
              )}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn ghost mb14"
              onClick={voltarParaLista}
            >
              ← Voltar pros formulários
            </button>

            <span className="topbar-tabs mb14" style={{ display: "inline-flex" }}>
              <button
                type="button"
                className={`topbar-tab${paginaFormulario === "inicial" ? " active" : ""}`}
                onClick={() => setPaginaFormulario("inicial")}
              >
                ▷ Página inicial
              </button>
              <button
                type="button"
                className={`topbar-tab${paginaFormulario === "final" ? " active" : ""}`}
                onClick={() => setPaginaFormulario("final")}
              >
                ✓ Página final
              </button>
            </span>

            <div className="form-builder-layout">
              <div className="form-builder-main">
                {paginaFormulario === "final" ? (
                  <div className="card">
                    <div className="panel-h">
                      <h4>Página final</h4>
                    </div>
                    <p className="hint" style={{ padding: "0 17px 10px" }}>
                      É o que o cliente vê depois de enviar o formulário.
                    </p>
                    <div className="field">
                      <label>Mensagem de agradecimento</label>
                      <textarea
                        className="input"
                        style={{ width: "100%", minHeight: 90, resize: "vertical" }}
                        value={formularioAberto.mensagemFinal}
                        onChange={(e) =>
                          atualizarFormulario(formularioAberto.id, {
                            mensagemFinal: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div
                      className="form-cor-preview"
                      style={{ background: formularioAberto.corFundo, margin: "0 17px 17px" }}
                    >
                      <span className="form-cor-preview-label">Prévia da página final</span>
                      <div className="form-public-obrigado-preview">
                        <h2>{formularioAberto.mensagemFinal || MENSAGEM_FINAL_PADRAO}</h2>
                      </div>
                      <button type="button" className="btn block" disabled>
                        ✓ Enviado
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="card mb14 form-header-card">
                  <input
                    className="form-title-input"
                    value={formularioAberto.nome}
                    onChange={(e) =>
                      atualizarFormulario(formularioAberto.id, {
                        nome: e.target.value,
                      })
                    }
                    placeholder="Form"
                  />
                  <input
                    className="form-desc-input"
                    value={formularioAberto.descricao}
                    onChange={(e) =>
                      atualizarFormulario(formularioAberto.id, {
                        descricao: e.target.value,
                      })
                    }
                    placeholder="Descrição do formulário (opcional)"
                  />
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
                    (perguntasExpandidas
                      ? formularioAberto.perguntas
                      : formularioAberto.perguntas.slice(0, LIMITE_PERGUNTAS_VISIVEIS)
                    ).map((pergunta, indice) =>
                      pergunta.id === perguntaEditandoId ? (
                        <div className="form-pergunta-row" key={pergunta.id}>
                          <div className="form-pergunta-topo">
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
                              placeholder="Escreva a pergunta"
                            />
                            <label className="form-pergunta-obrigatoria">
                              <input
                                type="checkbox"
                                checked={pergunta.obrigatoria}
                                onChange={(e) =>
                                  atualizarPergunta(formularioAberto.id, pergunta.id, {
                                    obrigatoria: e.target.checked,
                                  })
                                }
                              />
                              Obrigatória
                            </label>
                            <button
                              type="button"
                              className="remove-chip"
                              aria-label="Remover pergunta"
                              onClick={() => {
                                removerPergunta(formularioAberto.id, pergunta.id);
                                setPerguntaEditandoId(null);
                              }}
                            >
                              ✕
                            </button>
                          </div>

                          <input
                            className="form-pergunta-dica-input"
                            value={pergunta.dica ?? ""}
                            onChange={(e) =>
                              atualizarPergunta(formularioAberto.id, pergunta.id, {
                                dica: e.target.value,
                              })
                            }
                            placeholder="Texto de ajuda (opcional)"
                          />

                          <div className="form-pergunta-campo">
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
                            ) : (
                              <CampoResposta pergunta={pergunta} />
                            )}
                          </div>

                          <div className="section-foot" style={{ padding: "12px 0 0" }}>
                            <button
                              type="button"
                              className="btn primary"
                              onClick={() => setPerguntaEditandoId(null)}
                            >
                              Concluir edição
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="form-pergunta-view" key={pergunta.id}>
                          <span className="form-pergunta-handle">⠿</span>
                          <div className="form-pergunta-view-body">
                            <PerguntaVisualizacao pergunta={pergunta} indice={indice + 1} />
                          </div>
                          <button
                            type="button"
                            className="form-pergunta-editar-btn"
                            onClick={() => {
                              setPerguntaEditandoId(pergunta.id);
                              setPerguntasExpandidas(true);
                            }}
                          >
                            ✎ Editar pergunta
                          </button>
                        </div>
                      ),
                    )
                  )}

                  {!perguntasExpandidas &&
                  formularioAberto.perguntas.length > LIMITE_PERGUNTAS_VISIVEIS ? (
                    <button
                      type="button"
                      className="btn ghost block"
                      style={{ margin: "0 17px 14px", width: "calc(100% - 34px)" }}
                      onClick={() => setPerguntasExpandidas(true)}
                    >
                      Ver mais (
                      {formularioAberto.perguntas.length - LIMITE_PERGUNTAS_VISIVEIS}
                      )
                    </button>
                  ) : null}
                  {perguntasExpandidas &&
                  formularioAberto.perguntas.length > LIMITE_PERGUNTAS_VISIVEIS ? (
                    <button
                      type="button"
                      className="btn ghost block"
                      style={{ margin: "0 17px 14px", width: "calc(100% - 34px)" }}
                      onClick={() => setPerguntasExpandidas(false)}
                    >
                      Ver menos
                    </button>
                  ) : null}

                  <div style={{ padding: 17 }}>
                    <button
                      type="button"
                      className="btn ghost block"
                      onClick={(e) => {
                        setTipoPerguntaRect(e.currentTarget.getBoundingClientRect());
                        setTipoPerguntaMenuAberto((v) => !v);
                      }}
                    >
                      + Adicionar pergunta
                    </button>
                    <FloatingDropdown
                      anchorRect={tipoPerguntaMenuAberto ? tipoPerguntaRect : null}
                      onClose={() => setTipoPerguntaMenuAberto(false)}
                      maxHeight={320}
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
                                const novoId = adicionarPergunta(
                                  formularioAberto.id,
                                  t.tipo as TipoPerguntaFormulario,
                                );
                                setPerguntaEditandoId(novoId);
                                setTipoPerguntaMenuAberto(false);
                              }}
                            >
                              <span className="n">{t.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </FloatingDropdown>
                  </div>
                </div>
                  </>
                )}
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

                  <div
                    className="form-cor-preview"
                    style={{ background: formularioAberto.corFundo }}
                  >
                    <span className="form-cor-preview-label">Prévia das cores</span>
                    <button
                      type="button"
                      className="btn block"
                      style={{ background: formularioAberto.corBotao, color: "#fff" }}
                      disabled
                    >
                      {formularioAberto.rotuloBotao || "Enviar"}
                    </button>
                  </div>
                </div>

                <div className="card" style={{ padding: 17, marginBottom: 14 }}>
                  <button
                    type="button"
                    className="btn ghost block mb14"
                    onClick={() =>
                      window.open(
                        `/formulario-preview?id=${formularioAberto.id}`,
                        "_blank",
                      )
                    }
                  >
                    ↗ Pré-visualizar como o cliente vê
                  </button>

                  <button
                    type="button"
                    className="btn primary block"
                    onClick={(e) => {
                      setMenuLinkRect(e.currentTarget.getBoundingClientRect());
                      setMenuLinkAberto((v) => !v);
                    }}
                  >
                    🔗 Link
                  </button>
                  <FloatingDropdown
                    anchorRect={menuLinkAberto ? menuLinkRect : null}
                    onClose={() => setMenuLinkAberto(false)}
                    align="right"
                    width={300}
                    maxHeight={480}
                    style={{ padding: 14 }}
                  >
                    <div className="form-link-box">
                      <p className="form-link-h">🔒 Link privado, com senha</p>
                      <p className="hint" style={{ marginBottom: 10 }}>
                        Só quem tiver a senha consegue abrir.
                      </p>
                      <div className="field" style={{ padding: 0, marginBottom: 10 }}>
                        <label>Senha de acesso</label>
                        <input
                          className="input"
                          style={{ width: "100%" }}
                          value={formularioAberto.senha}
                          onChange={(e) =>
                            atualizarFormulario(formularioAberto.id, {
                              senha: e.target.value,
                            })
                          }
                          placeholder="Ex.: vitta2026"
                        />
                      </div>
                      <div className="key-row" style={{ padding: 0 }}>
                        <div className="key-box">
                          azuzcrm.com/f/{formularioAberto.id}?chave=
                          {formularioAberto.senha || "•••"}
                        </div>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={copiarLinkPrivado}
                        >
                          {linkPrivadoCopiado ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>

                    <div className="form-link-box">
                      <p className="form-link-h">🌐 Link público</p>
                      <p className="hint" style={{ marginBottom: 10 }}>
                        Qualquer pessoa pode abrir, sem senha.
                      </p>
                      <div className="key-row" style={{ padding: 0 }}>
                        <div className="key-box">
                          azuzcrm.com/f/{formularioAberto.id}
                        </div>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={copiarLinkPublico}
                        >
                          {linkPublicoCopiado ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  </FloatingDropdown>
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
                          {nomeResposta(formularioAberto, r)} respondeu o formulário
                        </p>
                        <p className="int-sub">{r.criadoEm}</p>
                      </div>
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
