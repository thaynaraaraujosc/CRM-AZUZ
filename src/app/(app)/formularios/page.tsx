"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useContatos } from "@/lib/contatos-context";
import { useFunis } from "@/lib/funis-context";
import { useEquipe } from "@/lib/equipe-context";
import { IconAnexo, IconCadeado, IconClose, IconGlobo, IconOlho, IconOlhoFechado } from "@/components/icons";
import {
  CAMPOS_CRM_MAPEAVEIS,
  CATEGORIAS_CAMPO,
  CORES_TEMA_FORMULARIO,
  MENSAGEM_FINAL_PADRAO,
  OPERADORES_LOGICA,
  TIPOS_CAMPO_FORMULARIO,
  TIPOS_LAYOUT,
  TIPOS_UPLOAD,
  labelTipoCampo,
  useFormularios,
  type Formulario,
  type LogicaCampo,
  type PaginaFormulario,
  type PerguntaFormulario,
  type RespostaFormulario,
} from "@/lib/formularios-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { Modal, Topbar } from "@/components/ui";
import { PerguntaVisualizacao } from "@/components/campo-resposta";
import { LogicaCanvas } from "@/components/formularios/LogicaCanvas";

type AbaBuilder = "editar" | "design" | "respostas";
type Dispositivo = "desktop" | "tablet" | "celular";

const LARGURAS_DISPOSITIVO: Record<Dispositivo, number> = {
  desktop: 760,
  tablet: 500,
  celular: 360,
};

/** Um valor de exemplo plausível por tipo de campo, pra simular uma resposta sem digitar tudo. */
function valorSimulado(pergunta: PerguntaFormulario): string {
  switch (pergunta.tipo) {
    case "texto_curto":
      return pergunta.rotulo.toLowerCase().includes("nome") ? "Fernanda Costa" : "Resposta de exemplo";
    case "texto_longo":
      return "Resposta longa de exemplo, preenchida pra simular o envio.";
    case "numero":
      return "250";
    case "moeda":
      return "1500,00";
    case "data":
      return "2026-08-15";
    case "hora":
      return "14:30";
    case "data_hora":
      return "2026-08-15T14:30";
    case "lista_suspensa":
    case "opcao_unica":
      return pergunta.opcoes?.[0] ?? "";
    case "multipla_escolha":
      return (pergunta.opcoes ?? []).slice(0, 2).join(",");
    case "checkbox":
      return "sim";
    case "sim_nao":
      return "Sim";
    case "avaliacao":
      return "5";
    case "nota":
      return "9";
    case "arquivo":
    case "imagem":
      return "arquivo-exemplo.pdf";
    case "email":
      return "fernanda.costa@exemplo.com";
    case "telefone":
      return "+55 62 98888-1234";
    case "cpf":
      return "123.456.789-00";
    case "cnpj":
      return "12.345.678/0001-90";
    case "url":
      return "instagram.com/fernanda.costa";
    case "contato":
    case "responsavel":
      return "";
    default:
      return "";
  }
}

/** Todas as perguntas do formulário, na ordem, com um número de exibição — blocos de layout não contam. */
function perguntasNumeradas(formulario: Formulario): { pergunta: PerguntaFormulario; numero: number }[] {
  const lista: { pergunta: PerguntaFormulario; numero: number }[] = [];
  let numero = 0;
  for (const pagina of formulario.paginas) {
    for (const pergunta of pagina.perguntas) {
      if (!TIPOS_LAYOUT.includes(pergunta.tipo)) numero += 1;
      lista.push({ pergunta, numero });
    }
  }
  return lista;
}

/** Nome de quem respondeu — usa a primeira pergunta mapeada pro campo "nome" do contato. */
function nomeResposta(formulario: Formulario, resposta: RespostaFormulario): string {
  const todasPerguntas = formulario.paginas.flatMap((p) => p.perguntas);
  const perguntaNome = todasPerguntas.find((p) => p.mapeamentoCrm === "nome");
  if (perguntaNome && resposta.valores[perguntaNome.id]) return resposta.valores[perguntaNome.id];
  const primeiroValor = Object.values(resposta.valores)[0];
  return primeiroValor || "Resposta sem nome";
}

function SecaoPainel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="form-painel-secao">
      <p className="form-painel-secao-h">{titulo}</p>
      {children}
    </div>
  );
}

