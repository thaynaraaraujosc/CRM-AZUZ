"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useFunis } from "@/lib/funis-context";
import { useEquipe } from "@/lib/equipe-context";
import { IconAnexo, IconCadeado, IconClose, IconEdit, IconGlobo, IconOlho, IconOlhoFechado } from "@/components/icons";
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
import { classesDoCartao, estiloDoCartao } from "@/components/formularios/FormularioPublico";
import { LogicaCanvas } from "@/components/formularios/LogicaCanvas";

type AbaBuilder = "editar" | "design" | "respostas";
type Dispositivo = "desktop" | "tablet" | "celular";

const LARGURAS_DISPOSITIVO: Record<Dispositivo, number> = {
  desktop: 760,
  tablet: 500,
  celular: 360,
};


/** Todas as perguntas do formulário, na ordem, com um número de exibição. Blocos de layout não contam. */
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

/** Nome de quem respondeu: usa a primeira pergunta mapeada pro campo "nome" do contato. */
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

  /**
   * O endereço do formulário, montado a partir de ONDE O CRM ESTÁ SENDO ACESSADO.
   *
   * Estava escrito à mão como `azuzcrm.com/f/...`, sem o `.br` e sem o `https://`. Quem recebia o
   * link caía num erro de servidor não encontrado, porque esse domínio não existe: o CRM responde
   * em `azuzcrm.com.br`. E, mesmo corrigindo a letra, um domínio fixo no código quebra de novo em
   * qualquer outro endereço (a pré-visualização da Vercel, um domínio próprio de cliente,
   * `localhost` no desenvolvimento). `window.location.origin` sempre devolve o endereço certo,
   * seja ele qual for.
   */
  function linkDoFormulario(comChave: boolean): string {
    if (!formularioAberto) return "";
    const base = `${origemDoSite || window.location.origin}/f/${formularioAberto.id}`;
    if (!comChave || !formularioAberto.senha) return base;
    return `${base}?chave=${encodeURIComponent(formularioAberto.senha)}`;
  }

  /**
   * O endereço em que o CRM está aberto (`https://azuzcrm.com.br`, a prévia da Vercel, localhost).
   *
   * `useSyncExternalStore` em vez de `useState` + `useEffect`: no servidor não existe `window`, e
   * ler ali faria o HTML do servidor divergir do primeiro HTML do cliente. Com o snapshot do
   * servidor devolvendo vazio, o React já sabe conciliar os dois sem aviso de hidratação, e sem
   * chamar `setState` dentro de efeito (que dispara uma segunda renderização em cascata).
   * A inscrição é vazia de propósito: o endereço da página não muda enquanto ela está aberta.
   */
  const origemDoSite = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  function copiarLinkPrivado() {
    if (!formularioAberto) return;
    navigator.clipboard?.writeText(linkDoFormulario(true));
    setLinkPrivadoCopiado(true);
    setTimeout(() => setLinkPrivadoCopiado(false), 2000);
  }

  function copiarLinkPublico() {
    if (!formularioAberto) return;
    navigator.clipboard?.writeText(linkDoFormulario(false));
    setLinkPublicoCopiado(true);
    setTimeout(() => setLinkPublicoCopiado(false), 2000);
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
                  Monte páginas, campos e lógica do seu jeito. Como um construtor profissional.
                </span>
              </span>
            </button>

            <p className="int-group-h" style={{ marginTop: 22 }}>
              Seus formulários
            </p>
            {formularios.length === 0 ? (
              <div className="card">
                <p className="hint" style={{ padding: 24, textAlign: "center" }}>
                  Nenhum formulário ainda: clique em &quot;Criar formulário do zero&quot; acima pra criar o primeiro.
                </p>
              </div>
            ) : (
              <div className="lista-cartoes">
                {formularios.map((f) => {
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
                })}
              </div>
            )}
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
                onClick={(e) => {
                  // O ancoradouro é o PRÓPRIO botão. Estava em `document.activeElement`, que é
                  // quem tem o foco no momento do clique: bastava o foco estar noutro lugar pra
                  // janela abrir presa a um elemento qualquer, longe do botão que a chamou.
                  setMenuCompartilharRect(e.currentTarget.getBoundingClientRect());
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
                  avisar(formularioAberto.status === "publicado" ? "Formulário voltou pra rascunho." : "Formulário publicado: o link já responde.");
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
                    style={{ position: "fixed", top: menuCompartilharPos.top, left: menuCompartilharPos.left, zIndex: 200, width: 420, padding: 17 }}
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
                              placeholder="Escolha uma senha, ex.: vitta2026"
                            />
                            {/* Sem senha os dois links são o mesmo endereço, e o de cima não tranca
                                nada. Dizer isso aqui evita a pessoa mandar um "link privado" que
                                qualquer um abre. */}
                            <p className="hint" style={{ marginTop: 6 }}>
                              {formularioAberto.senha
                                ? "A senha já vai dentro do link: quem receber abre direto, quem não tem o link não entra."
                                : "Digite uma senha aqui pra criar o link privado. Sem ela, este link é igual ao público."}
                            </p>
                          </div>
                          <div className="key-row" style={{ padding: 0 }}>
                            <div className="key-box">
                              {origemDoSite}/f/{formularioAberto.id}?chave={formularioAberto.senha || "•••"}
                            </div>
                            <button type="button" className="btn ghost" onClick={copiarLinkPrivado}>
                              {linkPrivadoCopiado ? "Copiado!" : "Copiar"}
                            </button>
                          </div>
                        </div>
                        <div className="form-link-box">
                          <p className="form-link-h" style={{ display: "flex", alignItems: "center", gap: 6 }}><IconGlobo width={13} height={13} /> Link público</p>
                          <div className="key-row" style={{ padding: 0 }}>
                            <div className="key-box">
                              {origemDoSite}/f/{formularioAberto.id}
                            </div>
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
                      // campo-resposta.tsx): mostra o nome com um link real pra abrir/baixar o
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
                            <div className="input">{ehUpload ? "-" : valor || "-"}</div>
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
                      Nenhuma resposta ainda. Publique o formulário e compartilhe o link: as respostas caem aqui.
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
                  {/* O respiro é padding do container, não margem do botão. Com `width: 100%` mais
                      margem lateral de 12px, o botão media 244px numa coluna de 220px e os 24px
                      que sobravam eram cortados pelo `overflow: hidden` do quadro. */}
                  <div className="form-builder-paginas-add">
                    <button
                      type="button"
                      className="btn ghost block"
                      onClick={() => {
                        const novaId = adicionarPagina(formularioAberto.id);
                        setPaginaAtivaId(novaId);
                        setCampoSelecionadoId(null);
                      }}
                    >
                      + Adicionar página
                    </button>
                  </div>
                </div>

                <div className="form-builder-canvas" onClick={() => setCampoSelecionadoId(null)}>
                  {paginaAtiva ? (
                    <div className="form-canvas-folha" onClick={(e) => e.stopPropagation()}>
                      {paginaAtiva.perguntas.length === 0 ? (
                        <p className="hint" style={{ padding: "40px 0", textAlign: "center" }}>
                          Página vazia: adicione o primeiro campo abaixo.
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
                                  <IconEdit width={13} height={13} />
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
        Nada selecionado: configurando a página.
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
      {/* Some quando não há campo anterior nenhum pra condicionar, que é sempre o caso da primeira
          página. Antes ela aparecia mesmo assim, com uma frase explicando por que não dava pra
          usar: uma seção que só existe pra dizer que não serve. Em formulário de página única ela
          nunca serve, e é o formato da maioria. Quem tiver duas páginas continua vendo, na
          segunda, que é onde ela faz sentido: "mostrar esta página só se a resposta lá atrás
          foi tal". */}
      {camposAnteriores.length === 0 ? null : (
        <SecaoPainel titulo="Condição de exibir">
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
        </SecaoPainel>
      )}
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

/**
 * O formulário como ele vai aparecer, ao lado dos controles que o desenham.
 *
 * A aba Design ocupava uma coluna só e deixava metade da tela vazia. Trocar uma cor exigia
 * publicar e abrir o link pra descobrir o resultado, o que na prática quer dizer que ninguém
 * personaliza: o custo de ver é maior que o de desistir.
 *
 * Lê o formulário EM MEMÓRIA, não o que está salvo, então acompanha cada tecla. Usa as mesmas
 * classes (`form-public-card`) e o mesmo renderizador de pergunta (`PerguntaVisualizacao`) da tela
 * real: uma prévia desenhada por outro caminho passa a mentir na primeira divergência entre os
 * dois códigos, e aí ela é pior que não ter prévia.
 *
 * Mostra a primeira página. Quem tem mais de uma vê o aviso de que existem outras: o que se
 * confere aqui é aparência, e a aparência é a mesma em todas.
 */
/**
 * Os fundos oferecidos, um conjunto por tema.
 *
 * A lista era uma só, de tons claros, e continuava aparecendo com o tema escuro ligado: escolher
 * um creme ali deixava texto claro sobre fundo claro. Os dois conjuntos estão na MESMA ORDEM de
 * propósito, pra trocar de tema poder levar a escolha junto (branco vira quase-preto, o azulzinho
 * vira azul-noite, e assim por diante) em vez de jogar tudo fora.
 */
/**
 * Escolha de cor: os tons oferecidos, o seletor do sistema e o código digitado.
 *
 * O campo de digitar existe porque marca tem cor exata. Quem chega com "#0B1533 é o nosso azul" não
 * quer procurar o tom mais parecido no seletor, quer escrever o código. Ele aceita o texto enquanto
 * está sendo digitado e só grava quando vira um hexadecimal completo, senão apagar um caractere pra
 * corrigir mandaria uma cor quebrada pro tema a cada tecla.
 */
function SeletorDeCor({
  valor,
  opcoes,
  onMudar,
  padraoQuandoVazio,
}: {
  valor: string | undefined;
  opcoes: string[];
  onMudar: (cor: string | undefined) => void;
  /** Quando existe, aparece a opção "Automático", que devolve `undefined` (segue o tema). */
  padraoQuandoVazio?: string;
}) {
  const [digitado, setDigitado] = useState<string | null>(null);
  const HEX_COMPLETO = /^#[0-9a-fA-F]{6}$/;

  return (
    <div className="form-cor-linha">
      <div className="cor-chips">
        {padraoQuandoVazio ? (
          <button
            type="button"
            className={`cor-chip cor-chip-auto${!valor ? " active" : ""}`}
            title="Automático: segue o tema claro/escuro"
            onClick={() => {
              setDigitado(null);
              onMudar(undefined);
            }}
          >
            A
          </button>
        ) : null}
        {opcoes.map((c) => (
          <button
            key={c}
            type="button"
            className={`cor-chip${valor === c ? " active" : ""}`}
            style={{ background: c }}
            onClick={() => {
              setDigitado(null);
              onMudar(c);
            }}
          />
        ))}
      </div>
      <input
        type="color"
        value={valor ?? padraoQuandoVazio ?? "#000000"}
        onChange={(e) => {
          setDigitado(null);
          onMudar(e.target.value);
        }}
        title="Cor personalizada"
      />
      <input
        className="input form-cor-codigo"
        value={digitado ?? valor ?? ""}
        placeholder={padraoQuandoVazio ?? "#000000"}
        spellCheck={false}
        onChange={(e) => {
          const texto = e.target.value.trim();
          setDigitado(texto);
          if (HEX_COMPLETO.test(texto)) onMudar(texto);
          else if (texto === "" && padraoQuandoVazio) onMudar(undefined);
        }}
        onBlur={() => setDigitado(null)}
      />
    </div>
  );
}

/**
 * Um campo de imagem do formulário: logo, banner ou fundo.
 *
 * As três eram caixas de endereço. Quem tem a imagem no computador não tem endereço público pra
 * colar, e o campo ficava vazio. Agora o caminho principal é enviar o arquivo; colar link continua
 * valendo pra quem já tem a marca num CDN, mas deixou de ser a única porta.
 *
 * Um componente pras três porque a única diferença entre elas é o `tipo` que vai pra rota e o
 * campo do tema que recebe o resultado.
 */
function CampoImagem({
  rotulo,
  tipo,
  formularioId,
  url,
  onMudar,
}: {
  rotulo: string;
  tipo: "logo" | "banner" | "fundo";
  formularioId: string;
  url: string | undefined;
  onMudar: (url: string | undefined, arquivo: string | undefined) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(arquivo: File) {
    setErro("");
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro(`A imagem tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é 2 MB.`);
      return;
    }
    setEnviando(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result));
        leitor.onerror = () => reject(new Error("Não deu pra ler o arquivo."));
        leitor.readAsDataURL(arquivo);
      });

      const resposta = await fetch(`/api/formularios/${formularioId}/imagem/${tipo}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const dados = (await resposta.json()) as { url?: string; arquivo?: string; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não deu pra enviar a imagem.");
      onMudar(dados.url, dados.arquivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu pra enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="field">
      <label>{rotulo}</label>
      <div className="form-design-logo">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="form-design-logo-previa" />
        ) : (
          <span className="form-design-logo-vazia">Sem imagem</span>
        )}
        <div className="form-design-logo-acoes">
          <label className="btn ghost" style={{ cursor: enviando ? "wait" : "pointer" }}>
            {enviando ? "Enviando…" : url ? "Trocar arquivo" : "Enviar arquivo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              disabled={enviando}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                // O input é limpo na hora: sem isto, escolher o MESMO arquivo de novo (depois de
                // um erro, por exemplo) não dispara `change` e a tela parece travada.
                e.target.value = "";
                if (arquivo) void enviar(arquivo);
              }}
            />
          </label>
          {url ? (
            <button type="button" className="btn ghost" onClick={() => onMudar(undefined, undefined)}>
              Remover
            </button>
          ) : null}
        </div>
      </div>
      {erro ? (
        <p className="hint" style={{ color: "var(--danger)" }}>
          {erro}
        </p>
      ) : null}
      <p className="hint">PNG, JPG, WEBP ou GIF, até 2 MB.</p>
    </div>
  );
}

const FUNDOS_CLAROS = ["#ffffff", "#eef2ff", "#e6f7ee", "#fff8e1", "#fdeaea", "#f3e8ff"];
const FUNDOS_ESCUROS = ["#14182a", "#111a33", "#0f2019", "#231c0e", "#2a1416", "#1e1430"];

function PreviaDesign({ formulario }: { formulario: Formulario }) {
  const tema = formulario.tema;
  const primeira = formulario.paginas[0];
  const perguntas = primeira?.perguntas ?? [];

  return (
    <aside className="form-design-previa" aria-label="Prévia do formulário">
      <p className="form-painel-secao-h">Prévia</p>
      {/* A moldura repete o `.form-public-page` da tela real: o cartão flutua sobre o fundo da
          página, e é esse contraste que dá a leitura de "página", não de "caixa". */}
      <div className="form-design-previa-moldura">
        <div className={classesDoCartao(tema)} style={estiloDoCartao(tema)}>
          {tema.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tema.logoUrl} alt="" className="form-public-logo" />
          ) : null}
          {tema.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tema.bannerUrl} alt="" className="form-public-banner" />
          ) : null}
          <h2>{formulario.nome || "Formulário sem título"}</h2>
          {formulario.descricao ? (
            <p className="hint" style={{ marginBottom: 6 }}>
              {formulario.descricao}
            </p>
          ) : null}
          {primeira?.titulo ? <h4 style={{ margin: "6px 0 10px" }}>{primeira.titulo}</h4> : null}
          {primeira?.descricao ? (
            <p className="hint" style={{ marginBottom: 10 }}>
              {primeira.descricao}
            </p>
          ) : null}

          {perguntas.length === 0 ? (
            <p className="hint">Nenhuma pergunta ainda. Adicione uma na aba Editar pra ver aqui.</p>
          ) : (
            // O container e as classes de largura são os mesmos da tela real: sem eles os campos
            // empilham soltos e o "metade" some, que é onde a prévia deixava de parecer o
            // formulário e passava a parecer uma lista.
            <div className="form-public-campos">
              {perguntas.map((pergunta, i) => (
                <div
                  key={pergunta.id}
                  className={pergunta.largura === "metade" ? "form-campo-metade" : "form-campo-total"}
                >
                  <PerguntaVisualizacao
                    pergunta={pergunta}
                    /* A numeração pula os blocos de layout (título, texto, divisória): eles
                       aparecem no formulário mas não são perguntas, e contá-los faria a prévia
                       numerar diferente da tela real. */
                    indice={perguntas.slice(0, i).filter((q) => !TIPOS_LAYOUT.includes(q.tipo)).length + 1}
                    interativo={false}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Sem `disabled`: `.btn:disabled` aplica `opacity: 0.5`, e era isso a névoa por cima do
              botão. A prévia precisa mostrar a cor EXATA que foi escolhida, senão ela atrapalha
              justamente a decisão que existe pra ajudar. Fica inerte por `pointer-events`, sem
              mudar um pixel da aparência. */}
          <button
            type="button"
            className="btn block"
            style={{ background: tema.corBotao, color: "#fff", marginTop: 14, pointerEvents: "none" }}
            tabIndex={-1}
            aria-hidden="true"
          >
            {formulario.paginas.length > 1 ? "Continuar" : "Enviar"}
          </button>
        </div>
      </div>
      {formulario.paginas.length > 1 ? (
        <p className="hint form-design-previa-nota">
          Mostrando a primeira de {formulario.paginas.length} páginas. A aparência é a mesma em todas.
        </p>
      ) : null}
    </aside>
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

  /**
   * Troca o tema levando o fundo junto.
   *
   * Só troca a cor quando ela é um dos tons oferecidos do tema anterior: nesse caso a pessoa
   * escolheu "o segundo quadradinho", não aquele valor exato de hexadecimal, e o equivalente do
   * outro conjunto é o que ela espera. Cor escolhida no seletor personalizado é decisão dela e
   * fica como está, mesmo que fique estranha: sobrescrever escolha explícita é pior que deixar
   * feio, e ela vê o resultado na prévia ao lado na mesma hora.
   */
  function trocarTema(escuro: boolean) {
    const antes = escuro ? FUNDOS_CLAROS : FUNDOS_ESCUROS;
    const depois = escuro ? FUNDOS_ESCUROS : FUNDOS_CLAROS;
    const posicao = antes.indexOf(formulario.tema.corPrincipal);
    atualizarTema({
      temaEscuro: escuro,
      ...(posicao >= 0 ? { corPrincipal: depois[posicao] } : {}),
    });
  }

  const funilSelecionado = funis.find((f) => f.id === formulario.integracoes?.funilId);

  return (
    <div className="form-design-colunas">
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
            <button type="button" className={`fchip${!formulario.tema.temaEscuro ? " active" : ""}`} onClick={() => trocarTema(false)}>
              Claro
            </button>
            <button type="button" className={`fchip${formulario.tema.temaEscuro ? " active" : ""}`} onClick={() => trocarTema(true)}>
              Escuro
            </button>
          </div>
        </div>
        <div className="field">
          <label>Cor principal (fundo)</label>
          <SeletorDeCor
            valor={formulario.tema.corPrincipal}
            opcoes={formulario.tema.temaEscuro ? FUNDOS_ESCUROS : FUNDOS_CLAROS}
            onMudar={(c) => atualizarTema({ corPrincipal: c ?? "#ffffff" })}
          />
        </div>
        <div className="field">
          <label>Cor do botão</label>
          <SeletorDeCor
            valor={formulario.tema.corBotao}
            opcoes={CORES_TEMA_FORMULARIO}
            onMudar={(c) => atualizarTema({ corBotao: c ?? "#2e6bff" })}
          />
        </div>
        <div className="field">
          <label>Cor do texto</label>
          <SeletorDeCor
            valor={formulario.tema.corTexto}
            opcoes={["#0b1533", "#3f4658", "#6b7280", "#ffffff", "#e7e9f2", "#a4adc4"]}
            padraoQuandoVazio={formulario.tema.temaEscuro ? "#eef1fb" : "#0b1533"}
            onMudar={(c) => atualizarTema({ corTexto: c })}
          />
          <p className="hint" style={{ marginTop: 6 }}>
            Em &quot;A&quot; (automático) o texto segue o tema. Escolha uma cor quando o fundo pedir:
            fundo escuro com tema claro deixava texto preto sobre preto, sem jeito de corrigir.
          </p>
        </div>
        <CampoImagem
          rotulo="Logo"
          tipo="logo"
          formularioId={formulario.id}
          url={formulario.tema.logoUrl}
          onMudar={(url, arquivo) => atualizarTema({ logoUrl: url, logoArquivo: arquivo })}
        />
        <CampoImagem
          rotulo="Banner"
          tipo="banner"
          formularioId={formulario.id}
          url={formulario.tema.bannerUrl}
          onMudar={(url, arquivo) => atualizarTema({ bannerUrl: url, bannerArquivo: arquivo })}
        />
        <CampoImagem
          rotulo="Imagem de fundo"
          tipo="fundo"
          formularioId={formulario.id}
          url={formulario.tema.imagemFundoUrl}
          onMudar={(url, arquivo) => atualizarTema({ imagemFundoUrl: url, fundoArquivo: arquivo })}
        />
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
            Toda vez que você publicar o formulário, uma versão fica salva aqui. Dá pra voltar pra ela depois.
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

      <PreviaDesign formulario={formulario} />
    </div>
  );
}
