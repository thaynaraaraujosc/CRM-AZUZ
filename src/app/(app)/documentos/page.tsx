"use client";

import { useEffect, useRef, useState } from "react";

import { currentUser, equipe } from "@/lib/data";
import {
  MODELOS_DOCUMENTO,
  useDocumentos,
  type PaginaDoc,
  type PermissaoAcesso,
  type TamanhoPapel,
} from "@/lib/documentos-context";
import {
  baixarDocx,
  baixarHtml,
  baixarRtf,
  baixarTxt,
  imprimirOuSalvarPdf,
} from "@/lib/documentos-export";
import { IconDoc, IconSearch } from "@/components/icons";
import { FloatingDropdown, Topbar } from "@/components/ui";

/* Web Speech API — não faz parte do lib.dom.d.ts padrão do TypeScript, então declaramos o mínimo usado aqui. */
interface ReconhecimentoDeVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constantes                                                                  */
/* -------------------------------------------------------------------------- */

const TAMANHOS_PAPEL_MM: Record<Exclude<TamanhoPapel, "Personalizado">, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Carta: { w: 216, h: 279 },
  "Ofício": { w: 216, h: 356 },
};

const FONTES_DOCUMENTO = [
  { label: "Arial", valor: "Arial, sans-serif" },
  { label: "Times New Roman", valor: "'Times New Roman', Georgia, serif" },
  { label: "Georgia", valor: "Georgia, 'Times New Roman', serif" },
  { label: "Courier New", valor: "'Courier New', monospace" },
];

const TAMANHOS_FONTE_DOC = [
  { label: "Pequeno", valor: "2" },
  { label: "Normal", valor: "3" },
  { label: "Médio", valor: "4" },
  { label: "Grande", valor: "5" },
  { label: "Enorme", valor: "6" },
];

const ESTILOS_PARAGRAFO = [
  { label: "Texto normal", valor: "P" },
  { label: "Subtítulo", valor: "H4" },
  { label: "Título 3", valor: "H3" },
  { label: "Título 2", valor: "H2" },
  { label: "Título 1", valor: "H1" },
];

const CORES_TEXTO = ["#0b1533", "#2e6bff", "#0f9d63", "#d64545", "#c9660a", "#8a3ffc", "#ffffff"];
const CORES_DESTAQUE = ["transparent", "#fff3a0", "#c7f0d8", "#cfe0ff", "#ffd6d6", "#e8d6ff"];
const SIMBOLOS = ["©", "®", "™", "€", "£", "¥", "±", "×", "÷", "§", "¶", "•", "…", "→", "★"];
const EMOJIS_RAPIDOS = ["😀", "😂", "😍", "👍", "🙏", "🎉", "✅", "❤️", "🔥", "📌"];