export default function FormulariosPage() {
  const { criarContato } = useContatos();
  const {
    formularios,
    criarFormulario,
    duplicarFormulario,
    atualizarFormulario,
    excluirFormulario,
    alternarPublicacao,
    restaurarVersaoFormulario,
    adicionarPagina,
    duplicarPagina,
    atualizarPagina,
    excluirPagina,
    reordenarPagina,
    adicionarPergunta,
    duplicarPergunta,
    atualizarPergunta,
    removerPergunta,
    reordenarPergunta,
    registrarResposta,
    respostasDoFormulario,
  } = useFormularios();

  const [formularioAbertoId, setFormularioAbertoId] = useState<string | null>(null);
  const [abaBuilder, setAbaBuilder] = useState<AbaBuilder>("editar");
  const [paginaAtivaId, setPaginaAtivaId] = useState<string | null>(null);
  const [campoSelecionadoId, setCampoSelecionadoId] = useState<string | null>(null);

  const [paginaArrastando, setPaginaArrastando] = useState<number | null>(null);
  const [campoArrastando, setCampoArrastando] = useState<number | null>(null);

  const [menuAdicionarAberto, setMenuAdicionarAberto] = useState(false);
  const [menuAdicionarRect, setMenuAdicionarRect] = useState<AnchorRect | null>(null);
  const { ref: menuAdicionarRef, posicao: menuAdicionarPos } = useFloatingPosition(menuAdicionarRect, menuAdicionarAberto, 8, () => setMenuAdicionarAberto(false));

  const [menuCompartilharAberto, setMenuCompartilharAberto] = useState(false);
  const [menuCompartilharRect, setMenuCompartilharRect] = useState<AnchorRect | null>(null);
  const { ref: menuCompartilharRef, posicao: menuCompartilharPos } = useFloatingPosition(menuCompartilharRect, menuCompartilharAberto, 8, () => setMenuCompartilharAberto(false));
  const [linkPrivadoCopiado, setLinkPrivadoCopiado] = useState(false);
  const [linkPublicoCopiado, setLinkPublicoCopiado] = useState(false);

  const [previewAberto, setPreviewAberto] = useState(false);
  const [previewDispositivo, setPreviewDispositivo] = useState<Dispositivo>("desktop");

  const [respostaAbertaId, setRespostaAbertaId] = useState<string | null>(null);

  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  function avisar(texto: string) {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }

  const formularioAberto = formularios.find((f) => f.id === formularioAbertoId) ?? null;
  const paginaAtiva = formularioAberto?.paginas.find((p) => p.id === paginaAtivaId) ?? formularioAberto?.paginas[0] ?? null;
  const campoSelecionado = paginaAtiva?.perguntas.find((p) => p.id === campoSelecionadoId) ?? null;

  const numerosPergunta = formularioAberto ? perguntasNumeradas(formularioAberto) : [];

  /** Campos anteriores a este (todas as páginas antes + os anteriores na mesma página), pra montar as regras de lógica. */
  function camposDisponiveisParaLogica(paginaId: string, perguntaId?: string) {
    if (!formularioAberto) return [];
    const disponveis: PerguntaFormulario[] = [];
    for (const pagina of formularioAberto.paginas) {
      for (const pergunta of pagina.perguntas) {
        if (pergunta.id === perguntaId) return disponveis;
        if (TIPOS_LAYOUT.includes(pergunta.tipo)) continue;
        disponveis.push(pergunta);
      }
      if (pagina.id === paginaId && !perguntaId) return disponveis;
    }
    return disponveis;
  }

  function abrirFormulario(id: string, aba: AbaBuilder = "editar") {
    const f = formularios.find((x) => x.id === id);
    setFormularioAbertoId(id);
    setAbaBuilder(aba);
    setPaginaAtivaId(f?.paginas[0]?.id ?? null);
    setCampoSelecionadoId(null);
  }

  function abrirNovoFormulario() {
    const id = criarFormulario();
    abrirFormulario(id);
  }

  function voltarParaLista() {
    setFormularioAbertoId(null);
    setCampoSelecionadoId(null);
  }

  function pedirExclusao(id: string, nome: string) {
    if (window.confirm(`Excluir o formulário "${nome}"? Isso também apaga as respostas dele.`)) {
      excluirFormulario(id);
      if (formularioAbertoId === id) voltarParaLista();
      avisar("Formulário excluído.");
    }
  }

  function copiarLinkPrivado() {
    if (!formularioAberto) return;
    const link = `azuzcrm.com/f/${formularioAberto.id}?chave=${formularioAberto.senha || "sem-senha"}`;
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

  function simularResposta() {
    if (!formularioAberto) return;
    const todasPerguntas = formularioAberto.paginas.flatMap((p) => p.perguntas).filter((p) => !TIPOS_LAYOUT.includes(p.tipo));
    if (todasPerguntas.length === 0) return;
    const valores: Record<string, string> = {};
    const dadosContato: Record<string, string> = {};
    todasPerguntas.forEach((pergunta) => {
      const valor = valorSimulado(pergunta);
      valores[pergunta.id] = valor;
      if (pergunta.mapeamentoCrm && valor) dadosContato[pergunta.mapeamentoCrm] = valor;
    });
    registrarResposta(formularioAberto.id, valores);
    criarContato({
      nome: dadosContato.nome || `Resposta — ${formularioAberto.nome}`,
      email: dadosContato.email,
      whatsapp: dadosContato.whatsapp,
      empresa: dadosContato.empresa,
      cidade: dadosContato.cidade,
      estado: dadosContato.estado,
    });
    avisar("Resposta simulada — contato criado em Contatos.");
  }

  const respostas = formularioAberto ? respostasDoFormulario(formularioAberto.id) : [];
  const respostaAberta = respostaAbertaId ? respostas.find((r) => r.id === respostaAbertaId) ?? null : null;

  // ---- Drag and drop: páginas -------------------------------------------------
  function onDropPagina(indiceDestino: number) {
    if (!formularioAberto || paginaArrastando === null) return;
    reordenarPagina(formularioAberto.id, paginaArrastando, indiceDestino);
    setPaginaArrastando(null);
  }

  // ---- Drag and drop: campos ---------------------------------------------------
  function onDropCampo(indiceDestino: number) {
    if (!formularioAberto || !paginaAtiva || campoArrastando === null) return;
    reordenarPergunta(formularioAberto.id, paginaAtiva.id, campoArrastando, indiceDestino);
    setCampoArrastando(null);
  }

  return (
    <>
      {!formularioAberto ? (
        <>
          <Topbar title="Formulários" sub={`${formularios.length} formulário(s) criado(s)`} />
          <div className="content">
            <button type="button" className="form-scratch-card" onClick={abrirNovoFormulario}>
              <span className="form-scratch-icon">+</span>
              <span>
                <span className="form-scratch-title">Criar formulário do zero</span>
                <span className="form-scratch-sub">
                  Monte páginas, campos e lógica do seu jeito — como um construtor profissional.
                </span>
              </span>
            </button>

            <p className="int-group-h" style={{ marginTop: 22 }}>
              Seus formulários
            </p>
            <div className="card">
              {formularios.length === 0 ? (
                <p className="hint" style={{ padding: 24, textAlign: "center" }}>
                  Nenhum formulário ainda — clique em &quot;Criar formulário do zero&quot; acima pra criar o primeiro.
                </p>
              ) : (
                formularios.map((f) => {
                  const totalPerguntas = f.paginas.reduce(
                    (soma, p) => soma + p.perguntas.filter((q) => !TIPOS_LAYOUT.includes(q.tipo)).length,
                    0,
                  );
                  return (
                    <div className="int-row" key={f.id} style={{ cursor: "pointer" }} onClick={() => abrirFormulario(f.id)}>
                      <div className="int-body">
                        <p className="int-title">
                          {f.nome}
                          <span className={`pill${f.status === "publicado" ? " on" : ""}`} style={{ marginLeft: 8 }}>
                            {f.status === "publicado" ? "Publicado" : "Rascunho"}
                          </span>
                        </p>
                        <p className="int-sub">
                          {f.paginas.length} {f.paginas.length === 1 ? "página" : "páginas"} · {totalPerguntas}{" "}
                          {totalPerguntas === 1 ? "pergunta" : "perguntas"} · {respostasDoFormulario(f.id).length} respostas
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
                        <IconClose width={11} height={11} />
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="form-builder-topbar">
            <button type="button" className="btn ghost" onClick={voltarParaLista}>
              ← Formulários
            </button>
            <input
              className="form-builder-nome-input"
              value={formularioAberto.nome}
              onChange={(e) => atualizarFormulario(formularioAberto.id, { nome: e.target.value })}
              placeholder="Nome do formulário"
            />
            <span className={`pill${formularioAberto.status === "publicado" ? " on" : ""}`}>
              {formularioAberto.status === "publicado" ? "Publicado" : "Rascunho"}
            </span>

            <span className="topbar-tabs" style={{ marginLeft: 8 }}>
              <button type="button" className={`topbar-tab${abaBuilder === "editar" ? " active" : ""}`} onClick={() => setAbaBuilder("editar")}>
                Editar
              </button>
              <button type="button" className={`topbar-tab${abaBuilder === "design" ? " active" : ""}`} onClick={() => setAbaBuilder("design")}>
                Design
              </button>
              <button type="button" className={`topbar-tab${abaBuilder === "respostas" ? " active" : ""}`} onClick={() => setAbaBuilder("respostas")}>
                Respostas ({respostas.length})
              </button>
            </span>

            <div className="form-builder-topbar-acoes">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const novoId = duplicarFormulario(formularioAberto.id);
                  avisar("Formulário duplicado.");
                  abrirFormulario(novoId);
                }}
              >
                Duplicar
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setMenuCompartilharRect((document.activeElement as HTMLElement)?.getBoundingClientRect() ?? null);
                  setMenuCompartilharAberto((v) => !v);
                }}
              >
                Compartilhar
              </button>
              <button type="button" className="btn ghost" onClick={() => setPreviewAberto(true)}>
                Pré-visualizar
              </button>
              <button
                type="button"
                className={`btn ${formularioAberto.status === "publicado" ? "ghost" : "primary"}`}
                onClick={() => {
                  alternarPublicacao(formularioAberto.id);
                  avisar(formularioAberto.status === "publicado" ? "Formulário voltou pra rascunho." : "Formulário publicado — o link já responde.");
                }}
              >
                {formularioAberto.status === "publicado" ? "Despublicar" : "Publicar"}
              </button>
            </div>
          </div>

          {menuCompartilharAberto && menuCompartilharPos && typeof document !== "undefined"
            ? createPortal(
                <>
                  <div onClick={() => setMenuCompartilharAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 190 }} />
                  <div
                    ref={menuCompartilharRef}
                    className="dropdown-pop"
                    style={{ position: "fixed", top: menuCompartilharPos.top, left: menuCompartilharPos.left, zIndex: 200, width: 300, padding: 14 }}
                  >
                    {formularioAberto.status !== "publicado" ? (
                      <p className="hint">Publique o formulário pra habilitar o link de compartilhamento.</p>
                    ) : (
                      <>
                        <div className="form-link-box">
                          <p className="form-link-h" style={{ display: "flex", alignItems: "center", gap: 6 }}><IconCadeado width={13} height={13} /> Link privado, com senha</p>
                          <div className="field" style={{ padding: 0, marginBottom: 10 }}>
                            <label>Senha de acesso</label>
                            <input
                              className="input"
                              style={{ width: "100%" }}
                              value={formularioAberto.senha ?? ""}
                              onChange={(e) => atualizarFormulario(formularioAberto.id, { senha: e.target.value })}
                              placeholder="Ex.: vitta2026"
                            />
                          </div>
                          <div className="key-row" style={{ padding: 0 }}>
                            <div className="key-box">
                              azuzcrm.com/f/{formularioAberto.id}?chave={formularioAberto.senha || "•••"}
                            </div>
                            <button type="button" className="btn ghost" onClick={copiarLinkPrivado}>
                              {linkPrivadoCopiado ? "Copiado!" : "Copiar"}
                            </button>
                          </div>
                        </div>
                        <div className="form-link-box">
                          <p className="form-link-h" style={{ display: "flex", alignItems: "center", gap: 6 }}><IconGlobo width={13} height={13} /> Link público</p>
                          <div className="key-row" style={{ padding: 0 }}>
                            <div className="key-box">azuzcrm.com/f/{formularioAberto.id}</div>
                            <button type="button" className="btn ghost" onClick={copiarLinkPublico}>
                              {linkPublicoCopiado ? "Copiado!" : "Copiar"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>,
                document.body,
              )
            : null}

          <div className="content">
            {abaBuilder === "respostas" ? (
              respostaAberta ? (
                <>
                  <button type="button" className="btn ghost mb14" onClick={() => setRespostaAbertaId(null)}>
                    ← Voltar pras respostas
                  </button>
                  <div className="card">
                    <div className="panel-h">
                      <h4>{nomeResposta(formularioAberto, respostaAberta)}</h4>
                    </div>
                    {formularioAberto.paginas.flatMap((p) => p.perguntas).filter((q) => !TIPOS_LAYOUT.includes(q.tipo)).map((pergunta) => {
                      const valor = respostaAberta.valores[pergunta.id];
                      // Campos de upload guardam "nomeDoArquivo|data:...;base64,..." (ver
                      // campo-resposta.tsx) — mostra o nome com um link real pra abrir/baixar o
                      // arquivo, em vez de despejar o base64 inteiro como texto.
                      const ehUpload = TIPOS_UPLOAD.includes(pergunta.tipo);
                      const [nomeArquivo, urlArquivo] = ehUpload && valor ? valor.split("|") : [undefined, undefined];
                      return (
                        <div className="field" key={pergunta.id}>
                          <label>{pergunta.rotulo}</label>
                          {ehUpload && urlArquivo ? (
                            <a className="input" href={urlArquivo} download={nomeArquivo} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <IconAnexo width={13} height={13} /> {nomeArquivo}
                            </a>
                          ) : (
                            <div className="input">{ehUpload ? "—" : valor || "—"}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="card">
                  {respostas.length === 0 ? (
                    <p className="hint" style={{ padding: 24, textAlign: "center" }}>
                      Nenhuma resposta ainda — publique o formulário e compartilhe o link, ou use &quot;Simular resposta&quot; na aba Editar.
                    </p>
                  ) : (
                    respostas.map((r) => (
                      <div className="int-row" key={r.id} style={{ cursor: "pointer" }} onClick={() => setRespostaAbertaId(r.id)}>
                        <div className="int-body">
                          <p className="int-title">{nomeResposta(formularioAberto, r)} respondeu o formulário</p>
                          <p className="int-sub">{new Date(r.criadoEm).toLocaleString("pt-BR")}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )
            ) : abaBuilder === "design" ? (
              <PainelDesign
                formulario={formularioAberto}
                onAtualizar={(patch) => atualizarFormulario(formularioAberto.id, patch)}
                onRestaurarVersao={(versaoId) => restaurarVersaoFormulario(formularioAberto.id, versaoId)}
              />
            ) : (
              <div className="form-builder-4areas">
                <div className="form-builder-paginas">
                  <p className="form-painel-secao-h" style={{ padding: "12px 14px 6px" }}>
                    Páginas
                  </p>
                  {formularioAberto.paginas.map((pagina, indice) => (
                    <div
                      key={pagina.id}
                      className={`form-pagina-item${pagina.id === paginaAtiva?.id ? " active" : ""}${paginaArrastando === indice ? " arrastando" : ""}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDropPagina(indice);
                      }}
                    >
                      <span
                        className="form-pagina-handle"
                        draggable
                        onDragStart={() => setPaginaArrastando(indice)}
                        onDragEnd={() => setPaginaArrastando(null)}
                        title="Arraste pra reordenar"
                      >
                        ⠿
                      </span>
                      <button
                        type="button"
                        className="form-pagina-btn"
                        onClick={() => {
                          setPaginaAtivaId(pagina.id);
                          setCampoSelecionadoId(null);
                        }}
                      >
                        {pagina.titulo || `Página ${indice + 1}`}
                        <span className="form-pagina-count">{pagina.perguntas.length}</span>
                      </button>
                      <span className="form-pagina-acoes">
                        <button
                          type="button"
                          className="form-pagina-acao-btn"
                          title="Duplicar página"
                          onClick={() => duplicarPagina(formularioAberto.id, pagina.id)}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="form-pagina-acao-btn"
                          title="Excluir página"
                          disabled={formularioAberto.paginas.length <= 1}
                          onClick={() => {
                            if (formularioAberto.paginas.length <= 1) return;
                            if (window.confirm(`Excluir "${pagina.titulo}"?`)) {
                              excluirPagina(formularioAberto.id, pagina.id);
                              if (paginaAtiva?.id === pagina.id) setPaginaAtivaId(null);
                            }
                          }}
                        >
                          <IconClose width={11} height={11} />
                        </button>
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn ghost block"
                    style={{ margin: "8px 12px" }}
                    onClick={() => {
                      const novaId = adicionarPagina(formularioAberto.id);
                      setPaginaAtivaId(novaId);
                      setCampoSelecionadoId(null);
                    }}
                  >
                    + Adicionar página
                  </button>
                </div>

                <div className="form-builder-canvas" onClick={() => setCampoSelecionadoId(null)}>
                  {paginaAtiva ? (
                    <div className="form-canvas-folha" onClick={(e) => e.stopPropagation()}>
                      {paginaAtiva.perguntas.length === 0 ? (
                        <p className="hint" style={{ padding: "40px 0", textAlign: "center" }}>
                          Página vazia — adicione o primeiro campo abaixo.
                        </p>
                      ) : (
                        paginaAtiva.perguntas.map((pergunta, indice) => {
                          const numero = numerosPergunta.find((n) => n.pergunta.id === pergunta.id)?.numero ?? 0;
                          return (
                            <div
                              key={pergunta.id}
                              className={`form-campo-card${pergunta.id === campoSelecionadoId ? " selecionado" : ""}${pergunta.oculta ? " oculto" : ""}${campoArrastando === indice ? " arrastando" : ""}`}
                              draggable
                              onDragStart={() => setCampoArrastando(indice)}
                              onDragEnd={() => setCampoArrastando(null)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDropCampo(indice);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCampoSelecionadoId(pergunta.id);
                              }}
                            >
                              <span className="form-campo-handle" title="Arraste pra reordenar">
                                ⠿
                              </span>
                              <div className="form-campo-corpo">
                                <PerguntaVisualizacao pergunta={pergunta} indice={numero} />
                              </div>
                              <div className="form-campo-acoes">
                                <button
                                  type="button"
                                  title="Editar"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCampoSelecionadoId(pergunta.id);
                                  }}
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  title="Duplicar"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicarPergunta(formularioAberto.id, paginaAtiva.id, pergunta.id);
                                  }}
                                >
                                  ⧉
                                </button>
                                <button
                                  type="button"
                                  title={pergunta.obrigatoria ? "Tornar opcional" : "Tornar obrigatório"}
                                  className={pergunta.obrigatoria ? "on" : ""}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    atualizarPergunta(formularioAberto.id, paginaAtiva.id, pergunta.id, { obrigatoria: !pergunta.obrigatoria });
                                  }}
                                >
                                  *
                                </button>
                                <button
                                  type="button"
                                  title={pergunta.oculta ? "Mostrar campo" : "Ocultar campo"}
                                  className={pergunta.oculta ? "on" : ""}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    atualizarPergunta(formularioAberto.id, paginaAtiva.id, pergunta.id, { oculta: !pergunta.oculta });
                                  }}
                                >
                                  {pergunta.oculta ? <IconOlhoFechado width={13} height={13} /> : <IconOlho width={13} height={13} />}
                                </button>
                                <button
                                  type="button"
                                  title="Excluir"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removerPergunta(formularioAberto.id, paginaAtiva.id, pergunta.id);
                                    if (campoSelecionadoId === pergunta.id) setCampoSelecionadoId(null);
                                  }}
                                >
                                  <IconClose width={11} height={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      <button
                        type="button"
                        className="btn ghost block"
                        style={{ marginTop: 14 }}
                        onClick={(e) => {
                          setMenuAdicionarRect(e.currentTarget.getBoundingClientRect());
                          setMenuAdicionarAberto((v) => !v);
                        }}
                      >
                        + Adicionar campo
                      </button>
                    </div>
                  ) : (
                    <p className="hint" style={{ padding: 40, textAlign: "center" }}>
                      Escolha uma página à esquerda.
                    </p>
                  )}
                </div>

                <div className="form-builder-painel-direito">
                  {campoSelecionado && paginaAtiva ? (
                    <PainelCampo
                      pergunta={campoSelecionado}
                      camposAnteriores={camposDisponiveisParaLogica(paginaAtiva.id, campoSelecionado.id)}
                      onAtualizar={(patch) => atualizarPergunta(formularioAberto.id, paginaAtiva.id, campoSelecionado.id, patch)}
                    />
                  ) : paginaAtiva ? (
                    <PainelPagina
                      pagina={paginaAtiva}
                      camposAnteriores={camposDisponiveisParaLogica(paginaAtiva.id)}
                      onAtualizar={(patch) => atualizarPagina(formularioAberto.id, paginaAtiva.id, patch)}
                    />
                  ) : (
                    <p className="hint" style={{ padding: 20 }}>
                      Nada selecionado.
                    </p>
                  )}
                </div>
              </div>
            )}

            {abaBuilder === "editar" ? (
              <div className="card mt14" style={{ padding: 17 }}>
                <p className="hint mb14">Sem API pública ainda — use este botão pra simular alguém respondendo (vira contato em Contatos).</p>
                <button type="button" className="btn ghost block" onClick={simularResposta}>
                  Simular resposta
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}

      {menuAdicionarAberto && menuAdicionarPos && paginaAtiva && formularioAberto && typeof document !== "undefined"
        ? createPortal(
            <>
              <div onClick={() => setMenuAdicionarAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 190 }} />
              <div
                ref={menuAdicionarRef}
                className="dropdown-pop"
                style={{ position: "fixed", top: menuAdicionarPos.top, left: menuAdicionarPos.left, zIndex: 200, width: 300, maxHeight: 420, overflowY: "auto" }}
              >
                {CATEGORIAS_CAMPO.map(({ categoria, label }) => (
                  <div key={categoria}>
                    <p className="doc-sidebar-h" style={{ padding: "8px 14px 4px" }}>
                      {label}
                    </p>
                    {TIPOS_CAMPO_FORMULARIO.filter((t) => t.categoria === categoria).map((t) => (
                      <button
                        type="button"
                        key={t.tipo}
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          const novoId = adicionarPergunta(formularioAberto.id, paginaAtiva.id, t.tipo);
                          setCampoSelecionadoId(novoId);
                          setMenuAdicionarAberto(false);
                        }}
                      >
                        <span className="n">{t.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}

      <Modal aberto={previewAberto} onFechar={() => setPreviewAberto(false)} titulo="Pré-visualização" largura={900}>
        {formularioAberto && paginaAtiva ? (
          <>
            <div className="filters-row mb14">
              {(["desktop", "tablet", "celular"] as Dispositivo[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`fchip${previewDispositivo === d ? " active" : ""}`}
                  onClick={() => setPreviewDispositivo(d)}
                >
                  {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablet" : "Celular"}
                </button>
              ))}
              <button
                type="button"
                className="btn ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => window.open(`/formulario-preview?id=${formularioAberto.id}`, "_blank")}
              >
                ↗ Abrir em nova aba
              </button>
            </div>
            <div
              className="form-preview-viewport"
              style={{ maxWidth: LARGURAS_DISPOSITIVO[previewDispositivo], background: formularioAberto.tema.corPrincipal }}
            >
              <h2 style={{ marginBottom: formularioAberto.descricao ? 4 : 14 }}>{formularioAberto.nome}</h2>
              {formularioAberto.descricao ? <p className="hint" style={{ marginBottom: 14 }}>{formularioAberto.descricao}</p> : null}
              <h4 style={{ marginBottom: 8 }}>{paginaAtiva.titulo}</h4>
              {paginaAtiva.perguntas
                .filter((p) => !p.oculta)
                .map((pergunta) => {
                  const numero = numerosPergunta.find((n) => n.pergunta.id === pergunta.id)?.numero ?? 0;
                  return (
                    <div key={pergunta.id} style={{ padding: "10px 0" }}>
                      <PerguntaVisualizacao pergunta={pergunta} indice={numero} />
                    </div>
                  );
                })}
              <button type="button" className="btn block" style={{ background: formularioAberto.tema.corBotao, color: "#fff", marginTop: 10 }} disabled>
                Enviar
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      {toasts.length > 0 ? (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              {t.texto}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function PainelPagina({
  pagina,
  camposAnteriores,
  onAtualizar,
}: {
  pagina: PaginaFormulario;
  camposAnteriores: PerguntaFormulario[];
  onAtualizar: (patch: Partial<PaginaFormulario>) => void;
}) {
  return (
    <>
      <p className="hint" style={{ padding: "14px 14px 0" }}>
        Nada selecionado — configurando a página.
      </p>
      <SecaoPainel titulo="Geral">
        <div className="field">
          <label>Título da página</label>
          <input className="input" style={{ width: "100%" }} value={pagina.titulo} onChange={(e) => onAtualizar({ titulo: e.target.value })} />
        </div>
        <div className="field">
          <label>Descrição (opcional)</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 60, resize: "vertical" }}
            value={pagina.descricao ?? ""}
            onChange={(e) => onAtualizar({ descricao: e.target.value })}
          />
        </div>
      </SecaoPainel>
      <SecaoPainel titulo="Condição de exibir">
        {camposAnteriores.length === 0 ? (
          <p className="hint">Só é possível condicionar uma página à resposta de um campo de uma página anterior.</p>
        ) : (
          <>
            <div className="field">
              <label>Mostrar esta página só se</label>
              <select
                className="input"
                style={{ width: "100%" }}
                value={pagina.condicao?.campoId ?? ""}
                onChange={(e) =>
                  onAtualizar({
                    condicao: e.target.value ? { campoId: e.target.value, operador: "igual", valor: "" } : undefined,
                  })
                }
              >
                <option value="">Sempre mostrar</option>
                {camposAnteriores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.rotulo || labelTipoCampo(c.tipo)}
                  </option>
                ))}
              </select>
            </div>
            {pagina.condicao ? (
              <div className="filters-row">
                <select
                  className="input"
                  value={pagina.condicao.operador}
                  onChange={(e) => onAtualizar({ condicao: { ...pagina.condicao!, operador: e.target.value as typeof pagina.condicao.operador } })}
                >
                  {OPERADORES_LOGICA.map((o) => (
                    <option key={o.operador} value={o.operador}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {pagina.condicao.operador !== "preenchido" && pagina.condicao.operador !== "vazio" ? (
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={pagina.condicao.valor ?? ""}
                    onChange={(e) => onAtualizar({ condicao: { ...pagina.condicao!, valor: e.target.value } })}
                    placeholder="Valor"
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </SecaoPainel>
    </>
  );
}

function PainelCampo({
  pergunta,
  camposAnteriores,
  onAtualizar,
}: {
  pergunta: PerguntaFormulario;
  camposAnteriores: PerguntaFormulario[];
  onAtualizar: (patch: Partial<PerguntaFormulario>) => void;
}) {
  const ehLayout = TIPOS_LAYOUT.includes(pergunta.tipo);
  const comOpcoes = pergunta.tipo === "lista_suspensa" || pergunta.tipo === "opcao_unica" || pergunta.tipo === "multipla_escolha";
  const comMinMax = pergunta.tipo === "numero" || pergunta.tipo === "texto_curto" || pergunta.tipo === "texto_longo";
  const categoriaCampo = TIPOS_CAMPO_FORMULARIO.find((t) => t.tipo === pergunta.tipo)?.categoria;
  const comMascara = categoriaCampo === "texto" && !["texto_longo", "email", "url", "senha"].includes(pergunta.tipo);
  const comRegex = categoriaCampo === "texto";
  const logica: LogicaCampo = pergunta.logica ?? { modo: "mostrar_se", regras: [] };

  return (
    <>
      <p className="hint" style={{ padding: "14px 14px 0" }}>
        {labelTipoCampo(pergunta.tipo)}
      </p>

      <SecaoPainel titulo="Geral">
        <div className="field">
          <label>{ehLayout ? "Texto" : "Rótulo"}</label>
          <input className="input" style={{ width: "100%" }} value={pergunta.rotulo} onChange={(e) => onAtualizar({ rotulo: e.target.value })} />
        </div>
        {pergunta.tipo === "imagem_bloco" ? (
          <div className="field">
            <label>URL da imagem</label>
            <input
              className="input"
              style={{ width: "100%" }}
              value={pergunta.placeholder ?? ""}
              onChange={(e) => onAtualizar({ placeholder: e.target.value })}
              placeholder="https://…"
            />
          </div>
        ) : null}
        {!ehLayout ? (
          <>
            <div className="field">
              <label>Descrição (opcional)</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 50, resize: "vertical" }}
                value={pergunta.descricao ?? ""}
                onChange={(e) => onAtualizar({ descricao: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Placeholder</label>
              <input
                className="input"
                style={{ width: "100%" }}
                value={pergunta.placeholder ?? ""}
                onChange={(e) => onAtualizar({ placeholder: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valor padrão</label>
              <input
                className="input"
                style={{ width: "100%" }}
                value={pergunta.valorPadrao ?? ""}
                onChange={(e) => onAtualizar({ valorPadrao: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Texto de ajuda</label>
              <input
                className="input"
                style={{ width: "100%" }}
                value={pergunta.textoAjuda ?? ""}
                onChange={(e) => onAtualizar({ textoAjuda: e.target.value })}
              />
            </div>
            <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={pergunta.obrigatoria} onChange={(e) => onAtualizar({ obrigatoria: e.target.checked })} />
              Obrigatório
            </label>
          </>
        ) : null}
      </SecaoPainel>

      {comOpcoes ? (
        <SecaoPainel titulo="Opções">
          {(pergunta.opcoes ?? []).map((op, i) => (
            <div className="filters-row" key={i} style={{ marginBottom: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={op}
                onChange={(e) => {
                  const novas = [...(pergunta.opcoes ?? [])];
                  novas[i] = e.target.value;
                  onAtualizar({ opcoes: novas });
                }}
              />
              {(pergunta.opcoes?.length ?? 0) > 1 ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => onAtualizar({ opcoes: (pergunta.opcoes ?? []).filter((_, idx) => idx !== i) })}
                >
                  <IconClose width={11} height={11} />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="btn ghost block"
            onClick={() => onAtualizar({ opcoes: [...(pergunta.opcoes ?? []), `Opção ${(pergunta.opcoes?.length ?? 0) + 1}`] })}
          >
            + Adicionar opção
          </button>
        </SecaoPainel>
      ) : null}

      {!ehLayout ? (
        <>
          {comMinMax || comMascara || comRegex ? (
            <SecaoPainel titulo="Validação">
              {comMinMax ? (
                <div className="filters-row">
                  <div className="field" style={{ flex: 1 }}>
                    <label>Mínimo</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="number"
                      value={pergunta.min ?? ""}
                      onChange={(e) => onAtualizar({ min: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Máximo</label>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="number"
                      value={pergunta.max ?? ""}
                      onChange={(e) => onAtualizar({ max: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </div>
              ) : null}
              {comMascara ? (
                <div className="field">
                  <label>Máscara</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={pergunta.mascara ?? ""}
                    onChange={(e) => onAtualizar({ mascara: e.target.value || undefined })}
                    placeholder="Ex.: 999.999.999-99 (9 = dígito)"
                  />
                </div>
              ) : null}
              {comRegex ? (
                <div className="field">
                  <label>Padrão (regex)</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={pergunta.regex ?? ""}
                    onChange={(e) => onAtualizar({ regex: e.target.value || undefined })}
                    placeholder="Ex.: ^[A-Za-z]+$"
                  />
                </div>
              ) : null}
            </SecaoPainel>
          ) : null}

          <SecaoPainel titulo="Aparência">
            <div className="field">
              <label>Largura</label>
              <div className="filters-row" style={{ margin: 0 }}>
                <button type="button" className={`fchip${pergunta.largura === "total" ? " active" : ""}`} onClick={() => onAtualizar({ largura: "total" })}>
                  Largura total
                </button>
                <button type="button" className={`fchip${pergunta.largura === "metade" ? " active" : ""}`} onClick={() => onAtualizar({ largura: "metade" })}>
                  Meia largura
                </button>
              </div>
            </div>
            {(() => {
              const estilo = pergunta.estilo ?? {};
              function atualizarEstilo(patch: Partial<NonNullable<PerguntaFormulario["estilo"]>>) {
                onAtualizar({ estilo: { ...estilo, ...patch } });
              }
              return (
                <>
                  <div className="filters-row">
                    <div className="field" style={{ flex: 1 }}>
                      <label>Cor de fundo</label>
                      <input
                        type="color"
                        value={estilo.corFundo ?? "#ffffff"}
                        onChange={(e) => atualizarEstilo({ corFundo: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Cor da borda</label>
                      <input
                        type="color"
                        value={estilo.corBorda ?? "#e2e2e2"}
                        onChange={(e) => atualizarEstilo({ corBorda: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Cor do texto</label>
                      <input
                        type="color"
                        value={estilo.corTexto ?? "#1a1a1a"}
                        onChange={(e) => atualizarEstilo({ corTexto: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                  {estilo.corFundo || estilo.corBorda || estilo.corTexto ? (
                    <button type="button" className="link" onClick={() => onAtualizar({ estilo: undefined })}>
                      Restaurar cores padrão
                    </button>
                  ) : null}
                  <div className="filters-row">
                    <div className="field" style={{ flex: 1 }}>
                      <label>Raio da borda (px)</label>
                      <input
                        className="input"
                        style={{ width: "100%" }}
                        type="number"
                        min={0}
                        value={estilo.raioBorda ?? ""}
                        onChange={(e) => atualizarEstilo({ raioBorda: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Margem acima (px)</label>
                      <input
                        className="input"
                        style={{ width: "100%" }}
                        type="number"
                        min={0}
                        value={estilo.margemSuperior ?? ""}
                        onChange={(e) => atualizarEstilo({ margemSuperior: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Margem abaixo (px)</label>
                      <input
                        className="input"
                        style={{ width: "100%" }}
                        type="number"
                        min={0}
                        value={estilo.margemInferior ?? ""}
                        onChange={(e) => atualizarEstilo({ margemInferior: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </SecaoPainel>

          <SecaoPainel titulo="Características">
            <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <input type="checkbox" checked={pergunta.somenteLeitura} onChange={(e) => onAtualizar({ somenteLeitura: e.target.checked })} />
              Somente leitura
            </label>
            <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={pergunta.oculta} onChange={(e) => onAtualizar({ oculta: e.target.checked })} />
              Oculto
            </label>
          </SecaoPainel>

          <SecaoPainel titulo="Lógica">
            {camposAnteriores.length === 0 ? (
              <p className="hint">Só é possível condicionar à resposta de um campo anterior nesta página.</p>
            ) : (
              <>
                <LogicaCanvas key={pergunta.id} pergunta={pergunta} camposAnteriores={camposAnteriores} onAtualizar={onAtualizar} />
                {logica.regras.length > 0 ? (
                  <button type="button" className="link" style={{ marginTop: 8 }} onClick={() => onAtualizar({ logica: undefined })}>
                    Remover lógica
                  </button>
                ) : null}
              </>
            )}
          </SecaoPainel>

          <SecaoPainel titulo="Campo do CRM">
            <div className="field">
              <label>Mapear resposta para</label>
              <select
                className="input"
                style={{ width: "100%" }}
                value={pergunta.mapeamentoCrm ?? ""}
                onChange={(e) => onAtualizar({ mapeamentoCrm: e.target.value || undefined })}
              >
                <option value="">Campo novo (não mapeado)</option>
                {CAMPOS_CRM_MAPEAVEIS.map((c) => (
                  <option key={c.campo} value={c.campo}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </SecaoPainel>
        </>
      ) : null}
    </>
  );
}

function PainelDesign({
  formulario,
  onAtualizar,
  onRestaurarVersao,
}: {
  formulario: Formulario;
  onAtualizar: (patch: Partial<Formulario>) => void;
  onRestaurarVersao: (versaoId: string) => void;
}) {
  const { funis } = useFunis();
  const { membros } = useEquipe();

  function atualizarTema(patch: Partial<Formulario["tema"]>) {
    onAtualizar({ tema: { ...formulario.tema, ...patch } });
  }

  function atualizarIntegracoes(patch: Partial<NonNullable<Formulario["integracoes"]>>) {
    onAtualizar({ integracoes: { ...formulario.integracoes, ...patch } });
  }

  const funilSelecionado = funis.find((f) => f.id === formulario.integracoes?.funilId);

  return (
    <div className="form-builder-design">
      <div className="card" style={{ padding: 17 }}>
        <div className="panel-h" style={{ padding: 0, marginBottom: 12 }}>
          <h4>Configurações do formulário</h4>
        </div>
        <div className="field">
          <label>Descrição</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 60, resize: "vertical" }}
            value={formulario.descricao}
            onChange={(e) => onAtualizar({ descricao: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Mensagem de sucesso</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 60, resize: "vertical" }}
            value={formulario.paginaFinal.mensagem}
            onChange={(e) => onAtualizar({ paginaFinal: { ...formulario.paginaFinal, mensagem: e.target.value } })}
            placeholder={MENSAGEM_FINAL_PADRAO}
          />
        </div>
        <div className="field">
          <label>URL de redirecionamento (opcional)</label>
          <input
            className="input"
            style={{ width: "100%" }}
            value={formulario.paginaFinal.urlRedirecionamento ?? ""}
            onChange={(e) => onAtualizar({ paginaFinal: { ...formulario.paginaFinal, urlRedirecionamento: e.target.value } })}
            placeholder="Ex.: https://wa.me/5562999999999"
          />
        </div>
        {formulario.paginaFinal.urlRedirecionamento ? (
          <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={formulario.paginaFinal.redirecionarAutomaticamente}
              onChange={(e) => onAtualizar({ paginaFinal: { ...formulario.paginaFinal, redirecionarAutomaticamente: e.target.checked } })}
            />
            Redirecionar automaticamente ao enviar (em vez de mostrar a mensagem)
          </label>
        ) : null}
      </div>

      <div className="card" style={{ padding: 17 }}>
        <div className="panel-h" style={{ padding: 0, marginBottom: 12 }}>
          <h4>Personalização visual</h4>
        </div>
        <div className="field">
          <label>Tema</label>
          <div className="filters-row" style={{ margin: 0 }}>
            <button type="button" className={`fchip${!formulario.tema.temaEscuro ? " active" : ""}`} onClick={() => atualizarTema({ temaEscuro: false })}>
              Claro
            </button>
            <button type="button" className={`fchip${formulario.tema.temaEscuro ? " active" : ""}`} onClick={() => atualizarTema({ temaEscuro: true })}>
              Escuro
            </button>
          </div>
        </div>
        <div className="field">
          <label>Cor principal (fundo)</label>
          <div className="filters-row" style={{ margin: 0, alignItems: "center" }}>
            <div className="cor-chips">
              {["#ffffff", "#eef2ff", "#e6f7ee", "#fff8e1", "#fdeaea", "#f3e8ff"].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cor-chip${formulario.tema.corPrincipal === c ? " active" : ""}`}
                  style={{ background: c }}
                  onClick={() => atualizarTema({ corPrincipal: c })}
                />
              ))}
            </div>
            <input type="color" value={formulario.tema.corPrincipal} onChange={(e) => atualizarTema({ corPrincipal: e.target.value })} title="Cor personalizada" />
          </div>
        </div>
        <div className="field">
          <label>Cor do botão</label>
          <div className="filters-row" style={{ margin: 0, alignItems: "center" }}>
            <div className="cor-chips">
              {CORES_TEMA_FORMULARIO.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cor-chip${formulario.tema.corBotao === c ? " active" : ""}`}
                  style={{ background: c }}
                  onClick={() => atualizarTema({ corBotao: c })}
                />
              ))}
            </div>
            <input type="color" value={formulario.tema.corBotao} onChange={(e) => atualizarTema({ corBotao: e.target.value })} title="Cor personalizada" />
          </div>
        </div>
        <div className="field">
          <label>Logo (URL)</label>
          <input className="input" style={{ width: "100%" }} value={formulario.tema.logoUrl ?? ""} onChange={(e) => atualizarTema({ logoUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div className="field">
          <label>Banner (URL)</label>
          <input className="input" style={{ width: "100%" }} value={formulario.tema.bannerUrl ?? ""} onChange={(e) => atualizarTema({ bannerUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div className="field">
          <label>Imagem de fundo (URL)</label>
          <input
            className="input"
            style={{ width: "100%" }}
            value={formulario.tema.imagemFundoUrl ?? ""}
            onChange={(e) => atualizarTema({ imagemFundoUrl: e.target.value })}
            placeholder="https://…"
          />
        </div>
        <div className="field">
          <label>Layout</label>
          <div className="filters-row" style={{ margin: 0 }}>
            <button
              type="button"
              className={`fchip${formulario.tema.layout === "coluna-unica" ? " active" : ""}`}
              onClick={() => atualizarTema({ layout: "coluna-unica" })}
            >
              Uma coluna
            </button>
            <button
              type="button"
              className={`fchip${formulario.tema.layout === "duas-colunas" ? " active" : ""}`}
              onClick={() => atualizarTema({ layout: "duas-colunas" })}
            >
              Duas colunas
            </button>
          </div>
        </div>
        <div className="field">
          <label>Largura do formulário</label>
          <div className="filters-row" style={{ margin: 0 }}>
            <button type="button" className={`fchip${formulario.tema.larguraFixa ? " active" : ""}`} onClick={() => atualizarTema({ larguraFixa: true })}>
              Largura fixa
            </button>
            <button type="button" className={`fchip${!formulario.tema.larguraFixa ? " active" : ""}`} onClick={() => atualizarTema({ larguraFixa: false })}>
              Tela cheia
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 17 }}>
        <div className="panel-h" style={{ padding: 0, marginBottom: 12 }}>
          <h4>Integrações</h4>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Toda resposta enviada vira automaticamente um negócio no funil/etapa escolhidos e dispara automações com gatilho &quot;Formulário preenchido&quot;.
        </p>
        <div className="field">
          <label>Funil de destino</label>
          <select
            className="input"
            style={{ width: "100%" }}
            value={formulario.integracoes?.funilId ?? ""}
            onChange={(e) => {
              const funilId = e.target.value || undefined;
              const novoFunil = funis.find((f) => f.id === funilId);
              atualizarIntegracoes({
                funilId,
                etapaTitulo: novoFunil?.colunas[0]?.titulo,
              });
            }}
          >
            <option value="">Nenhum (não cria negócio)</option>
            {funis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        {funilSelecionado ? (
          <div className="field">
            <label>Etapa inicial</label>
            <select
              className="input"
              style={{ width: "100%" }}
              value={formulario.integracoes?.etapaTitulo ?? ""}
              onChange={(e) => atualizarIntegracoes({ etapaTitulo: e.target.value || undefined })}
            >
              {funilSelecionado.colunas.map((c) => (
                <option key={c.id} value={c.titulo}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field">
          <label>Responsável padrão</label>
          <select
            className="input"
            style={{ width: "100%" }}
            value={formulario.integracoes?.responsavelPadrao ?? ""}
            onChange={(e) => atualizarIntegracoes({ responsavelPadrao: e.target.value || undefined })}
          >
            <option value="">Sem responsável definido</option>
            {membros.map((m) => (
              <option key={m.id} value={m.nome}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 17 }}>
        <div className="panel-h" style={{ padding: 0, marginBottom: 12 }}>
          <h4>Histórico de versões</h4>
        </div>
        {formulario.versoes.length === 0 ? (
          <p className="hint" style={{ marginTop: 0 }}>
            Toda vez que você publicar o formulário, uma versão fica salva aqui — dá pra voltar pra ela depois.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...formulario.versoes].reverse().map((v) => (
              <div key={v.id} className="filters-row" style={{ margin: 0, justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>Versão {v.numero}</p>
                  <p className="hint" style={{ margin: 0 }}>
                    {new Date(v.criadoEm).toLocaleString("pt-BR")} · {v.paginas.reduce((acc, p) => acc + p.perguntas.length, 0)} campos
                  </p>
                </div>
                <button type="button" className="btn ghost" onClick={() => onRestaurarVersao(v.id)}>
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