type ItemMenu = {
  label: string;
  atalho?: string;
  onClick?: () => void;
  disabled?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatarQuando(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function contarPalavrasTexto(paginas: PaginaDoc[]) {
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  let texto = "";
  for (const p of paginas) {
    if (div) {
      div.innerHTML = p.conteudoHtml;
      texto += (div.textContent ?? "") + "\n";
    }
  }
  const palavras = texto.trim().length === 0 ? 0 : texto.trim().split(/\s+/).length;
  const caracteres = texto.replace(/\s/g, "").length;
  return { palavras, caracteres, paginas: paginas.length };
}

/* -------------------------------------------------------------------------- */
/* Página                                                                      */
/* -------------------------------------------------------------------------- */

export default function DocumentosPage() {
  const [documentoAbertoId, setDocumentoAbertoId] = useState<string | null>(null);

  return documentoAbertoId ? (
    <EditorDocumento id={documentoAbertoId} onFechar={() => setDocumentoAbertoId(null)} />
  ) : (
    <ListaDocumentos onAbrir={setDocumentoAbertoId} />
  );
}

/* -------------------------------------------------------------------------- */
/* Lista de documentos                                                        */
/* -------------------------------------------------------------------------- */

type Aba = "recentes" | "favoritos" | "compartilhados" | "lixeira";
const ABAS: { valor: Aba; label: string }[] = [
  { valor: "recentes", label: "Recentes" },
  { valor: "favoritos", label: "Favoritos" },
  { valor: "compartilhados", label: "Compartilhados comigo" },
  { valor: "lixeira", label: "Lixeira" },
];

function ListaDocumentos({ onAbrir }: { onAbrir: (id: string) => void }) {
  const {
    documentos,
    criarDocumento,
    excluirDocumento,
    restaurarDocumento,
    excluirPermanente,
    esvaziarLixeira,
    duplicarDocumento,
    renomearDocumento,
    favoritarDocumento,
  } = useDocumentos();

  const [aba, setAba] = useState<Aba>("recentes");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"nome" | "criacao" | "edicao">("edicao");
  const [modelosAberto, setModelosAberto] = useState(false);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [nomeRenomear, setNomeRenomear] = useState("");
  const [acaoAbertaId, setAcaoAbertaId] = useState<string | null>(null);
  const [acaoRect, setAcaoRect] = useState<DOMRect | null>(null);

  const visiveis = documentos.filter((d) => {
    if (aba === "lixeira") return d.excluido;
    if (d.excluido) return false;
    if (aba === "favoritos") return d.favorito;
    if (aba === "compartilhados") return d.pessoasAcesso.length > 0;
    return true;
  });

  const filtrados = visiveis
    .filter((d) => d.titulo.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => {
      if (ordenacao === "nome") return a.titulo.localeCompare(b.titulo);
      if (ordenacao === "criacao") return b.criadoEm.localeCompare(a.criadoEm);
      return b.atualizadoEm.localeCompare(a.atualizadoEm);
    });

  function novoDocumento(modeloId?: string) {
    const id = criarDocumento(undefined, modeloId);
    setModelosAberto(false);
    onAbrir(id);
  }

  return (
    <>
      <Topbar
        title="Documentos"
        sub="Crie, edite e organize documentos de texto — com páginas, formatação e histórico"
      />
      <div className="content">
        <div className="filters-row mb14">
          <button type="button" className="btn primary" onClick={() => novoDocumento()}>
            + Novo documento
          </button>
          <button type="button" className="btn ghost" onClick={() => setModelosAberto((v) => !v)}>
            📄 Modelos
          </button>
          <label className="search" style={{ marginLeft: "auto", width: 240 }}>
            <IconSearch />
            <input
              placeholder="Pesquisar por nome…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <select
            className="doc-toolbar-select"
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as typeof ordenacao)}
          >
            <option value="edicao">Última edição</option>
            <option value="criacao">Criação</option>
            <option value="nome">Nome</option>
          </select>
        </div>

        {modelosAberto ? (
          <div className="card mb14">
            <div className="panel-h">
              <h4>Escolha um modelo</h4>
            </div>
            <div className="doc-modelos-grid">
              {MODELOS_DOCUMENTO.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className="doc-modelo-card"
                  onClick={() => novoDocumento(m.id)}
                >
                  <span className="doc-modelo-icone"><IconDoc width={22} height={22} /></span>
                  <span className="n">{m.nome}</span>
                  <span className="hint">{m.descricao}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="filters-row mb14">
          {ABAS.map((a) => (
            <button
              type="button"
              key={a.valor}
              className={`fchip${aba === a.valor ? " active" : ""}`}
              aria-pressed={aba === a.valor}
              onClick={() => setAba(a.valor)}
            >
              {a.label}
            </button>
          ))}
          {aba === "lixeira" && visiveis.length > 0 ? (
            <button
              type="button"
              className="btn ghost"
              style={{ marginLeft: "auto", color: "#d64545" }}
              onClick={() => {
                if (window.confirm("Esvaziar a lixeira? Isso apaga os documentos definitivamente."))
                  esvaziarLixeira();
              }}
            >
              Esvaziar lixeira
            </button>
          ) : null}
        </div>

        {filtrados.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <p className="n" style={{ marginBottom: 6 }}>
              {aba === "lixeira" ? "🗑 Lixeira vazia" : "📄 Nenhum documento aqui ainda"}
            </p>
            <p className="hint">
              {aba === "lixeira"
                ? "Documentos excluídos aparecem aqui antes de sumir de vez."
                : "Crie um documento do zero ou a partir de um modelo."}
            </p>
          </div>
        ) : (
          <div className="doc-lista-grid">
            {filtrados.map((d) => (
              <div className="doc-lista-card" key={d.id}>
                <button
                  type="button"
                  className="doc-lista-card-abrir"
                  onClick={() => (aba === "lixeira" ? undefined : onAbrir(d.id))}
                  disabled={aba === "lixeira"}
                >
                  <span className="doc-lista-thumb"><IconDoc width={26} height={26} /></span>
                  {renomeandoId === d.id ? (
                    <input
                      autoFocus
                      className="input"
                      style={{ width: "100%" }}
                      value={nomeRenomear}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setNomeRenomear(e.target.value)}
                      onBlur={() => {
                        renomearDocumento(d.id, nomeRenomear);
                        setRenomeandoId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renomearDocumento(d.id, nomeRenomear);
                          setRenomeandoId(null);
                        }
                      }}
                    />
                  ) : (
                    <span className="n doc-lista-titulo">
                      {d.favorito ? "⭐ " : ""}
                      {d.titulo}
                    </span>
                  )}
                  <span className="hint">
                    {d.autor} · {formatarQuando(d.atualizadoEm)}
                  </span>
                </button>
                <button
                  type="button"
                  className="modal-close-btn doc-lista-acoes-btn"
                  aria-label="Mais ações"
                  onClick={(e) => {
                    setAcaoRect(e.currentTarget.getBoundingClientRect());
                    setAcaoAbertaId(acaoAbertaId === d.id ? null : d.id);
                  }}
                >
                  ⋮
                </button>
                <FloatingDropdown
                  anchorRect={acaoAbertaId === d.id ? acaoRect : null}
                  onClose={() => setAcaoAbertaId(null)}
                  width={200}
                  align="right"
                >
                  {aba === "lixeira" ? (
                    <>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          restaurarDocumento(d.id);
                          setAcaoAbertaId(null);
                        }}
                      >
                        <span className="n">↩ Restaurar</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left", color: "#d64545" }}
                        onClick={() => {
                          if (window.confirm(`Excluir "${d.titulo}" definitivamente?`)) {
                            excluirPermanente(d.id);
                          }
                          setAcaoAbertaId(null);
                        }}
                      >
                        <span className="n">🗑 Excluir definitivamente</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => onAbrir(d.id)}
                      >
                        <span className="n">📂 Abrir</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          setRenomeandoId(d.id);
                          setNomeRenomear(d.titulo);
                          setAcaoAbertaId(null);
                        }}
                      >
                        <span className="n">✏️ Renomear</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          favoritarDocumento(d.id);
                          setAcaoAbertaId(null);
                        }}
                      >
                        <span className="n">{d.favorito ? "☆ Desfavoritar" : "⭐ Favoritar"}</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          const novoId = duplicarDocumento(d.id);
                          setAcaoAbertaId(null);
                          onAbrir(novoId);
                        }}
                      >
                        <span className="n">📑 Duplicar</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => {
                          baixarTxt(d.titulo, d.paginas);
                          setAcaoAbertaId(null);
                        }}
                      >
                        <span className="n">⬇ Baixar como .txt</span>
                      </button>
                      <div className="dropdown-sep" />
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left", color: "#d64545" }}
                        onClick={() => {
                          excluirDocumento(d.id);
                          setAcaoAbertaId(null);
                        }}
                      >
                        <span className="n">🗑 Mover pra lixeira</span>
                      </button>
                    </>
                  )}
                </FloatingDropdown>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor de documento                                                        */
/* -------------------------------------------------------------------------- */

type NomeMenu = "arquivo" | "editar" | "ver" | "inserir" | "formatar" | "ferramentas" | "ajuda";

function MenuTopo({
  label,
  aberto,
  onAbrir,
  onFechar,
  itens,
}: {
  label: string;
  aberto: boolean;
  onAbrir: (rect: DOMRect) => void;
  onFechar: () => void;
  itens: ("sep" | ItemMenu)[];
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={`doc-menu-btn${aberto ? " active" : ""}`}
        onClick={() => {
          if (aberto) {
            onFechar();
          } else if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setRect(r);
            onAbrir(r);
          }
        }}
      >
        {label}
      </button>
      <FloatingDropdown
        anchorRect={aberto ? rect : null}
        onClose={onFechar}
        width={260}
        maxHeight={420}
      >
        {itens.map((item, i) =>
          item === "sep" ? (
            <div className="dropdown-sep" key={`sep-${i}`} />
          ) : (
            <button
              type="button"
              key={item.label}
              className="dropdown-item doc-menu-item"
              style={{ width: "100%", textAlign: "left" }}
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.();
                onFechar();
              }}
            >
              <span className="n">{item.label}</span>
              {item.atalho ? <span className="doc-menu-atalho">{item.atalho}</span> : null}
            </button>
          ),
        )}
      </FloatingDropdown>
    </>
  );
}

function ReguaDocumento({ larguraMm }: { larguraMm: number }) {
  const marcasQtd = Math.round(larguraMm / 10);
  const marcas = Array.from({ length: marcasQtd + 1 }, (_, i) => i);
  return (
    <div className="doc-regua" aria-hidden="true">
      {marcas.map((cm) => (
        <span key={cm} className="doc-regua-marca">
          {cm > 0 ? cm : ""}
        </span>
      ))}
    </div>
  );
}

function EditorDocumento({ id, onFechar }: { id: string; onFechar: () => void }) {
  const {
    documentos,
    renomearDocumento,
    favoritarDocumento,
    atualizarPaginas,
    atualizarConfigPagina,
    adicionarComentario,
    responderComentario,
    resolverComentario,
    salvarVersao,
    restaurarVersao,
    atualizarAcesso,
    excluirDocumento,
    duplicarDocumento,
  } = useDocumentos();

  const doc = documentos.find((d) => d.id === id);

  const [paginasLocais, setPaginasLocais] = useState<PaginaDoc[]>(doc?.paginas ?? []);
  const [tituloLocal, setTituloLocal] = useState(doc?.titulo ?? "");
  const [paginaAtivaId, setPaginaAtivaId] = useState(doc?.paginas[0]?.id ?? "");
  const [estadoSalvamento, setEstadoSalvamento] = useState<"salvo" | "salvando">("salvo");
  const [menuAberto, setMenuAberto] = useState<NomeMenu | null>(null);
  const [zoom, setZoom] = useState(100);
  const [modo, setModo] = useState<"edicao" | "sugestao" | "visualizacao">("edicao");
  const [mostrarRegua, setMostrarRegua] = useState(true);
  const [mostrarNaoImprimiveis, setMostrarNaoImprimiveis] = useState(false);
  const [semPaginas, setSemPaginas] = useState(false);
  const [corretorAtivo, setCorretorAtivo] = useState(true);
  const [idioma, setIdioma] = useState("pt-BR");

  const [configPaginaAberto, setConfigPaginaAberto] = useState(false);
  const [compartilharAberto, setCompartilharAberto] = useState(false);
  const [comentariosAberto, setComentariosAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [localizarAberto, setLocalizarAberto] = useState(false);
  const [contagemAberta, setContagemAberta] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [gravandoVoz, setGravandoVoz] = useState(false);

  const [buscaTexto, setBuscaTexto] = useState("");
  const [substituirTexto, setSubstituirTexto] = useState("");
  const [novoEmailAcesso, setNovoEmailAcesso] = useState("");
  const [novaPermissaoAcesso, setNovaPermissaoAcesso] = useState<PermissaoAcesso>("editar");

  const paginaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const salvarDigitacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formatoPintadoRef = useRef<{ bold: boolean; italic: boolean; underline: boolean } | null>(null);
  const reconhecimentoRef = useRef<ReconhecimentoDeVoz | null>(null);

  useEffect(() => {
    if (!doc) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de documento (id) precisa recarregar o estado local a partir da fonte persistida
    setPaginasLocais(doc.paginas);
    setTituloLocal(doc.titulo);
    setPaginaAtivaId(doc.paginas[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Autosave com debounce — mostra "Salvando…" na hora e "Salvo" depois de um instante parado.
  useEffect(() => {
    if (!doc) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indicador visual do debounce de autosave
    setEstadoSalvamento("salvando");
    const timeout = setTimeout(() => {
      atualizarPaginas(id, paginasLocais);
      setEstadoSalvamento("salvo");
    }, 700);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginasLocais]);

  useEffect(() => {
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuAberto(null);
        setConfigPaginaAberto(false);
        setCompartilharAberto(false);
        setHistoricoAberto(false);
        setLocalizarAberto(false);
        setContagemAberta(false);
        setDetalhesAberto(false);
      }
    }
    window.addEventListener("keydown", aoTeclarEsc);
    return () => window.removeEventListener("keydown", aoTeclarEsc);
  }, []);

  if (!doc) {
    return (
      <div className="content">
        <p className="hint">Documento não encontrado.</p>
        <button type="button" className="btn ghost" onClick={onFechar}>
          Voltar
        </button>
      </div>
    );
  }

  const dimensao =
    doc.config.tamanho === "Personalizado"
      ? { w: 210, h: 297 }
      : TAMANHOS_PAPEL_MM[doc.config.tamanho];
  const larguraMm = doc.config.orientacao === "paisagem" ? dimensao.h : dimensao.w;
  const alturaMm = doc.config.orientacao === "paisagem" ? dimensao.w : dimensao.h;

  function salvarConteudoPagina(paginaId: string) {
    const el = paginaRefs.current[paginaId];
    if (!el) return;
    setPaginasLocais((prev) =>
      prev.map((p) => (p.id === paginaId ? { ...p, conteudoHtml: el.innerHTML } : p)),
    );
  }

  function focarPagina(paginaId: string) {
    paginaRefs.current[paginaId]?.focus();
    setPaginaAtivaId(paginaId);
  }

  function aplicarFormatacao(comando: string, valor?: string) {
    paginaRefs.current[paginaAtivaId]?.focus();
    document.execCommand(comando, false, valor);
    salvarConteudoPagina(paginaAtivaId);
  }

  function inserirNaPagina(html: string) {
    paginaRefs.current[paginaAtivaId]?.focus();
    document.execCommand("insertHTML", false, html);
    salvarConteudoPagina(paginaAtivaId);
  }

  function novaPaginaAposAtiva() {
    const indice = paginasLocais.findIndex((p) => p.id === paginaAtivaId);
    let novoId = "";
    setPaginasLocais((prev) => {
      const id = `pagina-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      novoId = id;
      const nova: PaginaDoc = { id, conteudoHtml: "" };
      const copia = [...prev];
      copia.splice(indice + 1, 0, nova);
      return copia;
    });
    setTimeout(() => setPaginaAtivaId(novoId), 0);
  }

  function excluirPaginaAtiva() {
    if (paginasLocais.length <= 1) return;
    if (!window.confirm("Excluir essa página?")) return;
    setPaginasLocais((prev) => {
      const restante = prev.filter((p) => p.id !== paginaAtivaId);
      setPaginaAtivaId(restante[0].id);
      return restante;
    });
  }

  /**
   * Auto-paginação real: se o conteúdo estourar a altura da folha, o último bloco vira o começo da próxima página.
   * O salvamento do texto digitado é adiado (debounce) — chamar setPaginasLocais a cada tecla reaplicaria o
   * dangerouslySetInnerHTML da própria div a cada letra, resetando o cursor para o início (o texto saía invertido).
   */
  function aoDigitarNaPagina(paginaId: string) {
    if (salvarDigitacaoRef.current) clearTimeout(salvarDigitacaoRef.current);
    salvarDigitacaoRef.current = setTimeout(() => salvarConteudoPagina(paginaId), 600);

    const el = paginaRefs.current[paginaId];
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 4) return;
    const ultimo = el.lastElementChild;
    if (!ultimo || el.children.length <= 1) return;
    const htmlTransbordo = ultimo.outerHTML;
    ultimo.remove();
    setPaginasLocais((prev) => {
      const indice = prev.findIndex((p) => p.id === paginaId);
      const atual = { ...prev[indice], conteudoHtml: el.innerHTML };
      const proxima = prev[indice + 1];
      const copia = [...prev];
      copia[indice] = atual;
      if (proxima) {
        copia[indice + 1] = { ...proxima, conteudoHtml: htmlTransbordo + proxima.conteudoHtml };
      } else {
        copia.splice(indice + 1, 0, {
          id: `pagina-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          conteudoHtml: htmlTransbordo,
        });
      }
      return copia;
    });
  }

  function localizarProximo() {
    if (!buscaTexto.trim()) return;
    const w = window as unknown as { find?: (texto: string) => boolean };
    w.find?.(buscaTexto);
  }

  function substituirTodos() {
    if (!buscaTexto.trim()) return;
    setPaginasLocais((prev) =>
      prev.map((p) => ({
        ...p,
        conteudoHtml: p.conteudoHtml.split(buscaTexto).join(substituirTexto),
      })),
    );
  }

  function copiarFormatacao() {
    formatoPintadoRef.current = {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    };
  }

  function colarFormatacao() {
    const f = formatoPintadoRef.current;
    if (!f) return;
    if (f.bold && !document.queryCommandState("bold")) aplicarFormatacao("bold");
    if (f.italic && !document.queryCommandState("italic")) aplicarFormatacao("italic");
    if (f.underline && !document.queryCommandState("underline")) aplicarFormatacao("underline");
  }

  function alternarDigitacaoPorVoz() {
    const SpeechRecognitionCtor =
      (window as unknown as { webkitSpeechRecognition?: new () => ReconhecimentoDeVoz }).webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: new () => ReconhecimentoDeVoz }).SpeechRecognition;
    if (!SpeechRecognitionCtor) {
      window.alert("Digitação por voz não é suportada nesse navegador.");
      return;
    }
    if (gravandoVoz) {
      reconhecimentoRef.current?.stop();
      setGravandoVoz(false);
      return;
    }
    const reconhecimento = new SpeechRecognitionCtor();
    reconhecimento.lang = idioma;
    reconhecimento.continuous = true;
    reconhecimento.interimResults = false;
    reconhecimento.onresult = (evento) => {
      const ultimo = evento.results[evento.results.length - 1];
      if (ultimo?.[0]) inserirNaPagina(`${ultimo[0].transcript} `);
    };
    reconhecimento.onend = () => setGravandoVoz(false);
    reconhecimento.start();
    reconhecimentoRef.current = reconhecimento;
    setGravandoVoz(true);
  }

  function inserirImagem() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      const leitor = new FileReader();
      leitor.onload = () => {
        inserirNaPagina(`<img src="${leitor.result}" style="max-width:100%;" />`);
      };
      leitor.readAsDataURL(arquivo);
    };
    input.click();
  }

  function inserirTabela() {
    const linhas = Number(window.prompt("Quantas linhas?", "3") ?? 0);
    const colunas = Number(window.prompt("Quantas colunas?", "3") ?? 0);
    if (!linhas || !colunas) return;
    const linhaHtml = `<tr>${"<td style=\"border:1px solid #999;padding:4px 8px;\">&nbsp;</td>".repeat(colunas)}</tr>`;
    inserirNaPagina(`<table style="border-collapse:collapse;width:100%;">${linhaHtml.repeat(linhas)}</table>`);
  }

  function inserirLink() {
    const url = window.prompt("URL do link:", "https://");
    if (!url) return;
    aplicarFormatacao("createLink", url);
  }

  function inserirMencao() {
    const nomes = equipe.map((m) => m.nome).join(", ");
    const nome = window.prompt(`Mencionar quem? (${nomes})`);
    if (nome) inserirNaPagina(`<b>@${nome}</b>&nbsp;`);
  }

  function inserirSimbolo() {
    const escolha = window.prompt(`Digite o símbolo desejado ou escolha um da lista:\n${SIMBOLOS.join("  ")}`, SIMBOLOS[0]);
    if (escolha) inserirNaPagina(escolha);
  }

  function inserirEmoji() {
    const escolha = window.prompt(`Digite o emoji desejado ou escolha um da lista:\n${EMOJIS_RAPIDOS.join("  ")}`, EMOJIS_RAPIDOS[0]);
    if (escolha) inserirNaPagina(escolha);
  }

  function inserirSumario() {
    const div = document.createElement("div");
    const titulos: string[] = [];
    for (const p of paginasLocais) {
      div.innerHTML = p.conteudoHtml;
      div.querySelectorAll("h1, h2, h3, h4").forEach((h) => titulos.push(h.textContent ?? ""));
    }
    if (titulos.length === 0) {
      window.alert("Nenhum título encontrado — use os estilos de título no texto primeiro.");
      return;
    }
    inserirNaPagina(`<p><b>Sumário</b></p><ul>${titulos.map((t) => `<li>${t}</li>`).join("")}</ul>`);
  }

  function abrirComentarioNaSelecao() {
    const selecao = window.getSelection();
    const trecho = selecao?.toString().trim();
    if (!trecho) {
      window.alert("Selecione um trecho do texto pra comentar.");
      return;
    }
    const texto = window.prompt(`Comentário sobre: "${trecho.slice(0, 40)}…"`);
    if (texto) adicionarComentario(id, trecho, texto);
    setComentariosAberto(true);
  }

  const contagem = contarPalavrasTexto(paginasLocais);

  const menuArquivo: ("sep" | ItemMenu)[] = [
    { label: "Novo documento", onClick: () => window.dispatchEvent(new CustomEvent("doc-novo")) },
    { label: "Fazer uma cópia", onClick: () => duplicarDocumento(id) },
    { label: "Renomear", onClick: () => document.getElementById("doc-titulo-input")?.focus() },
    { label: doc.favorito ? "Remover dos favoritos" : "Favoritar", onClick: () => favoritarDocumento(id) },
    { label: "Compartilhar", onClick: () => setCompartilharAberto(true) },
    {
      label: "Enviar por e-mail",
      onClick: () =>
        window.open(
          `mailto:?subject=${encodeURIComponent(doc.titulo)}&body=${encodeURIComponent(
            contarPalavrasTexto(paginasLocais).palavras + " palavras — confira o documento no CRM.",
          )}`,
        ),
    },
    "sep",
    { label: "Salvamento automático: ativado", disabled: true },
    { label: "Histórico de versões", onClick: () => setHistoricoAberto(true) },
    { label: "Detalhes do documento", onClick: () => setDetalhesAberto(true) },
    {
      label: "Idioma",
      onClick: () => {
        const novo = window.prompt("Idioma (ex.: pt-BR, en-US)", idioma);
        if (novo) setIdioma(novo);
      },
    },
    { label: "Configuração da página", onClick: () => setConfigPaginaAberto(true) },
    { label: "Visualizar impressão / Imprimir", atalho: "Ctrl+P", onClick: () => imprimirOuSalvarPdf() },
    "sep",
    {
      label: "Mover para a lixeira",
      onClick: () => {
        excluirDocumento(id);
        onFechar();
      },
    },
    "sep",
    { label: "Baixar como PDF", onClick: () => imprimirOuSalvarPdf() },
    { label: "Baixar como Word (.docx)", onClick: () => baixarDocx(doc.titulo, paginasLocais) },
    { label: "Baixar como texto simples (.txt)", onClick: () => baixarTxt(doc.titulo, paginasLocais) },
    { label: "Baixar como RTF", onClick: () => baixarRtf(doc.titulo, paginasLocais) },
    { label: "Baixar como HTML", onClick: () => baixarHtml(doc.titulo, paginasLocais) },
  ];

  const menuEditar: ("sep" | ItemMenu)[] = [
    { label: "Desfazer", atalho: "Ctrl+Z", onClick: () => aplicarFormatacao("undo") },
    { label: "Refazer", atalho: "Ctrl+Y", onClick: () => aplicarFormatacao("redo") },
    "sep",
    { label: "Recortar", atalho: "Ctrl+X", onClick: () => aplicarFormatacao("cut") },
    { label: "Copiar", atalho: "Ctrl+C", onClick: () => aplicarFormatacao("copy") },
    { label: "Colar", atalho: "Ctrl+V", onClick: () => aplicarFormatacao("paste") },
    { label: "Colar sem formatação", atalho: "Ctrl+Shift+V", onClick: () => aplicarFormatacao("insertText") },
    "sep",
    { label: "Selecionar tudo", atalho: "Ctrl+A", onClick: () => aplicarFormatacao("selectAll") },
    { label: "Excluir", onClick: () => aplicarFormatacao("delete") },
    "sep",
    { label: "Localizar", atalho: "Ctrl+F", onClick: () => setLocalizarAberto(true) },
    { label: "Localizar e substituir", atalho: "Ctrl+H", onClick: () => setLocalizarAberto(true) },
  ];

  const menuVer: ("sep" | ItemMenu)[] = [
    { label: mostrarRegua ? "Ocultar régua" : "Mostrar régua", onClick: () => setMostrarRegua((v) => !v) },
    {
      label: mostrarNaoImprimiveis ? "Ocultar caracteres não imprimíveis" : "Mostrar caracteres não imprimíveis",
      onClick: () => setMostrarNaoImprimiveis((v) => !v),
    },
    { label: semPaginas ? "Ativar visualização paginada" : "Visualização sem páginas", onClick: () => setSemPaginas((v) => !v) },
    "sep",
    {
      label: "Tela cheia",
      onClick: () => document.documentElement.requestFullscreen?.().catch(() => undefined),
    },
    { label: "Visualização de impressão", onClick: () => imprimirOuSalvarPdf() },
    "sep",
    { label: "Aumentar zoom", onClick: () => setZoom((z) => Math.min(200, z + 10)) },
    { label: "Diminuir zoom", onClick: () => setZoom((z) => Math.max(50, z - 10)) },
    { label: "Restaurar zoom (100%)", onClick: () => setZoom(100) },
  ];

  const menuInserir: ("sep" | ItemMenu)[] = [
    { label: "Imagem", onClick: inserirImagem },
    { label: "Tabela", onClick: inserirTabela },
    { label: "Link", atalho: "Ctrl+K", onClick: inserirLink },
    { label: "Caixa de texto", onClick: () => inserirNaPagina('<div style="border:1px solid #999;padding:8px;display:inline-block;">Caixa de texto</div>') },
    { label: "Linha horizontal", onClick: () => aplicarFormatacao("insertHorizontalRule") },
    { label: "Data", onClick: () => inserirNaPagina(new Date().toLocaleDateString("pt-BR")) },
    { label: "Nota de rodapé", onClick: () => inserirNaPagina('<sup>[1]</sup>') },
    { label: "Citação", onClick: () => aplicarFormatacao("formatBlock", "BLOCKQUOTE") },
    { label: "Cabeçalho", onClick: () => inserirNaPagina("<p><i>Cabeçalho</i></p>") },
    { label: "Rodapé", onClick: () => inserirNaPagina("<p><i>Rodapé</i></p>") },
    { label: "Número de página", onClick: () => inserirNaPagina(`Página ${paginasLocais.findIndex((p) => p.id === paginaAtivaId) + 1} de ${paginasLocais.length}`) },
    { label: "Quebra de página", onClick: novaPaginaAposAtiva },
    { label: "Sumário automático", onClick: inserirSumario },
    { label: "Comentário", atalho: "Ctrl+Alt+M", onClick: abrirComentarioNaSelecao },
    { label: "Menção a pessoa", onClick: inserirMencao },
    { label: "Símbolo", onClick: inserirSimbolo },
    { label: "Emoji", onClick: inserirEmoji },
  ];

  const menuFormatar: ("sep" | ItemMenu)[] = [
    { label: "Negrito", atalho: "Ctrl+B", onClick: () => aplicarFormatacao("bold") },
    { label: "Itálico", atalho: "Ctrl+I", onClick: () => aplicarFormatacao("italic") },
    { label: "Sublinhado", atalho: "Ctrl+U", onClick: () => aplicarFormatacao("underline") },
    { label: "Tachado", onClick: () => aplicarFormatacao("strikeThrough") },
    { label: "Sobrescrito", onClick: () => aplicarFormatacao("superscript") },
    { label: "Subscrito", onClick: () => aplicarFormatacao("subscript") },
    "sep",
    { label: "MAIÚSCULAS", onClick: () => document.execCommand("insertText", false, (window.getSelection()?.toString() ?? "").toUpperCase()) },
    { label: "minúsculas", onClick: () => document.execCommand("insertText", false, (window.getSelection()?.toString() ?? "").toLowerCase()) },
    "sep",
    { label: "Aumentar recuo", onClick: () => aplicarFormatacao("indent") },
    { label: "Diminuir recuo", onClick: () => aplicarFormatacao("outdent") },
    "sep",
    {
      label: "Orientação: alternar retrato/paisagem",
      onClick: () =>
        atualizarConfigPagina(id, { orientacao: doc.config.orientacao === "retrato" ? "paisagem" : "retrato" }),
    },
    { label: "Limpar formatação", atalho: "Ctrl+\\", onClick: () => aplicarFormatacao("removeFormat") },
  ];

  const menuFerramentas: ("sep" | ItemMenu)[] = [
    { label: `Corretor ortográfico: ${corretorAtivo ? "ativado" : "desativado"}`, onClick: () => setCorretorAtivo((v) => !v) },
    { label: "Contagem de palavras", atalho: "Ctrl+Shift+C", onClick: () => setContagemAberta(true) },
    { label: "Localizar e substituir", onClick: () => setLocalizarAberto(true) },
    { label: gravandoVoz ? "Parar digitação por voz" : "Digitação por voz", onClick: alternarDigitacaoPorVoz },
    "sep",
    { label: "Dicionário", onClick: () => window.alert("Dicionário exige um serviço externo — não incluído nesse protótipo.") },
    { label: "Tradução do documento", onClick: () => window.alert("Tradução exige um serviço externo — não incluído nesse protótipo.") },
    { label: "Comparar versões", onClick: () => setHistoricoAberto(true) },
    "sep",
    { label: "Preferências", onClick: () => setConfigPaginaAberto(true) },
  ];

  const menuAjuda: ("sep" | ItemMenu)[] = [
    { label: "Atalhos de teclado", onClick: () => window.alert("Ctrl+B negrito · Ctrl+I itálico · Ctrl+U sublinhado · Ctrl+Z desfazer · Ctrl+F localizar") },
    { label: "Central de ajuda do CRM AZUZ" },
  ];

  return (
    <div className="doc-editor-shell">
      <div className="doc-editor-header">
        <button type="button" className="doc-voltar-btn" onClick={onFechar} aria-label="Voltar pra lista">
          ←
        </button>
        <IconDoc width={22} height={22} />
        <input
          id="doc-titulo-input"
          className="doc-titulo-header-input"
          value={tituloLocal}
          onChange={(e) => setTituloLocal(e.target.value)}
          onBlur={() => renomearDocumento(id, tituloLocal)}
        />
        <button
          type="button"
          className="doc-favorito-btn"
          aria-label={doc.favorito ? "Remover dos favoritos" : "Favoritar"}
          onClick={() => favoritarDocumento(id)}
        >
          {doc.favorito ? "⭐" : "☆"}
        </button>
        <span className="doc-estado-salvamento">
          {estadoSalvamento === "salvando" ? "Salvando…" : "Salvo"}
        </span>
        <div className="doc-header-acoes">
          <button type="button" className="btn ghost" onClick={() => setComentariosAberto((v) => !v)}>
            💬 Comentários{doc.comentarios.filter((c) => !c.resolvido).length > 0 ? ` (${doc.comentarios.filter((c) => !c.resolvido).length})` : ""}
          </button>
          <button type="button" className="btn primary" onClick={() => setCompartilharAberto(true)}>
            Compartilhar
          </button>
          <span className="avatar doc-header-avatar">{currentUser.initials}</span>
        </div>
      </div>

      <div className="doc-menu-bar">
        <MenuTopo label="Arquivo" aberto={menuAberto === "arquivo"} onAbrir={() => setMenuAberto("arquivo")} onFechar={() => setMenuAberto(null)} itens={menuArquivo} />
        <MenuTopo label="Editar" aberto={menuAberto === "editar"} onAbrir={() => setMenuAberto("editar")} onFechar={() => setMenuAberto(null)} itens={menuEditar} />
        <MenuTopo label="Ver" aberto={menuAberto === "ver"} onAbrir={() => setMenuAberto("ver")} onFechar={() => setMenuAberto(null)} itens={menuVer} />
        <MenuTopo label="Inserir" aberto={menuAberto === "inserir"} onAbrir={() => setMenuAberto("inserir")} onFechar={() => setMenuAberto(null)} itens={menuInserir} />
        <MenuTopo label="Formatar" aberto={menuAberto === "formatar"} onAbrir={() => setMenuAberto("formatar")} onFechar={() => setMenuAberto(null)} itens={menuFormatar} />
        <MenuTopo label="Ferramentas" aberto={menuAberto === "ferramentas"} onAbrir={() => setMenuAberto("ferramentas")} onFechar={() => setMenuAberto(null)} itens={menuFerramentas} />
        <MenuTopo label="Ajuda" aberto={menuAberto === "ajuda"} onAbrir={() => setMenuAberto("ajuda")} onFechar={() => setMenuAberto(null)} itens={menuAjuda} />
      </div>

      <div className="doc-toolbar doc-toolbar-rich">
        <button type="button" className="doc-toolbar-btn" title="Desfazer" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("undo")}>↶</button>
        <button type="button" className="doc-toolbar-btn" title="Refazer" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("redo")}>↷</button>
        <button type="button" className="doc-toolbar-btn" title="Imprimir" onClick={() => imprimirOuSalvarPdf()}>🖨</button>
        <button
          type="button"
          className={`doc-toolbar-btn${corretorAtivo ? " active" : ""}`}
          title="Corretor ortográfico"
          onClick={() => setCorretorAtivo((v) => !v)}
        >
          ABC
        </button>
        <button type="button" className="doc-toolbar-btn" title="Copiar formatação" onClick={copiarFormatacao} onDoubleClick={colarFormatacao}>🖌</button>
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" title="Diminuir zoom" onClick={() => setZoom((z) => Math.max(50, z - 10))}>−</button>
        <span className="hint" style={{ minWidth: 38, textAlign: "center" }}>{zoom}%</span>
        <button type="button" className="doc-toolbar-btn" title="Aumentar zoom" onClick={() => setZoom((z) => Math.min(200, z + 10))}>+</button>
        <span className="doc-toolbar-sep" />
        <select className="doc-toolbar-select" defaultValue={ESTILOS_PARAGRAFO[0].valor} aria-label="Estilo do parágrafo" onChange={(e) => aplicarFormatacao("formatBlock", e.target.value)}>
          {ESTILOS_PARAGRAFO.map((e) => (
            <option key={e.valor} value={e.valor}>{e.label}</option>
          ))}
        </select>
        <select className="doc-toolbar-select" defaultValue={FONTES_DOCUMENTO[0].valor} aria-label="Fonte" onChange={(e) => aplicarFormatacao("fontName", e.target.value)}>
          {FONTES_DOCUMENTO.map((f) => (
            <option key={f.label} value={f.valor}>{f.label}</option>
          ))}
        </select>
        <select className="doc-toolbar-select" defaultValue={TAMANHOS_FONTE_DOC[1].valor} aria-label="Tamanho da fonte" onChange={(e) => aplicarFormatacao("fontSize", e.target.value)}>
          {TAMANHOS_FONTE_DOC.map((t) => (
            <option key={t.label} value={t.valor}>{t.label}</option>
          ))}
        </select>
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" style={{ fontWeight: 700 }} title="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("bold")}>N</button>
        <button type="button" className="doc-toolbar-btn" style={{ fontStyle: "italic" }} title="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("italic")}>I</button>
        <button type="button" className="doc-toolbar-btn" style={{ textDecoration: "underline" }} title="Sublinhado" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("underline")}>S</button>
        <button type="button" className="doc-toolbar-btn" style={{ textDecoration: "line-through" }} title="Tachado" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("strikeThrough")}>T</button>
        <span className="doc-toolbar-sep" />
        <SeletorCor titulo="Cor do texto" cores={CORES_TEXTO} onEscolher={(c) => aplicarFormatacao("foreColor", c)} rotulo="A" />
        <SeletorCor titulo="Cor de destaque" cores={CORES_DESTAQUE} onEscolher={(c) => aplicarFormatacao("hiliteColor", c)} rotulo="🖊" />
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" title="Inserir link" onClick={inserirLink}>🔗</button>
        <button type="button" className="doc-toolbar-btn" title="Inserir comentário" onClick={abrirComentarioNaSelecao}>💬</button>
        <button type="button" className="doc-toolbar-btn" title="Inserir imagem" onClick={inserirImagem}>🖼</button>
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" title="Alinhar à esquerda" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyLeft")}>≡◧</button>
        <button type="button" className="doc-toolbar-btn" title="Centralizar" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyCenter")}>≡</button>
        <button type="button" className="doc-toolbar-btn" title="Alinhar à direita" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyRight")}>◨≡</button>
        <button type="button" className="doc-toolbar-btn" title="Justificar" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyFull")}>☰</button>
        <span className="doc-toolbar-sep" />
        <select className="doc-toolbar-select" aria-label="Espaçamento entre linhas" defaultValue="1.5" onChange={(e) => {
          const el = paginaRefs.current[paginaAtivaId];
          if (el) el.style.lineHeight = e.target.value;
          salvarConteudoPagina(paginaAtivaId);
        }}>
          <option value="1">Simples</option>
          <option value="1.15">1,15</option>
          <option value="1.5">1,5</option>
          <option value="2">Duplo</option>
        </select>
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" title="Lista com marcadores" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("insertUnorderedList")}>• ≡</button>
        <button type="button" className="doc-toolbar-btn" title="Lista numerada" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("insertOrderedList")}>1.≡</button>
        <button type="button" className="doc-toolbar-btn" title="Checklist" onClick={() => inserirNaPagina('<div>☐ </div>')}>☑</button>
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" title="Diminuir recuo" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("outdent")}>⇤</button>
        <button type="button" className="doc-toolbar-btn" title="Aumentar recuo" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("indent")}>⇥</button>
        <button type="button" className="doc-toolbar-btn" title="Limpar formatação" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("removeFormat")}>✕A</button>
        <span className="doc-toolbar-sep" />
        <div className="doc-modo-switch">
          {(["edicao", "sugestao", "visualizacao"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`fchip${modo === m ? " active" : ""}`}
              onClick={() => setModo(m)}
            >
              {m === "edicao" ? "Edição" : m === "sugestao" ? "Sugestão" : "Visualização"}
            </button>
          ))}
        </div>
      </div>

      {modo === "sugestao" ? (
        <div className="doc-aviso-modo">✏️ Modo sugestão ativo — mudanças ficam registradas no histórico de comentários pra revisão.</div>
      ) : null}

      <div className="doc-canvas" style={{ zoom: `${zoom}%` } as React.CSSProperties}>
        <div className="doc-paginas-coluna">
          {paginasLocais.map((pagina, indice) => (
            <div className="doc-page-wrap" key={pagina.id}>
              {mostrarRegua ? <ReguaDocumento larguraMm={larguraMm} /> : null}
              <div
                className={`doc-page-sheet doc-print-area${semPaginas ? " doc-page-sheet-semborda" : ""}`}
                style={{
                  width: `${larguraMm}mm`,
                  minHeight: semPaginas ? undefined : `${alturaMm}mm`,
                  padding: `${doc.config.margemMm}mm`,
                  background: doc.config.corFundo,
                }}
              >
                <div
                  key={pagina.id}
                  ref={(el) => {
                    paginaRefs.current[pagina.id] = el;
                  }}
                  className={`doc-body-rich${mostrarNaoImprimiveis ? " doc-body-rich-marcas" : ""}`}
                  style={{ maxHeight: semPaginas ? undefined : `${alturaMm - doc.config.margemMm * 2}mm`, overflow: semPaginas ? "visible" : "hidden" }}
                  contentEditable={modo !== "visualizacao"}
                  suppressContentEditableWarning
                  spellCheck={corretorAtivo}
                  lang={idioma}
                  dangerouslySetInnerHTML={{ __html: pagina.conteudoHtml }}
                  onFocus={() => focarPagina(pagina.id)}
                  onInput={() => aoDigitarNaPagina(pagina.id)}
                  onBlur={() => salvarConteudoPagina(pagina.id)}
                />
                <div className="doc-page-numero">Página {indice + 1} de {paginasLocais.length}</div>
              </div>
              <div className="doc-page-fim">
                <button type="button" className="doc-page-fim-btn" onClick={novaPaginaAposAtiva}>+ Adicionar página</button>
                <button type="button" className="doc-page-fim-btn doc-page-fim-apagar" disabled={paginasLocais.length <= 1} onClick={excluirPaginaAtiva}>🗑 Apagar essa página</button>
              </div>
            </div>
          ))}
        </div>

        {comentariosAberto ? (
          <aside className="doc-comentarios-painel">
            <div className="panel-h">
              <h4>Comentários</h4>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setComentariosAberto(false)}>✕</button>
            </div>
            {doc.comentarios.length === 0 ? (
              <p className="hint" style={{ padding: 17 }}>Selecione um trecho de texto e use &quot;Inserir → Comentário&quot; pra comentar.</p>
            ) : (
              doc.comentarios.map((c) => (
                <div className={`doc-comentario-item${c.resolvido ? " resolvido" : ""}`} key={c.id}>
                  <p className="doc-comentario-trecho">&quot;{c.trecho}&quot;</p>
                  <p className="doc-comentario-texto"><b>{c.autor}:</b> {c.texto}</p>
                  {c.respostas.map((r, i) => (
                    <p className="doc-comentario-resposta" key={i}><b>{r.autor}:</b> {r.texto}</p>
                  ))}
                  <div className="doc-comentario-acoes">
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        const texto = window.prompt("Responder:");
                        if (texto) responderComentario(id, c.id, texto);
                      }}
                    >
                      Responder
                    </button>
                    <button type="button" className="link" onClick={() => resolverComentario(id, c.id)}>
                      {c.resolvido ? "Reabrir" : "Resolver"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </aside>
        ) : null}
      </div>

      {localizarAberto ? (
        <div className="wa-email-modal wa-email-floating doc-localizar-modal">
          <div className="open-conv-h" style={{ padding: 0, marginBottom: 12 }}>
            <p className="n">Localizar e substituir</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setLocalizarAberto(false)}>✕</button>
          </div>
          <div className="field" style={{ padding: "6px 0" }}>
            <input className="input" style={{ width: "100%" }} placeholder="Localizar" value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} />
          </div>
          <div className="field" style={{ padding: "6px 0" }}>
            <input className="input" style={{ width: "100%" }} placeholder="Substituir por" value={substituirTexto} onChange={(e) => setSubstituirTexto(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={localizarProximo}>Localizar</button>
            <button type="button" className="btn primary" style={{ flex: 1 }} onClick={substituirTodos}>Substituir todos</button>
          </div>
        </div>
      ) : null}

      {contagemAberta ? (
        <div className="wa-email-modal wa-email-floating doc-contagem-modal">
          <div className="open-conv-h" style={{ padding: 0, marginBottom: 12 }}>
            <p className="n">Contagem</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setContagemAberta(false)}>✕</button>
          </div>
          <div className="stat-row"><span className="sl">Palavras</span><span className="sv">{contagem.palavras}</span></div>
          <div className="stat-row"><span className="sl">Caracteres</span><span className="sv">{contagem.caracteres}</span></div>
          <div className="stat-row"><span className="sl">Páginas</span><span className="sv">{contagem.paginas}</span></div>
        </div>
      ) : null}

      {detalhesAberto ? (
        <div className="wa-email-modal wa-email-floating doc-contagem-modal">
          <div className="open-conv-h" style={{ padding: 0, marginBottom: 12 }}>
            <p className="n">Detalhes do documento</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setDetalhesAberto(false)}>✕</button>
          </div>
          <div className="stat-row"><span className="sl">Autor</span><span className="sv">{doc.autor}</span></div>
          <div className="stat-row"><span className="sl">Criado em</span><span className="sv">{formatarQuando(doc.criadoEm)}</span></div>
          <div className="stat-row"><span className="sl">Última edição</span><span className="sv">{formatarQuando(doc.atualizadoEm)}</span></div>
          <div className="stat-row"><span className="sl">Palavras</span><span className="sv">{contagem.palavras}</span></div>
        </div>
      ) : null}

      {configPaginaAberto ? (
        <div className="form-preview-overlay" onClick={() => setConfigPaginaAberto(false)}>
          <div className="wa-email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">Configuração da página</p>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setConfigPaginaAberto(false)}>✕</button>
            </div>
            <div className="field">
              <label>Tamanho do papel</label>
              <select className="input" style={{ width: "100%" }} value={doc.config.tamanho} onChange={(e) => atualizarConfigPagina(id, { tamanho: e.target.value as TamanhoPapel })}>
                <option value="A4">A4</option>
                <option value="Carta">Carta</option>
                <option value="Ofício">Ofício</option>
              </select>
            </div>
            <div className="field">
              <label>Orientação</label>
              <div className="filters-row" style={{ margin: 0 }}>
                <button type="button" className={`fchip${doc.config.orientacao === "retrato" ? " active" : ""}`} onClick={() => atualizarConfigPagina(id, { orientacao: "retrato" })}>Retrato</button>
                <button type="button" className={`fchip${doc.config.orientacao === "paisagem" ? " active" : ""}`} onClick={() => atualizarConfigPagina(id, { orientacao: "paisagem" })}>Paisagem</button>
              </div>
            </div>
            <div className="field">
              <label>Margem (mm)</label>
              <input
                type="number"
                className="input"
                style={{ width: "100%" }}
                value={doc.config.margemMm}
                onChange={(e) => atualizarConfigPagina(id, { margemMm: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Cor da página</label>
              <input
                type="color"
                className="input"
                style={{ width: "100%", height: 38, padding: 4 }}
                value={doc.config.corFundo}
                onChange={(e) => atualizarConfigPagina(id, { corFundo: e.target.value })}
              />
            </div>
            <button type="button" className="btn primary block" onClick={() => setConfigPaginaAberto(false)}>
              Aplicar
            </button>
          </div>
        </div>
      ) : null}

      {compartilharAberto ? (
        <div className="form-preview-overlay" onClick={() => setCompartilharAberto(false)}>
          <div className="wa-email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">Compartilhar &quot;{doc.titulo}&quot;</p>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setCompartilharAberto(false)}>✕</button>
            </div>
            <div className="field" style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="E-mail da pessoa"
                value={novoEmailAcesso}
                onChange={(e) => setNovoEmailAcesso(e.target.value)}
              />
              <select
                className="doc-toolbar-select"
                value={novaPermissaoAcesso}
                onChange={(e) => setNovaPermissaoAcesso(e.target.value as PermissaoAcesso)}
              >
                <option value="visualizar">Pode ver</option>
                <option value="comentar">Pode comentar</option>
                <option value="editar">Pode editar</option>
              </select>
              <button
                type="button"
                className="btn primary"
                disabled={!novoEmailAcesso.trim()}
                onClick={() => {
                  atualizarAcesso(id, {
                    pessoasAcesso: [...doc.pessoasAcesso, { email: novoEmailAcesso.trim(), permissao: novaPermissaoAcesso }],
                  });
                  setNovoEmailAcesso("");
                }}
              >
                Convidar
              </button>
            </div>
            <p className="hint" style={{ marginBottom: 10 }}>
              O convite fica registrado aqui — o envio real de e-mail depende de um serviço de e-mail conectado ao CRM.
            </p>
            {doc.pessoasAcesso.length > 0 ? (
              <div className="mb14">
                <p className="doc-sidebar-h">Pessoas com acesso</p>
                {doc.pessoasAcesso.map((p) => (
                  <div className="stat-row" key={p.email}>
                    <span className="sl">{p.email} · {p.permissao}</span>
                    <button
                      type="button"
                      className="link"
                      style={{ color: "#d64545" }}
                      onClick={() =>
                        atualizarAcesso(id, { pessoasAcesso: doc.pessoasAcesso.filter((x) => x.email !== p.email) })
                      }
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="field">
              <label>Acesso geral</label>
              <div className="filters-row" style={{ margin: 0 }}>
                <button type="button" className={`fchip${!doc.linkAtivo ? " active" : ""}`} onClick={() => atualizarAcesso(id, { linkAtivo: false })}>Restrito</button>
                <button type="button" className={`fchip${doc.linkAtivo ? " active" : ""}`} onClick={() => atualizarAcesso(id, { linkAtivo: true })}>Qualquer um com o link</button>
              </div>
            </div>
            {doc.linkAtivo ? (
              <div className="field" style={{ display: "flex", gap: 8 }}>
                <input className="input" style={{ flex: 1 }} readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/documentos?doc=${id}`} />
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/documentos?doc=${id}`)}
                >
                  Copiar link
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {historicoAberto ? (
        <div className="form-preview-overlay" onClick={() => setHistoricoAberto(false)}>
          <div className="wa-email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">Histórico de versões</p>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setHistoricoAberto(false)}>✕</button>
            </div>
            <button
              type="button"
              className="btn ghost block mb14"
              onClick={() => {
                const nome = window.prompt("Nome dessa versão (opcional):") ?? undefined;
                salvarVersao(id, nome);
              }}
            >
              + Salvar versão atual
            </button>
            {doc.versoes.length === 0 ? (
              <p className="hint">Nenhuma versão salva ainda.</p>
            ) : (
              [...doc.versoes].reverse().map((v) => (
                <div className="stat-row" key={v.id}>
                  <span className="sl">{v.nome ?? "Sem nome"} · {v.autor} · {formatarQuando(v.quando)}</span>
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      if (window.confirm("Restaurar essa versão? O conteúdo atual será substituído.")) {
                        restaurarVersao(id, v.id);
                        setHistoricoAberto(false);
                      }
                    }}
                  >
                    Restaurar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SeletorCor({
  titulo,
  cores,
  onEscolher,
  rotulo,
}: {
  titulo: string;
  cores: string[];
  onEscolher: (cor: string) => void;
  rotulo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="doc-toolbar-btn"
        title={titulo}
        onClick={() => {
          if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
          setAberto((v) => !v);
        }}
      >
        {rotulo}
      </button>
      <FloatingDropdown anchorRect={aberto ? rect : null} onClose={() => setAberto(false)} width={180}>
        <div className="doc-cores-grid">
          {cores.map((c) => (
            <button
              key={c}
              type="button"
              className="doc-cor-swatch"
              style={{ background: c === "transparent" ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0/8px 8px" : c }}
              title={c}
              onClick={() => {
                onEscolher(c);
                setAberto(false);
              }}
            />
          ))}
        </div>
      </FloatingDropdown>
    </>
  );
}
