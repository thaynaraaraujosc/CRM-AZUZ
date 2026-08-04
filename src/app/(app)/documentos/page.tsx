"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { currentUser, equipe } from "@/lib/data";
import {
  useDocumentos,
  type CategoriaModelo,
  type ModeloDocumento,
  type PaginaDoc,
  type PermissaoAcesso,
  type TamanhoPapel,
} from "@/lib/documentos-context";
import {
  abrirPreviaImpressaoLimpa,
  analisarSelecaoPaginas,
  baixarDocx,
  baixarHtml,
  baixarPdfReal,
  baixarRtf,
  baixarTxt,
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

/** Fecha um popup flutuante ao clicar fora dele — mesmo padrão usado em Conversas. */
function useFecharAoClicarFora(
  ref: React.RefObject<HTMLElement | null>,
  ativo: boolean,
  aoFechar: () => void,
) {
  useEffect(() => {
    if (!ativo) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) aoFechar();
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
}

let contadorIdImagem = 0;
/** Id estável pra cada imagem inserida — usado só como `key` do painel/handles no React, pra resetar o
 * estado local (unidade de medida, corte pendente, efeitos) sempre que a imagem selecionada troca. */
function proximoIdImagem(): string {
  contadorIdImagem += 1;
  return `img-${Date.now()}-${contadorIdImagem}`;
}

/** Garante que uma imagem tenha `data-doc-img-id` mesmo se veio de um documento antigo/seed sem o atributo. */
function garantirIdImagem(img: HTMLImageElement): string {
  if (!img.dataset.docImgId) img.dataset.docImgId = proximoIdImagem();
  return img.dataset.docImgId;
}

/**
 * Fábrica de handler de arraste — permite mover qualquer popup flutuante pela tela,
 * pegando pelo cabeçalho. A posição é sempre grampeada (clamp) aos limites da
 * viewport usando o tamanho real do painel, então nenhum painel pode ser
 * arrastado para fora da tela e "sumir".
 */
function criarIniciarArraste(seletor: string, setPos: (p: { x: number; y: number }) => void) {
  return (e: React.MouseEvent) => {
    const el = (e.currentTarget as HTMLElement).closest(seletor) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const margem = 8;
    function clampPos(x: number, y: number) {
      const maxX = Math.max(margem, window.innerWidth - rect.width - margem);
      const maxY = Math.max(margem, window.innerHeight - rect.height - margem);
      return {
        x: Math.min(Math.max(x, margem), maxX),
        y: Math.min(Math.max(y, margem), maxY),
      };
    }
    function mover(ev: MouseEvent) {
      setPos(clampPos(ev.clientX - dx, ev.clientY - dy));
    }
    function soltar() {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  };
}

/* -------------------------------------------------------------------------- */
/* Constantes                                                                  */
/* -------------------------------------------------------------------------- */

const TAMANHOS_PAPEL_MM: Record<Exclude<TamanhoPapel, "Personalizado">, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Carta: { w: 216, h: 279 },
  "Ofício": { w: 216, h: 356 },
};

/**
 * Fontes do documento — sempre com uma pilha de fallback (a fonte muda pra próxima da lista se a
 * primeira não existir no computador de quem está lendo/editando). Não dá pra ler a lista real de
 * fontes instaladas no sistema: a Local Font Access API (window.queryLocalFonts) só existe no
 * Chrome/Edge, atrás de uma permissão que o usuário precisa aceitar, e nem faz parte de nenhum padrão
 * suportado no Firefox/Safari — depender dela quebraria o editor nesses navegadores. Por isso a lista
 * é uma seleção de fontes "web-safe" (que praticamente todo sistema operacional já tem instalada).
 */
const FONTES_DOCUMENTO = [
  { label: "Arial", valor: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", valor: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", valor: "'Times New Roman', Georgia, serif" },
  { label: "Georgia", valor: "Georgia, 'Times New Roman', serif" },
  { label: "Garamond", valor: "Garamond, Georgia, serif" },
  { label: "Palatino", valor: "'Palatino Linotype', Palatino, Georgia, serif" },
  { label: "Verdana", valor: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", valor: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", valor: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: "Courier New", valor: "'Courier New', Courier, monospace" },
  { label: "Comic Sans MS", valor: "'Comic Sans MS', 'Comic Sans', cursive" },
  { label: "Impact", valor: "Impact, Haettenschweiler, sans-serif" },
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

/** Lê uma preferência de visualização (Ver → …) persistida — sobrevive entre sessões, por padrão do usuário. */
function lerPrefVer(chave: string, padrao: boolean): boolean {
  if (typeof window === "undefined") return padrao;
  try {
    const salvas = localStorage.getItem("azuz-crm-documentos-prefs-ver");
    if (!salvas) return padrao;
    const p = JSON.parse(salvas) as Record<string, unknown>;
    return typeof p[chave] === "boolean" ? (p[chave] as boolean) : padrao;
  } catch {
    return padrao;
  }
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

type Aba = "recentes" | "favoritos" | "lixeira";
const ABAS: { valor: Aba; label: string }[] = [
  { valor: "recentes", label: "Recentes" },
  { valor: "favoritos", label: "Favoritos" },
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
    todosOsModelos,
    modelosPersonalizados,
    excluirModeloPersonalizado,
    duplicarModelo,
    modelosFavoritosIds,
    alternarFavoritoModelo,
    modelosRecentesIds,
  } = useDocumentos();

  const [aba, setAba] = useState<Aba>("recentes");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"nome" | "criacao" | "edicao">("edicao");
  const [modelosAberto, setModelosAberto] = useState(false);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [nomeRenomear, setNomeRenomear] = useState("");
  const [acaoAbertaId, setAcaoAbertaId] = useState<string | null>(null);
  const [acaoRect, setAcaoRect] = useState<DOMRect | null>(null);

  const [buscaModelo, setBuscaModelo] = useState("");
  const [categoriaModelo, setCategoriaModelo] = useState<CategoriaModelo | "todas">("todas");
  const [abaModelos, setAbaModelos] = useState<"todos" | "recentes" | "favoritos" | "meus" | "recomendados">("todos");
  const [modeloPreviewId, setModeloPreviewId] = useState<string | null>(null);
  const [carregandoGaleria, setCarregandoGaleria] = useState(false);

  useEffect(() => {
    if (!modelosAberto) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carregamento visual só do popup de modelos, não realimenta o próprio efeito
    setCarregandoGaleria(true);
    const t = setTimeout(() => setCarregandoGaleria(false), 250);
    return () => clearTimeout(t);
  }, [modelosAberto]);

  const CATEGORIAS_MODELO: CategoriaModelo[] = [
    "Negócios", "Vendas", "Marketing", "Saúde", "Recursos Humanos", "Jurídico",
    "Financeiro", "Educação", "Planejamento", "Relatórios", "Comunicação", "Documentos pessoais",
  ];

  const modelosPorAba: ModeloDocumento[] =
    abaModelos === "recentes"
      ? modelosRecentesIds.map((mid) => todosOsModelos.find((m) => m.id === mid)).filter((m): m is ModeloDocumento => !!m)
      : abaModelos === "favoritos"
      ? todosOsModelos.filter((m) => modelosFavoritosIds.includes(m.id))
      : abaModelos === "meus"
      ? modelosPersonalizados
      : abaModelos === "recomendados"
      ? todosOsModelos.filter((m) => ["proposta", "relatorio", "curriculo", "ata"].includes(m.id))
      : todosOsModelos;

  const modelosFiltrados = modelosPorAba.filter(
    (m) =>
      (categoriaModelo === "todas" || m.categoria === categoriaModelo) &&
      (m.nome.toLowerCase().includes(buscaModelo.trim().toLowerCase()) ||
        m.descricao.toLowerCase().includes(buscaModelo.trim().toLowerCase())),
  );

  const modeloEmPreview = todosOsModelos.find((m) => m.id === modeloPreviewId) ?? null;

  const visiveis = documentos.filter((d) => {
    if (aba === "lixeira") return d.excluido;
    if (d.excluido) return false;
    if (aba === "favoritos") return d.favorito;
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
              <h4>Galeria de modelos</h4>
            </div>

            <div className="filters-row mb14" style={{ padding: "0 16px" }}>
              <button type="button" className={`fchip${abaModelos === "todos" ? " active" : ""}`} onClick={() => setAbaModelos("todos")}>Todos</button>
              <button type="button" className={`fchip${abaModelos === "recomendados" ? " active" : ""}`} onClick={() => setAbaModelos("recomendados")}>Recomendados</button>
              <button type="button" className={`fchip${abaModelos === "recentes" ? " active" : ""}`} onClick={() => setAbaModelos("recentes")}>Recentes</button>
              <button type="button" className={`fchip${abaModelos === "favoritos" ? " active" : ""}`} onClick={() => setAbaModelos("favoritos")}>Favoritos</button>
              <button type="button" className={`fchip${abaModelos === "meus" ? " active" : ""}`} onClick={() => setAbaModelos("meus")}>Meus modelos ({modelosPersonalizados.length})</button>
              <label className="search" style={{ marginLeft: "auto", width: 220 }}>
                <IconSearch />
                <input placeholder="Pesquisar modelos…" value={buscaModelo} onChange={(e) => setBuscaModelo(e.target.value)} />
              </label>
            </div>

            <div className="filters-row mb14" style={{ padding: "0 16px", flexWrap: "wrap" }}>
              <button type="button" className={`fchip${categoriaModelo === "todas" ? " active" : ""}`} onClick={() => setCategoriaModelo("todas")}>Todas as categorias</button>
              {CATEGORIAS_MODELO.map((c) => (
                <button type="button" key={c} className={`fchip${categoriaModelo === c ? " active" : ""}`} onClick={() => setCategoriaModelo(c)}>{c}</button>
              ))}
            </div>

            {carregandoGaleria ? (
              <div className="doc-modelos-grid" style={{ padding: "0 16px 16px" }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="doc-modelo-card doc-modelo-card-skeleton" aria-hidden="true" />
                ))}
              </div>
            ) : modelosFiltrados.length === 0 ? (
              <p className="hint" style={{ padding: "0 16px 16px" }}>
                {abaModelos === "meus"
                  ? "Você ainda não salvou nenhum modelo — abra um documento e use Arquivo → Salvar como modelo."
                  : abaModelos === "favoritos"
                  ? "Nenhum modelo favoritado ainda — passe o mouse num modelo e clique em ☆ pra favoritar."
                  : "Nenhum modelo encontrado com esse filtro."}
              </p>
            ) : (
              <div className="doc-modelos-grid" style={{ padding: "0 16px 16px" }}>
                {modelosFiltrados.map((m) => (
                  <div
                    key={m.id}
                    className="doc-modelo-card doc-modelo-card-rica"
                    tabIndex={0}
                    role="button"
                    onClick={() => novoDocumento(m.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") novoDocumento(m.id); }}
                  >
                    <div className="doc-modelo-thumb">
                      {m.conteudoHtml ? (
                        <div className="doc-modelo-thumb-escala" dangerouslySetInnerHTML={{ __html: m.conteudoHtml }} />
                      ) : (
                        <span className="doc-modelo-icone"><IconDoc width={28} height={28} /></span>
                      )}
                      <div className="doc-modelo-thumb-acoes">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={(e) => { e.stopPropagation(); setModeloPreviewId(m.id); }}
                        >
                          Visualizar
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={(e) => { e.stopPropagation(); novoDocumento(m.id); }}
                        >
                          Usar este modelo
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          title="Cria uma cópia editável deste modelo em 'Meus modelos', sem alterar o original"
                          onClick={(e) => { e.stopPropagation(); duplicarModelo(m.id); }}
                        >
                          Duplicar
                        </button>
                      </div>
                      <button
                        type="button"
                        className="doc-modelo-favorito"
                        aria-label={modelosFavoritosIds.includes(m.id) ? "Remover dos favoritos" : "Favoritar"}
                        onClick={(e) => { e.stopPropagation(); alternarFavoritoModelo(m.id); }}
                      >
                        {modelosFavoritosIds.includes(m.id) ? "⭐" : "☆"}
                      </button>
                    </div>
                    <span className="doc-modelo-categoria">{m.categoria}</span>
                    <span className="n">{m.nome}</span>
                    <span className="hint">{m.descricao}</span>
                    {abaModelos === "meus" ? (
                      <button
                        type="button"
                        className="link"
                        style={{ marginTop: 4, color: "var(--danger)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Excluir o modelo "${m.nome}"?`)) excluirModeloPersonalizado(m.id);
                        }}
                      >
                        Excluir modelo
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {modeloEmPreview ? (
          <div className="modal-overlay" onClick={() => setModeloPreviewId(null)}>
            <div className="modal doc-modelo-preview-modal" onClick={(e) => e.stopPropagation()}>
              <div className="panel-h">
                <div>
                  <h4>{modeloEmPreview.nome}</h4>
                  <p className="hint" style={{ margin: 0 }}>{modeloEmPreview.categoria} · {modeloEmPreview.descricao}</p>
                </div>
                <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setModeloPreviewId(null)}>✕</button>
              </div>
              <div className="doc-modelo-preview-corpo">
                {modeloEmPreview.conteudoHtml ? (
                  <div className="doc-modelo-preview-folha" dangerouslySetInnerHTML={{ __html: modeloEmPreview.conteudoHtml }} />
                ) : (
                  <p className="hint">Documento em branco — página limpa em A4.</p>
                )}
              </div>
              <div className="panel-f" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn ghost" onClick={() => setModeloPreviewId(null)}>Fechar</button>
                <button type="button" className="btn primary" onClick={() => novoDocumento(modeloEmPreview.id)}>Usar este modelo</button>
              </div>
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
              style={{ marginLeft: "auto", color: "var(--danger)" }}
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
                        style={{ width: "100%", textAlign: "left", color: "var(--danger)" }}
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
                        style={{ width: "100%", textAlign: "left", color: "var(--danger)" }}
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
        onMouseDown={(e) => e.preventDefault()}
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
              onMouseDown={(e) => e.preventDefault()}
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

/**
 * Grupo de botões da barra de ferramentas do editor, escondidos atrás de um botão só ("Inserir ▾",
 * "Parágrafo ▾"...) — reduz a quantidade de ícones sempre visíveis sem esconder a função embaixo de
 * vários cliques. Fica aberto até o usuário clicar fora (mesmo comportamento do "Mais filtros" em
 * FilterBar), então dá pra usar vários controles do grupo em sequência sem reabrir o menu.
 */
function GrupoToolbar({ rotulo, icone, largura = 220, children }: { rotulo: string; icone?: string; largura?: number; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={`doc-toolbar-btn doc-toolbar-btn-grupo${aberto ? " active" : ""}`}
        onClick={() => {
          if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
          setAberto((v) => !v);
        }}
      >
        {icone ? `${icone} ` : ""}{rotulo} ▾
      </button>
      <FloatingDropdown anchorRect={aberto ? rect : null} onClose={() => setAberto(false)} width={largura}>
        <div className="doc-toolbar-grupo-conteudo">{children}</div>
      </FloatingDropdown>
    </>
  );
}

/**
 * Régua horizontal com marcadores de margem arrastáveis, igual ao Word — arrastar muda a margem de
 * verdade. Esquerda e direita são independentes: mover uma nunca move a outra (cada uma tem seu
 * próprio callback, ao contrário de antes onde as duas dividiam o mesmo valor de margem).
 */
function ReguaDocumento({
  larguraMm,
  margemEsquerdaMm,
  margemDireitaMm,
  onMudarEsquerda,
  onMudarDireita,
  tabulacoesMm,
  onMudarTabulacoes,
  recuo,
  onMudarRecuo,
}: {
  larguraMm: number;
  margemEsquerdaMm: number;
  margemDireitaMm: number;
  onMudarEsquerda: (mm: number) => void;
  onMudarDireita: (mm: number) => void;
  tabulacoesMm: number[];
  onMudarTabulacoes: (novas: number[]) => void;
  recuo: { primeiraLinhaMm: number; esquerdoMm: number; direitoMm: number };
  onMudarRecuo: (patch: Partial<{ primeiraLinhaMm: number; esquerdoMm: number; direitoMm: number }>) => void;
}) {
  const reguaRef = useRef<HTMLDivElement>(null);
  const marcasQtd = Math.round(larguraMm / 10);
  const marcas = Array.from({ length: marcasQtd + 1 }, (_, i) => i);
  const arrastandoRef = useRef(false);

  function iniciarArrasteMargem(lado: "esquerda" | "direita") {
    return (eDown: React.MouseEvent) => {
      eDown.preventDefault();
      function mover(ev: MouseEvent) {
        const el = reguaRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const xMm = ((ev.clientX - rect.left) / rect.width) * larguraMm;
        if (lado === "esquerda") {
          onMudarEsquerda(Math.round(Math.min(Math.max(xMm, 5), larguraMm - margemDireitaMm - 10)));
        } else {
          onMudarDireita(Math.round(Math.min(Math.max(larguraMm - xMm, 5), larguraMm - margemEsquerdaMm - 10)));
        }
      }
      function soltar() {
        window.removeEventListener("mousemove", mover);
        window.removeEventListener("mouseup", soltar);
      }
      window.addEventListener("mousemove", mover);
      window.addEventListener("mouseup", soltar);
    };
  }

  /** Clicar num espaço vazio da régua adiciona uma tabulação nova ali. */
  function aoClicarNaRegua(e: React.MouseEvent) {
    if (arrastandoRef.current) return; // era o fim de um arraste, não um clique de verdade
    const el = reguaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xMm = Math.round(((e.clientX - rect.left) / rect.width) * larguraMm);
    if (xMm <= margemEsquerdaMm || xMm >= larguraMm - margemDireitaMm) return; // só dentro da área útil
    onMudarTabulacoes([...tabulacoesMm, xMm].sort((a, b) => a - b));
  }

  function iniciarArrasteTabulacao(indice: number) {
    return (eDown: React.MouseEvent) => {
      eDown.preventDefault();
      eDown.stopPropagation();
      arrastandoRef.current = true;
      function mover(ev: MouseEvent) {
        const el = reguaRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const xMm = Math.round(((ev.clientX - rect.left) / rect.width) * larguraMm);
        const novas = [...tabulacoesMm];
        novas[indice] = Math.min(Math.max(xMm, margemEsquerdaMm), larguraMm - margemDireitaMm);
        onMudarTabulacoes(novas);
      }
      function soltar() {
        window.removeEventListener("mousemove", mover);
        window.removeEventListener("mouseup", soltar);
        onMudarTabulacoes([...tabulacoesMm].sort((a, b) => a - b));
        setTimeout(() => { arrastandoRef.current = false; }, 0);
      }
      window.addEventListener("mousemove", mover);
      window.addEventListener("mouseup", soltar);
    };
  }

  function removerTabulacao(indice: number) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onMudarTabulacoes(tabulacoesMm.filter((_, i) => i !== indice));
    };
  }

  /** Recuo do parágrafo atual — completamente independente da margem da página (soma-se a ela). */
  function iniciarArrasteRecuo(tipo: "primeiraLinha" | "esquerdo" | "direito") {
    return (eDown: React.MouseEvent) => {
      eDown.preventDefault();
      eDown.stopPropagation();
      function mover(ev: MouseEvent) {
        const el = reguaRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const xMm = ((ev.clientX - rect.left) / rect.width) * larguraMm;
        if (tipo === "esquerdo") {
          const novoEsquerdo = Math.max(0, xMm - margemEsquerdaMm);
          onMudarRecuo({ esquerdoMm: novoEsquerdo });
        } else if (tipo === "direito") {
          const novoDireito = Math.max(0, larguraMm - margemDireitaMm - xMm);
          onMudarRecuo({ direitoMm: novoDireito });
        } else {
          const novaPrimeiraLinha = xMm - margemEsquerdaMm - recuo.esquerdoMm;
          onMudarRecuo({ primeiraLinhaMm: Math.max(-recuo.esquerdoMm, novaPrimeiraLinha) });
        }
      }
      function soltar() {
        window.removeEventListener("mousemove", mover);
        window.removeEventListener("mouseup", soltar);
      }
      window.addEventListener("mousemove", mover);
      window.addEventListener("mouseup", soltar);
    };
  }

  return (
    <div className="doc-regua" ref={reguaRef} onClick={aoClicarNaRegua} title="Clique num espaço vazio pra adicionar uma tabulação">
      {marcas.map((cm) => (
        <span key={cm} className="doc-regua-marca" aria-hidden="true">
          {cm > 0 ? cm : ""}
        </span>
      ))}
      <div
        className="doc-regua-margem doc-regua-margem-esq"
        style={{ left: `${(margemEsquerdaMm / larguraMm) * 100}%` }}
        onMouseDown={iniciarArrasteMargem("esquerda")}
        title={`Margem esquerda: ${margemEsquerdaMm}mm — arraste pra ajustar`}
      />
      <div
        className="doc-regua-margem doc-regua-margem-dir"
        style={{ left: `${((larguraMm - margemDireitaMm) / larguraMm) * 100}%` }}
        onMouseDown={iniciarArrasteMargem("direita")}
        title={`Margem direita: ${margemDireitaMm}mm — arraste pra ajustar`}
      />
      {tabulacoesMm.map((mm, indice) => (
        <div
          key={indice}
          className="doc-regua-tabulacao"
          style={{ left: `${(mm / larguraMm) * 100}%` }}
          onMouseDown={iniciarArrasteTabulacao(indice)}
          onDoubleClick={removerTabulacao(indice)}
          title={`Tabulação em ${mm}mm — arraste pra mover, duplo clique pra remover`}
        />
      ))}
      <div
        className="doc-regua-recuo doc-regua-recuo-primeira-linha"
        style={{ left: `${((margemEsquerdaMm + recuo.esquerdoMm + recuo.primeiraLinhaMm) / larguraMm) * 100}%` }}
        onMouseDown={iniciarArrasteRecuo("primeiraLinha")}
        title={`Recuo da primeira linha do parágrafo: ${Math.round(recuo.primeiraLinhaMm)}mm — arraste pra ajustar (independente da margem)`}
      />
      <div
        className="doc-regua-recuo doc-regua-recuo-esquerdo"
        style={{ left: `${((margemEsquerdaMm + recuo.esquerdoMm) / larguraMm) * 100}%` }}
        onMouseDown={iniciarArrasteRecuo("esquerdo")}
        title={`Recuo esquerdo do parágrafo: ${Math.round(recuo.esquerdoMm)}mm — arraste pra ajustar (independente da margem)`}
      />
      <div
        className="doc-regua-recuo doc-regua-recuo-direito"
        style={{ left: `${((larguraMm - margemDireitaMm - recuo.direitoMm) / larguraMm) * 100}%` }}
        onMouseDown={iniciarArrasteRecuo("direito")}
        title={`Recuo direito do parágrafo: ${Math.round(recuo.direitoMm)}mm — arraste pra ajustar (independente da margem)`}
      />
    </div>
  );
}

/** Régua vertical, espelhando a horizontal: margens superior/inferior independentes, arrastáveis. */
function ReguaVerticalDocumento({
  alturaMm,
  margemSuperiorMm,
  margemInferiorMm,
  onMudarSuperior,
  onMudarInferior,
}: {
  alturaMm: number;
  margemSuperiorMm: number;
  margemInferiorMm: number;
  onMudarSuperior: (mm: number) => void;
  onMudarInferior: (mm: number) => void;
}) {
  const reguaRef = useRef<HTMLDivElement>(null);
  const marcasQtd = Math.round(alturaMm / 10);
  const marcas = Array.from({ length: marcasQtd + 1 }, (_, i) => i);

  function iniciarArrasteMargem(lado: "superior" | "inferior") {
    return (eDown: React.MouseEvent) => {
      eDown.preventDefault();
      function mover(ev: MouseEvent) {
        const el = reguaRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const yMm = ((ev.clientY - rect.top) / rect.height) * alturaMm;
        if (lado === "superior") {
          onMudarSuperior(Math.round(Math.min(Math.max(yMm, 5), alturaMm - margemInferiorMm - 10)));
        } else {
          onMudarInferior(Math.round(Math.min(Math.max(alturaMm - yMm, 5), alturaMm - margemSuperiorMm - 10)));
        }
      }
      function soltar() {
        window.removeEventListener("mousemove", mover);
        window.removeEventListener("mouseup", soltar);
      }
      window.addEventListener("mousemove", mover);
      window.addEventListener("mouseup", soltar);
    };
  }

  return (
    <div className="doc-regua-vertical" ref={reguaRef}>
      {marcas.map((cm) => (
        <span key={cm} className="doc-regua-vertical-marca" aria-hidden="true">
          {cm > 0 ? cm : ""}
        </span>
      ))}
      <div
        className="doc-regua-vertical-margem doc-regua-vertical-margem-sup"
        style={{ top: `${(margemSuperiorMm / alturaMm) * 100}%` }}
        onMouseDown={iniciarArrasteMargem("superior")}
        title={`Margem superior: ${margemSuperiorMm}mm — arraste pra ajustar`}
      />
      <div
        className="doc-regua-vertical-margem doc-regua-vertical-margem-inf"
        style={{ top: `${((alturaMm - margemInferiorMm) / alturaMm) * 100}%` }}
        onMouseDown={iniciarArrasteMargem("inferior")}
        title={`Margem inferior: ${margemInferiorMm}mm — arraste pra ajustar`}
      />
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
    salvarComoModelo,
  } = useDocumentos();

  const doc = documentos.find((d) => d.id === id);

  const [paginasLocais, setPaginasLocais] = useState<PaginaDoc[]>(doc?.paginas ?? []);
  const [tituloLocal, setTituloLocal] = useState(doc?.titulo ?? "");
  const [paginaAtivaId, setPaginaAtivaId] = useState(doc?.paginas[0]?.id ?? "");
  const [estadoSalvamento, setEstadoSalvamento] = useState<"salvo" | "salvando">("salvo");
  const [menuAberto, setMenuAberto] = useState<NomeMenu | null>(null);
  const [zoom, setZoom] = useState(100);
  const [modo, setModo] = useState<"edicao" | "sugestao" | "visualizacao">("edicao");
  /** Snapshot do conteúdo de cada página no instante em que o modo sugestão foi ativado — null = não está rastreando. */
  const [sugestaoSnapshot, setSugestaoSnapshot] = useState<Record<string, string> | null>(null);
  const [mostrarRegua, setMostrarRegua] = useState(() => lerPrefVer("mostrarRegua", true));
  const [mostrarNaoImprimiveis, setMostrarNaoImprimiveis] = useState(() => lerPrefVer("mostrarNaoImprimiveis", false));
  const [semPaginas, setSemPaginas] = useState(() => lerPrefVer("semPaginas", false));
  const [corretorAtivo, setCorretorAtivo] = useState(() => lerPrefVer("corretorAtivo", true));
  const [fonteAtual, setFonteAtual] = useState(FONTES_DOCUMENTO[0].valor);
  // Prioridade 5 da reformulação: o topo passa a mostrar só ações globais (desfazer/refazer/zoom/
  // imprimir, agora em doc-header-acoes) por padrão — a barra de formatação completa (fonte, negrito,
  // Inserir/Parágrafo/Mais opções) fica escondida até o usuário pedir ("🎨 Formatação" no cabeçalho, ou
  // Ver → Mostrar barra de ferramentas), já que o painel lateral (aba Texto) cobre o mesmo terreno.
  const [mostrarToolbar, setMostrarToolbar] = useState(() => lerPrefVer("mostrarToolbar", false));
  const [telaCheia, setTelaCheia] = useState(false);
  const [estruturaAberta, setEstruturaAberta] = useState(false);
  const [idioma, setIdioma] = useState("pt-BR");

  useEffect(() => {
    try {
      localStorage.setItem(
        "azuz-crm-documentos-prefs-ver",
        JSON.stringify({ mostrarRegua, mostrarNaoImprimiveis, semPaginas, corretorAtivo, mostrarToolbar }),
      );
    } catch {
      // localStorage indisponível — segue só em memória
    }
  }, [mostrarRegua, mostrarNaoImprimiveis, semPaginas, corretorAtivo, mostrarToolbar]);

  useEffect(() => {
    function aoMudarFullscreen() {
      setTelaCheia(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", aoMudarFullscreen);
    return () => document.removeEventListener("fullscreenchange", aoMudarFullscreen);
  }, []);

  const [configPaginaAberto, setConfigPaginaAberto] = useState(false);
  const [compartilharAberto, setCompartilharAberto] = useState(false);
  const [comentariosAberto, setComentariosAberto] = useState(false);
  const [painelLateralAberto, setPainelLateralAberto] = useState(true);
  const [abaPainelPadrao, setAbaPainelPadrao] = useState<"texto" | "pagina">("texto");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [localizarAberto, setLocalizarAberto] = useState(false);
  const [contagemAberta, setContagemAberta] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [salvarModeloAberto, setSalvarModeloAberto] = useState(false);
  const [nomeNovoModelo, setNomeNovoModelo] = useState("");
  const [descricaoNovoModelo, setDescricaoNovoModelo] = useState("");
  const [categoriaNovoModelo, setCategoriaNovoModelo] = useState<CategoriaModelo>("Negócios");
  const [compartilharNovoModelo, setCompartilharNovoModelo] = useState(false);
  const [cabecalhoRodapeAberto, setCabecalhoRodapeAberto] = useState<"cabecalho" | "rodape" | null>(null);
  const cabecalhoRodapeEditRef = useRef<HTMLDivElement>(null);
  const [gravandoVoz, setGravandoVoz] = useState(false);

  const [buscaTexto, setBuscaTexto] = useState("");
  const [substituirTexto, setSubstituirTexto] = useState("");
  const [diferenciarCase, setDiferenciarCase] = useState(false);
  const [buscaIndiceAtual, setBuscaIndiceAtual] = useState(0);
  const [totalOcorrencias, setTotalOcorrencias] = useState(0);
  const [novoEmailAcesso, setNovoEmailAcesso] = useState("");
  const [novaPermissaoAcesso, setNovaPermissaoAcesso] = useState<PermissaoAcesso>("editar");
  const [colunasAberto, setColunasAberto] = useState(false);
  const [colunasPos, setColunasPos] = useState<{ x: number; y: number } | null>(null);
  const colunasRef = useRef<HTMLDivElement>(null);
  useFecharAoClicarFora(colunasRef, colunasAberto, () => setColunasAberto(false));
  const [imagemSelecionada, setImagemSelecionada] = useState<{ paginaId: string; el: HTMLImageElement } | null>(null);
  const [menuImagemPos, setMenuImagemPos] = useState<{ x: number; y: number } | null>(null);
  const [menuTextoPos, setMenuTextoPos] = useState<{ x: number; y: number } | null>(null);
  const [toolbarSelecaoPos, setToolbarSelecaoPos] = useState<{ x: number; y: number } | null>(null);
  const [celulaSelecionada, setCelulaSelecionada] = useState<{ paginaId: string; td: HTMLTableCellElement } | null>(null);
  const [recuoAtual, setRecuoAtual] = useState({ primeiraLinhaMm: 0, esquerdoMm: 0, direitoMm: 0 });

  // Contorno de seleção visível na própria imagem (a imagem é um <img> real dentro do HTML, não um
  // componente React controlado — por isso a classe é alternada direto no elemento do DOM).
  useEffect(() => {
    const el = imagemSelecionada?.el;
    if (!el) return;
    el.classList.add("doc-img-selecionada");
    return () => el.classList.remove("doc-img-selecionada");
  }, [imagemSelecionada]);

  /**
   * Toolbar flutuante mini (item 6/Prioridade 4) — aparece logo acima de uma seleção de texto não
   * vazia dentro do documento, com só as ações mais rápidas (B/I/U/Cor/Link). O painel lateral
   * continua com as opções completas; isso aqui é só o atalho "mão no mouse, sem sair da seleção".
   */
  useEffect(() => {
    function aoMudarSelecao() {
      const selecao = window.getSelection();
      if (!selecao || selecao.isCollapsed || selecao.rangeCount === 0) {
        setToolbarSelecaoPos(null);
        return;
      }
      const range = selecao.getRangeAt(0);
      const dentroDaPagina = Object.values(paginaRefs.current).some((el) => el && el.contains(range.commonAncestorContainer));
      if (!dentroDaPagina) {
        setToolbarSelecaoPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setToolbarSelecaoPos(null);
        return;
      }
      setToolbarSelecaoPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
    document.addEventListener("selectionchange", aoMudarSelecao);
    return () => document.removeEventListener("selectionchange", aoMudarSelecao);
  }, []);

  /**
   * Atalhos de teclado pra imagem selecionada — setas movem (só em posição fixa), Delete/Backspace
   * exclui, Esc desmarca, Ctrl/Cmd+D duplica. Fica num listener global de window (não no onKeyDown do
   * contentEditable) porque selecionar uma imagem não necessariamente move o foco do navegador pra
   * dentro dela. Não interfere na digitação normal: só existe enquanto uma imagem está selecionada.
   */
  useEffect(() => {
    const info = imagemSelecionada;
    if (!info) return;
    function aoTeclar(e: KeyboardEvent) {
      if (!info) return;
      const img = info.el;
      const alvo = e.target as HTMLElement | null;
      // Se o foco estiver num campo de texto/painel (ex.: digitando um valor no painel lateral),
      // Delete/Backspace deve apagar o texto do campo, não a imagem.
      const digitandoEmCampo = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable;

      if (e.key === "Escape") {
        e.preventDefault();
        setImagemSelecionada(null);
        setMenuImagemPos(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !digitandoEmCampo) {
        e.preventDefault();
        excluirImagemSelecionada();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D") && !digitandoEmCampo) {
        e.preventDefault();
        duplicarImagemSelecionada();
        return;
      }
      if (estaBloqueada(img) || img.style.position !== "absolute") return;
      const setas: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const delta = setas[e.key];
      if (!delta) return;
      e.preventDefault();
      const passo = e.shiftKey ? 10 : 1;
      const esquerdaAtual = parseFloat(img.style.left || "0") || 0;
      const topoAtual = parseFloat(img.style.top || "0") || 0;
      img.style.left = `${Math.max(0, esquerdaAtual + delta[0] * passo)}px`;
      img.style.top = `${Math.max(0, topoAtual + delta[1] * passo)}px`;
      salvarConteudoPagina(info.paginaId);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [imagemSelecionada]);

  const [exportarPdfAberto, setExportarPdfAberto] = useState(false);
  const [exportarPdfPos, setExportarPdfPos] = useState<{ x: number; y: number } | null>(null);
  const exportarPdfRef = useRef<HTMLDivElement>(null);
  useFecharAoClicarFora(exportarPdfRef, exportarPdfAberto, () => setExportarPdfAberto(false));
  const [escopoExportar, setEscopoExportar] = useState<"todas" | "atual" | "especificas">("todas");
  const [paginasEspecificasTexto, setPaginasEspecificasTexto] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [localizarPos, setLocalizarPos] = useState<{ x: number; y: number } | null>(null);
  const [contagemPos, setContagemPos] = useState<{ x: number; y: number } | null>(null);
  const [detalhesPos, setDetalhesPos] = useState<{ x: number; y: number } | null>(null);
  const [ajudaPos, setAjudaPos] = useState<{ x: number; y: number } | null>(null);
  const ajudaRef = useRef<HTMLDivElement>(null);
  useFecharAoClicarFora(ajudaRef, ajudaAberta, () => setAjudaAberta(false));
  const [configPaginaPos, setConfigPaginaPos] = useState<{ x: number; y: number } | null>(null);
  const [compartilharPos, setCompartilharPos] = useState<{ x: number; y: number } | null>(null);
  const [historicoPos, setHistoricoPos] = useState<{ x: number; y: number } | null>(null);

  const localizarRef = useRef<HTMLDivElement>(null);
  const contagemRef = useRef<HTMLDivElement>(null);
  const detalhesRef = useRef<HTMLDivElement>(null);
  const configPaginaRef = useRef<HTMLDivElement>(null);
  const compartilharRef = useRef<HTMLDivElement>(null);
  const historicoRef = useRef<HTMLDivElement>(null);

  useFecharAoClicarFora(localizarRef, localizarAberto, () => setLocalizarAberto(false));
  useFecharAoClicarFora(contagemRef, contagemAberta, () => setContagemAberta(false));
  useFecharAoClicarFora(detalhesRef, detalhesAberto, () => setDetalhesAberto(false));
  useFecharAoClicarFora(configPaginaRef, configPaginaAberto, () => setConfigPaginaAberto(false));
  useFecharAoClicarFora(compartilharRef, compartilharAberto, () => setCompartilharAberto(false));
  useFecharAoClicarFora(historicoRef, historicoAberto, () => setHistoricoAberto(false));

  const paginaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const folhaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const salvarDigitacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formatoPintadoRef = useRef<{ bold: boolean; italic: boolean; underline: boolean } | null>(null);
  const reconhecimentoRef = useRef<ReconhecimentoDeVoz | null>(null);
  /**
   * Guarda, por página, o último HTML que este componente escreveu no DOM.
   * É a peça-chave que corrige o bug do cursor saltando: nunca reaplicamos `innerHTML` numa página
   * cujo conteúdo já está sincronizado (ou seja, cuja última mudança veio da própria digitação nela) —
   * só escrevemos de novo quando o conteúdo mudou por uma fonte externa (trocar de documento, mover
   * bloco por causa da paginação, desfazer/refazer, restaurar versão, colar, etc). Antes disso, toda
   * vez que o autosave rodava, o React reaplicava o `dangerouslySetInnerHTML` da própria página que o
   * usuário estava digitando, e o navegador jogava o cursor de volta pro início do elemento.
   */
  const ultimoConteudoRef = useRef<Record<string, string>>({});
  const historicoEdicaoRef = useRef<Record<string, { pilha: string[]; indice: number }>>({});
  /** Posição de cursor a restaurar depois que um bloco inteiro precisou ser movido pra próxima página (ver reflowPagina). */
  const cursorPendenteRef = useRef<{ paginaId: string; caminho: number[]; startOffset: number } | null>(null);

  function noNoCaminho(raiz: Node, caminho: number[]): Node | null {
    let atual: Node | null = raiz;
    for (const indice of caminho) {
      atual = atual?.childNodes[indice] ?? null;
      if (!atual) return null;
    }
    return atual;
  }

  /**
   * Restaura o cursor num nó específico da página, achado pelo `caminho` gravado antes do bloco ser
   * movido (ver `reflowPagina`). Usada tanto pelo caminho síncrono (`moverTransbordoParaProximaPagina`,
   * quando a página de destino já existe no DOM) quanto pelo efeito abaixo (fallback para quando a
   * página de destino ainda nem foi montada nesse render, ex.: acabou de ser criada).
   */
  function restaurarCursorNaPagina(
    el: HTMLDivElement,
    paginaId: string,
    pendente: { caminho: number[]; startOffset: number }
  ) {
    const primeiroFilho = el.firstElementChild;
    const no = primeiroFilho ? noNoCaminho(primeiroFilho, pendente.caminho) : null;
    if (!no) return;
    try {
      const tamanho = no.nodeType === Node.TEXT_NODE ? (no.textContent?.length ?? 0) : no.childNodes.length;
      const offset = Math.min(pendente.startOffset, tamanho);
      const range = document.createRange();
      range.setStart(no, offset);
      range.collapse(true);
      const selecao = window.getSelection();
      selecao?.removeAllRanges();
      selecao?.addRange(range);
      el.focus();
      setPaginaAtivaId(paginaId);
    } catch {
      // Se por algum motivo a posição exata não puder ser restaurada, ao menos foca a página certa.
      el.focus();
      setPaginaAtivaId(paginaId);
    }
  }

  useEffect(() => {
    for (const pagina of paginasLocais) {
      const el = paginaRefs.current[pagina.id];
      if (!el) continue;
      if (ultimoConteudoRef.current[pagina.id] === pagina.conteudoHtml) continue;
      if (el.innerHTML !== pagina.conteudoHtml) el.innerHTML = pagina.conteudoHtml;
      ultimoConteudoRef.current[pagina.id] = pagina.conteudoHtml;

      const pendente = cursorPendenteRef.current;
      if (pendente && pendente.paginaId === pagina.id) {
        cursorPendenteRef.current = null;
        restaurarCursorNaPagina(el, pagina.id, pendente);
      }
    }
  });

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

  // Ctrl+P precisa funcionar mesmo com o foco fora do texto (num botão da barra, num painel flutuante
  // etc.) — por isso fica num listener global de window, e não só no onKeyDown do contentEditable.
  useEffect(() => {
    function aoTeclarPrint(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        abrirPreviaImpressao();
      }
    }
    window.addEventListener("keydown", aoTeclarPrint);
    return () => window.removeEventListener("keydown", aoTeclarPrint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O caminho normal de impressão (botão 🖨/Ctrl+P) abre uma janela própria já com o tamanho de papel
  // certo (abrirPreviaImpressaoLimpa). Mas se a impressão nativa do navegador for disparada por fora
  // disso (menu Arquivo > Imprimir, botão de imprimir da barra do navegador — o app não consegue
  // interceptar isso via JavaScript), o fallback em CSS (".doc-print-area" em globals.css) precisa saber
  // o tamanho real da página em tempo real, porque puro CSS não lê o estado do documento.
  useEffect(() => {
    if (!doc) return;
    const dimensaoAtual =
      doc.config.tamanho === "Personalizado" ? { w: 210, h: 297 } : TAMANHOS_PAPEL_MM[doc.config.tamanho];
    const larguraAtual = doc.config.orientacao === "paisagem" ? dimensaoAtual.h : dimensaoAtual.w;
    const alturaAtual = doc.config.orientacao === "paisagem" ? dimensaoAtual.w : dimensaoAtual.h;
    let estilo = document.getElementById("doc-print-page-size") as HTMLStyleElement | null;
    if (!estilo) {
      estilo = document.createElement("style");
      estilo.id = "doc-print-page-size";
      document.head.appendChild(estilo);
    }
    estilo.textContent = `@media print { @page { size: ${larguraAtual}mm ${alturaAtual}mm; margin: 0; } }`;
    return () => {
      estilo?.remove();
    };
  }, [doc, doc?.config.tamanho, doc?.config.orientacao]);

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
        setAjudaAberta(false);
        setColunasAberto(false);
        setExportarPdfAberto(false);
        setImagemSelecionada(null);
        setCelulaSelecionada(null);
      }
    }
    window.addEventListener("keydown", aoTeclarEsc);
    return () => window.removeEventListener("keydown", aoTeclarEsc);
  }, []);

  // Mantém os marcadores de recuo da régua sempre mostrando os valores do parágrafo onde o cursor está.
  useEffect(() => {
    function aoMudarSelecao() {
      const p = paragrafoDoCursor();
      if (p) setRecuoAtual(lerRecuo(p));
    }
    document.addEventListener("selectionchange", aoMudarSelecao);
    return () => document.removeEventListener("selectionchange", aoMudarSelecao);
  }, []);

  // Contagem de ocorrências (popup Localizar e substituir) precisa ler o DOM de cada página via
  // ref — não é seguro fazer isso durante o render, então recalculamos aqui, num efeito, e guardamos
  // o resultado em estado normal.
  useEffect(() => {
    if (!localizarAberto) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o DOM via ref (coletarOcorrencias) pra contar resultados; não dá pra fazer isso durante o render
    setTotalOcorrencias(contarOcorrencias());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localizarAberto, buscaTexto, diferenciarCase, paginasLocais]);

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
  const qtdColunas = doc.config.colunas ?? 1;
  // Margens independentes — cada lado cai de volta pra margemMm (documentos salvos antes dessa mudança).
  const margemSuperiorMm = doc.config.margemSuperiorMm ?? doc.config.margemMm;
  const margemInferiorMm = doc.config.margemInferiorMm ?? doc.config.margemMm;
  const margemEsquerdaMm = doc.config.margemEsquerdaMm ?? doc.config.margemMm;
  const margemDireitaMm = doc.config.margemDireitaMm ?? doc.config.margemMm;

  function salvarConteudoPagina(paginaId: string) {
    const el = paginaRefs.current[paginaId];
    if (!el) return;
    const html = el.innerHTML;
    // O DOM já está exatamente nesse estado (acabamos de lê-lo dele) — marca como sincronizado ANTES de
    // salvar, senão o efeito de sincronização (useEffect logo abaixo) vê o novo conteudoHtml como uma
    // mudança "externa" e reescreve innerHTML de novo, o que recria todos os nós filhos do zero. Isso
    // invalidava referências de elemento ao vivo (ex.: a <img> selecionada no painel de edição de imagem,
    // ou qualquer nó guardado em estado) mesmo quando o HTML resultante era idêntico ao que já estava lá.
    ultimoConteudoRef.current[paginaId] = html;
    setPaginasLocais((prev) => prev.map((p) => (p.id === paginaId ? { ...p, conteudoHtml: html } : p)));
    registrarHistorico(paginaId, html);
  }

  /**
   * Histórico de desfazer/refazer próprio — não depende do document.execCommand("undo") nativo do
   * navegador, que só rastreia comandos disparados por execCommand (digitação, negrito, etc). Ações que
   * mexem no DOM diretamente via JavaScript — redimensionar/mover/cortar imagem, editar linha/coluna de
   * tabela, mudar colunas do documento — não entram nessa pilha nativa, e desfazer depois delas removia a
   * imagem/tabela inteira (o undo nativo desfazia a ÚLTIMA operação DA PILHA DELE, que era a inserção).
   * Como salvarConteudoPagina já é o ponto único por onde toda edição passa, registrar um snapshot de
   * HTML aqui cobre todo tipo de edição de forma uniforme.
   */
  function registrarHistorico(paginaId: string, html: string) {
    const atual = historicoEdicaoRef.current[paginaId];
    if (!atual) {
      historicoEdicaoRef.current[paginaId] = { pilha: [html], indice: 0 };
      return;
    }
    if (atual.pilha[atual.indice] === html) return; // nada mudou de verdade
    const novaPilha = atual.pilha.slice(0, atual.indice + 1);
    novaPilha.push(html);
    if (novaPilha.length > 100) novaPilha.shift(); // limita o tamanho — não é ilimitado
    historicoEdicaoRef.current[paginaId] = { pilha: novaPilha, indice: novaPilha.length - 1 };
  }

  function aplicarSnapshotHistorico(paginaId: string, html: string) {
    const el = paginaRefs.current[paginaId];
    if (el) {
      el.innerHTML = html;
      ultimoConteudoRef.current[paginaId] = html;
    }
    setPaginasLocais((prev) => prev.map((p) => (p.id === paginaId ? { ...p, conteudoHtml: html } : p)));
    setImagemSelecionada(null);
    setCelulaSelecionada(null);
  }

  function desfazer() {
    const h = historicoEdicaoRef.current[paginaAtivaId];
    if (!h || h.indice <= 0) return;
    h.indice -= 1;
    aplicarSnapshotHistorico(paginaAtivaId, h.pilha[h.indice]);
  }

  function refazer() {
    const h = historicoEdicaoRef.current[paginaAtivaId];
    if (!h || h.indice >= h.pilha.length - 1) return;
    h.indice += 1;
    aplicarSnapshotHistorico(paginaAtivaId, h.pilha[h.indice]);
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

  /**
   * Tab de verdade: avança até a próxima tabulação configurada na régua (Formatar → régua horizontal),
   * medindo a posição real do cursor na página. Sem tabulação configurada à frente, cai num espaçamento
   * padrão de 12,5mm (como Word/Docs fazem quando não há marcador definido).
   */
  function inserirTabulacao() {
    if (!doc) return;
    const selecao = window.getSelection();
    const el = paginaRefs.current[paginaAtivaId];
    if (!selecao || selecao.rangeCount === 0 || !el) {
      inserirNaPagina("&emsp;&emsp;");
      return;
    }
    const folha = el.closest(".doc-page-sheet") as HTMLElement | null;
    if (!folha) {
      inserirNaPagina("&emsp;&emsp;");
      return;
    }
    const range = selecao.getRangeAt(0);
    const retangulos = range.getClientRects();
    const cursorRect = retangulos[0] ?? range.getBoundingClientRect();
    const folhaRect = folha.getBoundingClientRect();
    const pxPorMm = folhaRect.width / larguraMm;
    const cursorXmm = (cursorRect.left - folhaRect.left) / pxPorMm;
    const tabulacoes = [...(doc.config.tabulacoesMm ?? [])].sort((a, b) => a - b);
    const proxima = tabulacoes.find((t) => t > cursorXmm + 0.5);
    const alvoMm = proxima ?? (Math.floor(cursorXmm / 12.5) + 1) * 12.5;
    const larguraPx = Math.max(6, Math.round((alvoMm - cursorXmm) * pxPorMm));

    // Inserção via Range direto (não execCommand("insertHTML")) — um <span contenteditable="false">
    // não é um lugar válido pro cursor pousar, e inserir só ele deixava a seleção num estado inválido
    // onde a digitação seguinte era descartada silenciosamente. Insere o span E um nó de texto vazio
    // logo depois, e move o cursor pra dentro desse nó de texto explicitamente.
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.dataset.docTab = "1";
    span.style.display = "inline-block";
    span.style.width = `${larguraPx}px`;
    span.innerHTML = "&nbsp;";
    const noDepois = document.createTextNode("");
    range.deleteContents();
    range.insertNode(span);
    span.after(noDepois);
    const novoRange = document.createRange();
    novoRange.setStart(noDepois, 0);
    novoRange.collapse(true);
    selecao.removeAllRanges();
    selecao.addRange(novoRange);
    salvarConteudoPagina(paginaAtivaId);
  }

  /** Acha o elemento de bloco (parágrafo/título/item de lista/citação) que contém o cursor agora. */
  function paragrafoDoCursor(): HTMLElement | null {
    const selecao = window.getSelection();
    if (!selecao || selecao.rangeCount === 0) return null;
    let no: Node | null = selecao.getRangeAt(0).startContainer;
    if (no.nodeType !== Node.ELEMENT_NODE) no = no.parentNode;
    let el = no as HTMLElement | null;
    const TAGS_BLOCO = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE"]);
    while (el && !el.classList.contains("doc-body-rich")) {
      if (TAGS_BLOCO.has(el.tagName)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function lerRecuo(el: HTMLElement | null) {
    if (!el) return { primeiraLinhaMm: 0, esquerdoMm: 0, direitoMm: 0 };
    return {
      primeiraLinhaMm: parseFloat(el.style.textIndent) || 0,
      esquerdoMm: parseFloat(el.style.marginLeft) || 0,
      direitoMm: parseFloat(el.style.marginRight) || 0,
    };
  }

  /** Recuo de verdade do parágrafo (text-indent/margin-left/margin-right) — nunca mexe na margem da página. */
  function mudarRecuoParagrafo(patch: Partial<{ primeiraLinhaMm: number; esquerdoMm: number; direitoMm: number }>) {
    const p = paragrafoDoCursor();
    if (!p) return;
    if (patch.primeiraLinhaMm !== undefined) p.style.textIndent = `${patch.primeiraLinhaMm}mm`;
    if (patch.esquerdoMm !== undefined) p.style.marginLeft = `${patch.esquerdoMm}mm`;
    if (patch.direitoMm !== undefined) p.style.marginRight = `${patch.direitoMm}mm`;
    setRecuoAtual(lerRecuo(p));
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
   * O conteúdo digitado só chega em `paginasLocais` depois do debounce do autosave (600ms) — ler
   * o estado direto na impressão/exportação corre o risco de perder a digitação mais recente se o
   * usuário imprimir/exportar rápido demais depois de digitar. Isso lê o HTML atual direto do DOM de
   * cada página (sem esperar o debounce), garantindo que impressão e exportação sempre reflitam
   * exatamente o que está na tela.
   */
  /** Substitui os tokens de número de página no cabeçalho/rodapé pelo valor real de cada página. */
  function substituirTokensPagina(html: string, numeroPagina: number, totalPaginas: number) {
    return html.replaceAll("{{PAGINA}}", String(numeroPagina)).replaceAll("{{TOTAL}}", String(totalPaginas));
  }

  function paginasComConteudoAtual(): PaginaDoc[] {
    return paginasLocais.map((p) => {
      const el = paginaRefs.current[p.id];
      return el ? { ...p, conteudoHtml: el.innerHTML } : p;
    });
  }

  /** Igual paginasComConteudoAtual(), mas com o cabeçalho/rodapé (se existir) embutido no HTML de cada
   * página — usado por toda exportação/impressão, pra nenhuma delas "esquecer" o cabeçalho/rodapé. */
  function paginasParaExportar(): PaginaDoc[] {
    if (!doc) return [];
    const paginas = paginasComConteudoAtual();
    const total = paginas.length;
    return paginas.map((p, i) => {
      const cabecalho = doc.config.cabecalhoHtml
        ? `<div class="doc-cabecalho-repetido">${substituirTokensPagina(doc.config.cabecalhoHtml, i + 1, total)}</div>`
        : "";
      const rodape = doc.config.rodapeHtml
        ? `<div class="doc-rodape-repetido">${substituirTokensPagina(doc.config.rodapeHtml, i + 1, total)}</div>`
        : "";
      return { ...p, conteudoHtml: cabecalho + p.conteudoHtml + rodape };
    });
  }

  /** Visualização de impressão própria — só o conteúdo do documento (+ cabeçalho/rodapé se o usuário criou), sem menu/barra/régua/botões. */
  function abrirPreviaImpressao() {
    if (!doc) return;
    const paginas = paginasComConteudoAtual();
    const total = paginas.length;
    const paginasHtml = paginas.map((p, i) => {
      const cabecalho = doc.config.cabecalhoHtml
        ? `<div class="doc-cabecalho-repetido">${substituirTokensPagina(doc.config.cabecalhoHtml, i + 1, total)}</div>`
        : "";
      const rodape = doc.config.rodapeHtml
        ? `<div class="doc-rodape-repetido">${substituirTokensPagina(doc.config.rodapeHtml, i + 1, total)}</div>`
        : "";
      // O corpo vai numa div própria (.doc-corpo-impresso) — é só ela que recebe a CSS de colunas,
      // cabeçalho/rodapé continuam em largura cheia igual aparecem no editor.
      return `${cabecalho}<div class="doc-corpo-impresso">${p.conteudoHtml}</div>${rodape}`;
    });
    abrirPreviaImpressaoLimpa(doc.titulo, paginasHtml, {
      larguraMm,
      alturaMm,
      margemSuperiorMm,
      margemInferiorMm,
      margemEsquerdaMm,
      margemDireitaMm,
      corFundo: doc.config.corFundo,
      qtdColunas,
      colunasEspacoMm: doc.config.colunasEspacoMm,
      colunasLinha: doc.config.colunasLinha,
    });
  }

  async function confirmarExportarPdf() {
    if (!doc) return;
    const total = paginasLocais.length;
    let indices: number[];
    if (escopoExportar === "todas") {
      indices = paginasLocais.map((_, i) => i);
    } else if (escopoExportar === "atual") {
      const i = paginasLocais.findIndex((p) => p.id === paginaAtivaId);
      indices = [i >= 0 ? i : 0];
    } else {
      const analisado = analisarSelecaoPaginas(paginasEspecificasTexto, total);
      if (!analisado) {
        window.alert(`Seleção de páginas inválida. Use algo como "1, 3, 5" ou "2-7" (o documento tem ${total} página(s)).`);
        return;
      }
      indices = analisado;
    }
    const elementos = indices
      .map((i) => folhaRefs.current[paginasLocais[i].id])
      .filter((el): el is HTMLDivElement => !!el);
    if (elementos.length === 0) return;
    setGerandoPdf(true);
    try {
      await baixarPdfReal(doc.titulo, elementos, larguraMm, alturaMm);
      setExportarPdfAberto(false);
    } finally {
      setGerandoPdf(false);
    }
  }

  /** Quebra de página de verdade: divide o conteúdo da página no ponto exato do cursor. */
  function inserirQuebraDePaginaNoCursor() {
    const el = paginaRefs.current[paginaAtivaId];
    const selecao = window.getSelection();
    if (!el || !selecao || selecao.rangeCount === 0 || !el.contains(selecao.getRangeAt(0).startContainer)) {
      novaPaginaAposAtiva();
      return;
    }
    const range = selecao.getRangeAt(0);
    const rangeDepois = range.cloneRange();
    rangeDepois.selectNodeContents(el);
    rangeDepois.setStart(range.endContainer, range.endOffset);
    const fragmentoDepois = rangeDepois.extractContents();
    const divTemp = document.createElement("div");
    divTemp.appendChild(fragmentoDepois);
    const htmlDepois = divTemp.innerHTML;
    const htmlAntes = el.innerHTML;
    const indice = paginasLocais.findIndex((p) => p.id === paginaAtivaId);
    let novoId = "";
    setPaginasLocais((prev) => {
      novoId = `pagina-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const copia = [...prev];
      copia[indice] = { ...copia[indice], conteudoHtml: htmlAntes };
      copia.splice(indice + 1, 0, { id: novoId, conteudoHtml: htmlDepois });
      return copia;
    });
    setTimeout(() => setPaginaAtivaId(novoId), 0);
  }

  /** Cola da área de transferência de verdade — tenta manter HTML formatado, cai pra texto puro quando não dá. */
  async function colarConteudo(semFormatacao: boolean) {
    try {
      if (!semFormatacao && navigator.clipboard && "read" in navigator.clipboard) {
        const itens = await navigator.clipboard.read();
        for (const item of itens) {
          if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            inserirNaPagina(await blob.text());
            return;
          }
        }
      }
      const texto = await navigator.clipboard.readText();
      aplicarFormatacao("insertText", texto);
    } catch {
      window.alert(
        "Não consegui ler a área de transferência — o navegador pode estar bloqueando o acesso. Use Ctrl+V diretamente sobre o documento, que funciona pelo comportamento nativo do navegador.",
      );
    }
  }

  /** Seleciona todo o conteúdo só da página ativa (nunca a interface, menus ou réguas). */
  function selecionarTudoNaPagina() {
    const el = paginaRefs.current[paginaAtivaId];
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selecao = window.getSelection();
    selecao?.removeAllRanges();
    selecao?.addRange(range);
  }

  /**
   * Atalhos que o contentEditable não trata nativamente (Ctrl+B/I/U/Z/Y/X/C/V/A já funcionam sozinhos,
   * de graça, pelo próprio navegador — só interceptamos aqui o que realmente precisa de tratamento nosso).
   */
  function aoTeclarNaPagina(e: React.KeyboardEvent<HTMLDivElement>) {
    const mod = e.ctrlKey || e.metaKey;
    // Desfazer/refazer usam o histórico próprio (ver registrarHistorico), não o nativo do navegador —
    // ele não sabe nada sobre redimensionar/mover imagem ou editar tabela (manipulação direta do DOM,
    // fora do execCommand), e desfazer usando só a pilha nativa acabava removendo a imagem/tabela inteira.
    if (mod && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      desfazer();
      return;
    }
    if ((mod && e.shiftKey && (e.key === "z" || e.key === "Z")) || (mod && (e.key === "y" || e.key === "Y"))) {
      e.preventDefault();
      refazer();
      return;
    }
    if (mod && e.key === "Enter") {
      e.preventDefault();
      inserirQuebraDePaginaNoCursor();
      return;
    }
    // Ctrl+P é tratado por um listener global (ver useEffect logo abaixo da definição de
    // abrirPreviaImpressao) — assim funciona mesmo com o foco fora do texto, não só aqui dentro.
    if (mod && e.shiftKey && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      colarConteudo(true);
      return;
    }
    if (mod && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      inserirLink();
      return;
    }
    if (mod && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      setLocalizarAberto(true);
      return;
    }
    if (mod && (e.key === "h" || e.key === "H")) {
      e.preventDefault();
      setLocalizarAberto(true);
      return;
    }
    if (mod && e.altKey && (e.key === "m" || e.key === "M")) {
      e.preventDefault();
      abrirComentarioNaSelecao();
      return;
    }
    if (mod && e.shiftKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      setContagemAberta(true);
      return;
    }
    if (mod && e.key === "\\") {
      e.preventDefault();
      aplicarFormatacao("removeFormat");
      return;
    }
    if (e.key === "Tab" && !mod) {
      const selecao = window.getSelection();
      const dentroDeLista =
        selecao && selecao.rangeCount > 0 && (selecao.getRangeAt(0).startContainer as Node).parentElement?.closest("li, td, th");
      if (dentroDeLista) return; // deixa o navegador indentar o item de lista / pular de célula nativamente
      e.preventDefault();
      inserirTabulacao();
      return;
    }
    // Enter normal e Shift+Enter: deixamos o navegador tratar nativamente (cria parágrafo / quebra de
    // linha) — isso já é seguro agora que a página não reescreve seu próprio innerHTML a cada tecla
    // (ver ultimoConteudoRef acima). O onInput cuida de reavaliar a auto-paginação em seguida.
  }

  /**
   * Auto-paginação real: se o conteúdo estourar a altura da folha, o último bloco vira o começo da próxima página.
   * O salvamento do texto digitado é adiado (debounce) — chamar setPaginasLocais a cada tecla reaplicaria o
   * dangerouslySetInnerHTML da própria div a cada letra, resetando o cursor para o início (o texto saía invertido).
   *
   * A reflow roda a cada tecla (como antes), mas agora nunca remove o nó do DOM que contém o cursor: se o
   * cursor estiver dentro do último bloco, dividimos exatamente na posição do cursor (só o que vem DEPOIS
   * dele vai para a próxima página) em vez de arrancar o bloco inteiro — isso era a causa do cursor "saltar"
   * de posição ao digitar perto do fim da página (o nó focado era removido do documento no meio da digitação).
   */
  function aoDigitarNaPagina(paginaId: string) {
    if (salvarDigitacaoRef.current) clearTimeout(salvarDigitacaoRef.current);
    // 250ms (não 600ms): salvarConteudoPagina também é quem registra o checkpoint no histórico de
    // desfazer/refazer (ver registrarHistorico) — um debounce longo demais deixava "digitar e desfazer
    // logo em seguida" sem checkpoint nenhum pra voltar (Ctrl+Z virava um no-op enquanto o debounce não
    // disparava). 250ms ainda evita registrar um checkpoint por tecla durante digitação contínua.
    salvarDigitacaoRef.current = setTimeout(() => salvarConteudoPagina(paginaId), 250);
    reflowPagina(paginaId);
  }

  /** Caminho de índices de nó-filho da raiz até o alvo — serve pra "re-achar" o mesmo ponto depois que o HTML é reconstruído. */
  function caminhoAteNo(raiz: Node, alvo: Node): number[] | null {
    const caminho: number[] = [];
    let atual: Node | null = alvo;
    while (atual && atual !== raiz) {
      const pai: Node | null = atual.parentNode;
      if (!pai) return null;
      const indice = Array.prototype.indexOf.call(pai.childNodes, atual);
      if (indice < 0) return null;
      caminho.unshift(indice);
      atual = pai;
    }
    return atual === raiz ? caminho : null;
  }

  function moverTransbordoParaProximaPagina(
    paginaId: string,
    htmlAtual: string,
    htmlTransbordo: string,
    cursorInfo?: { caminho: number[]; startOffset: number }
  ): string {
    let idProximaPagina = "";
    setPaginasLocais((prev) => {
      const indice = prev.findIndex((p) => p.id === paginaId);
      if (indice === -1) return prev;
      const atual = { ...prev[indice], conteudoHtml: htmlAtual };
      const proxima = prev[indice + 1];
      const copia = [...prev];
      copia[indice] = atual;
      let htmlProximaFinal: string;
      let paginaProximaJaExistia = false;
      if (proxima) {
        idProximaPagina = proxima.id;
        paginaProximaJaExistia = true;
        htmlProximaFinal = htmlTransbordo + proxima.conteudoHtml;
        copia[indice + 1] = { ...proxima, conteudoHtml: htmlProximaFinal };
      } else {
        idProximaPagina = `pagina-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        htmlProximaFinal = htmlTransbordo;
        copia.splice(indice + 1, 0, { id: idProximaPagina, conteudoHtml: htmlProximaFinal });
      }

      // Marca a página de origem como já sincronizada (o DOM dela já reflete `htmlAtual`, foi o próprio
      // reflowPagina que a mutou) — evita que o efeito de sincronização a reescreva à toa.
      ultimoConteudoRef.current[paginaId] = htmlAtual;

      // Se a página de destino já existe e já está montada no DOM, escreve o transbordo nela e restaura
      // o cursor AGORA, de forma síncrona, em vez de esperar o próximo ciclo de render do React. Esse é o
      // ponto-chave que fecha a corrida de digitação rápida: antes, entre o momento em que o bloco com o
      // cursor era removido da página de origem e o momento em que o efeito assíncrono escrevia o HTML na
      // página de destino e restaurava a seleção ali, o cursor nativo do navegador ficava "no limbo" (o nó
      // que ele apontava já tinha sido removido do documento) — teclas digitadas nesse intervalo caíam em
      // posição imprevisível, embaralhando o conteúdo entre páginas. Escrevendo e restaurando tudo aqui,
      // antes de devolver o controle ao event loop, não sobra intervalo nenhum pra outra tecla se intrometer.
      const elProxima = paginaRefs.current[idProximaPagina];
      if (paginaProximaJaExistia && elProxima) {
        elProxima.innerHTML = htmlProximaFinal;
        ultimoConteudoRef.current[idProximaPagina] = htmlProximaFinal;
        if (cursorInfo) restaurarCursorNaPagina(elProxima, idProximaPagina, cursorInfo);
      } else if (cursorInfo) {
        // Página nova, ainda não montada nesse render: cai no caminho assíncrono existente (efeito acima).
        cursorPendenteRef.current = { paginaId: idProximaPagina, ...cursorInfo };
      }

      // Cascateia: se o que acabou de entrar na próxima página também estourar ela (ex.: colar um texto
      // grande de uma vez), reavalia essa página depois que o DOM sincronizar, empurrando o excedente adiante.
      const idParaCascata = idProximaPagina;
      setTimeout(() => reflowPagina(idParaCascata), 50);
      return copia;
    });
    return idProximaPagina;
  }

  /**
   * Move para a próxima página tudo que estoura a altura da folha, em uma única passada (loop), pra dar
   * conta de digitação rápida ou colar um bloco grande de uma vez — não só uma linha por chamada.
   *
   * Blocos que não contêm o cursor podem ser movidos inteiros sem risco. Quando o loop chega no bloco que
   * contém o cursor: se houver conteúdo de verdade depois da posição do cursor dentro dele, só essa parte
   * vai pra próxima página (o texto antes do cursor, e o próprio cursor, nunca são tocados). Se não houver
   * nada depois do cursor mas a página ainda estourar, o bloco inteiro precisa ir mesmo assim — isso é o
   * comportamento esperado ("digitar perto do fim da página continua corretamente na página seguinte") —
   * mas nesse caso guardamos o caminho exato até o nó do cursor em `cursorPendenteRef` pra restaurar o foco
   * na posição certa assim que o bloco reaparecer no topo da próxima página. É essa restauração explícita
   * que evita o bug relatado: sem ela, a seleção nativa do navegador colapsa pra um lugar imprevisível
   * assim que o nó com foco é removido do documento, fazendo o cursor "saltar" de posição.
   */
  function reflowPagina(paginaId: string) {
    const el = paginaRefs.current[paginaId];
    if (!el) return;

    let htmlTransbordo = "";
    let mudou = false;
    let cursorMovidoInfo: { caminho: number[]; startOffset: number } | null = null;
    let iteracoes = 0;
    while (el.scrollHeight > el.clientHeight + 4 && iteracoes < 500) {
      iteracoes += 1;
      const ultimo = el.lastElementChild;
      if (!ultimo || el.children.length <= 1) break;

      const selecao = window.getSelection();
      const range = selecao && selecao.rangeCount > 0 ? selecao.getRangeAt(0) : null;
      const cursorDentroDoUltimo = !!range && ultimo.contains(range.startContainer);

      if (!cursorDentroDoUltimo) {
        // Cursor não está nesse bloco: seguro mover o bloco inteiro pra próxima página e continuar o loop.
        htmlTransbordo = ultimo.outerHTML + htmlTransbordo;
        ultimo.remove();
        mudou = true;
        continue;
      }

      // Cursor está dentro do último bloco: primeiro tenta dividir exatamente na posição dele.
      const rangeDepois = range!.cloneRange();
      rangeDepois.selectNodeContents(ultimo);
      rangeDepois.setStart(range!.endContainer, range!.endOffset);
      // Só espia o que tem depois do cursor (cloneContents não remove nada) — um <br> residual de fim de
      // linha não conta como conteúdo real; se for só isso, não vale a pena separar por aqui.
      const previa = document.createElement("div");
      previa.appendChild(rangeDepois.cloneContents());
      const temConteudoReal = (previa.textContent ?? "").trim().length > 0 || !!previa.querySelector("img, table, hr");
      if (temConteudoReal) {
        const fragmentoDepois = rangeDepois.extractContents();
        const divTemp = document.createElement("div");
        divTemp.appendChild(fragmentoDepois);
        htmlTransbordo = divTemp.innerHTML + htmlTransbordo;
        mudou = true;
        break;
      }

      // Nada relevante depois do cursor: se ainda assim a página estoura, o bloco inteiro (com o cursor)
      // precisa ir pra próxima página. Guarda o caminho até o nó do cursor pra restaurar a posição depois.
      const caminho = caminhoAteNo(ultimo, range!.startContainer);
      if (!caminho) break; // não deu pra localizar o nó com segurança: não arrisca mover
      cursorMovidoInfo = { caminho, startOffset: range!.startOffset };
      htmlTransbordo = ultimo.outerHTML + htmlTransbordo;
      ultimo.remove();
      mudou = true;
      break;
    }

    if (!mudou) return;
    moverTransbordoParaProximaPagina(paginaId, el.innerHTML, htmlTransbordo, cursorMovidoInfo ?? undefined);
  }

  function escaparRegex(texto: string) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Busca de verdade sobre o DOM ao vivo de cada página (não usa o window.find() do navegador, que é uma
   * API não padronizada/legada e nem existe em todo navegador). Cada ocorrência aponta pro nó de texto e
   * offsets exatos onde foi encontrada — a mesma lista alimenta contagem, destaque/navegação e substituição,
   * então os três nunca divergem entre si (o bug antigo: a contagem usava o texto puro da página, mas a
   * substituição rodava regex sobre o HTML bruto, podendo contar e substituir universos de texto diferentes).
   * Limitação conhecida: só encontra ocorrências inteiramente dentro de um único nó de texto — um termo que
   * atravesse duas formatações diferentes (ex.: metade em negrito, metade não) não é encontrado.
   */
  function coletarOcorrencias(): { paginaId: string; node: Text; start: number; end: number }[] {
    const termo = buscaTexto.trim();
    if (!termo) return [];
    const regex = new RegExp(escaparRegex(termo), diferenciarCase ? "g" : "gi");
    const resultado: { paginaId: string; node: Text; start: number; end: number }[] = [];
    for (const pagina of paginasLocais) {
      const el = paginaRefs.current[pagina.id];
      if (!el) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let no = walker.nextNode();
      while (no) {
        const texto = no.textContent ?? "";
        regex.lastIndex = 0;
        let m = regex.exec(texto);
        while (m) {
          resultado.push({ paginaId: pagina.id, node: no as Text, start: m.index, end: m.index + m[0].length });
          if (m[0].length === 0) regex.lastIndex += 1;
          m = regex.exec(texto);
        }
        no = walker.nextNode();
      }
    }
    return resultado;
  }

  function contarOcorrencias() {
    return coletarOcorrencias().length;
  }

  function irParaOcorrencia(indiceDesejado: number, ocorrenciasJaColetadas?: ReturnType<typeof coletarOcorrencias>) {
    const ocorrencias = ocorrenciasJaColetadas ?? coletarOcorrencias();
    if (ocorrencias.length === 0) return;
    const indice = ((indiceDesejado % ocorrencias.length) + ocorrencias.length) % ocorrencias.length;
    const oc = ocorrencias[indice];
    const range = document.createRange();
    range.setStart(oc.node, oc.start);
    range.setEnd(oc.node, oc.end);
    const selecao = window.getSelection();
    selecao?.removeAllRanges();
    selecao?.addRange(range);
    (oc.node.parentElement as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setPaginaAtivaId(oc.paginaId);
    setBuscaIndiceAtual(indice);
  }

  function localizarProximo() {
    if (!buscaTexto.trim()) return;
    const ocorrencias = coletarOcorrencias();
    if (ocorrencias.length === 0) {
      window.alert(`Nenhuma ocorrência de "${buscaTexto}" encontrada.`);
      return;
    }
    irParaOcorrencia(buscaIndiceAtual + 1, ocorrencias);
  }

  function localizarAnterior() {
    if (!buscaTexto.trim()) return;
    const ocorrencias = coletarOcorrencias();
    if (ocorrencias.length === 0) {
      window.alert(`Nenhuma ocorrência de "${buscaTexto}" encontrada.`);
      return;
    }
    irParaOcorrencia(buscaIndiceAtual - 1, ocorrencias);
  }

  function substituirAtual() {
    if (!buscaTexto.trim()) return;
    const ocorrencias = coletarOcorrencias();
    if (ocorrencias.length === 0) {
      window.alert(`Nenhuma ocorrência de "${buscaTexto}" encontrada.`);
      return;
    }
    const indice = ((buscaIndiceAtual % ocorrencias.length) + ocorrencias.length) % ocorrencias.length;
    const oc = ocorrencias[indice];
    const texto = oc.node.textContent ?? "";
    oc.node.textContent = texto.slice(0, oc.start) + substituirTexto + texto.slice(oc.end);
    salvarConteudoPagina(oc.paginaId);
    irParaOcorrencia(indice);
  }

  function substituirTodos() {
    if (!buscaTexto.trim()) return;
    const ocorrencias = coletarOcorrencias();
    if (ocorrencias.length === 0) {
      window.alert(`Nenhuma ocorrência de "${buscaTexto}" encontrada.`);
      return;
    }
    const porNo = new Map<Text, typeof ocorrencias>();
    for (const oc of ocorrencias) {
      const lista = porNo.get(oc.node) ?? [];
      lista.push(oc);
      porNo.set(oc.node, lista);
    }
    const paginasAfetadas = new Set<string>();
    for (const [no, lista] of porNo) {
      let texto = no.textContent ?? "";
      // De trás pra frente dentro do mesmo nó, senão os offsets das ocorrências anteriores ficam inválidos.
      for (const oc of [...lista].sort((a, b) => b.start - a.start)) {
        texto = texto.slice(0, oc.start) + substituirTexto + texto.slice(oc.end);
      }
      no.textContent = texto;
      paginasAfetadas.add(lista[0].paginaId);
    }
    paginasAfetadas.forEach((paginaId) => salvarConteudoPagina(paginaId));
    setBuscaIndiceAtual(0);
    window.alert(`${ocorrencias.length} ocorrência(s) substituída(s).`);
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
        const src = String(leitor.result);
        inserirNaPagina(`<img src="${src}" data-doc-img="1" data-doc-img-id="${proximoIdImagem()}" data-original-src="${src}" style="max-width:100%;" />`);
      };
      leitor.readAsDataURL(arquivo);
    };
    input.click();
  }

  /** Clique numa imagem dentro da página seleciona ela e abre o painel de edição real. */
  function aoClicarNaPagina(e: React.MouseEvent<HTMLDivElement>, paginaId: string) {
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "IMG") {
      garantirIdImagem(alvo as HTMLImageElement);
      setImagemSelecionada({ paginaId, el: alvo as HTMLImageElement });
      setMenuImagemPos(null);
    } else {
      setImagemSelecionada(null);
    }
    const celula = alvo.closest("td, th") as HTMLTableCellElement | null;
    if (celula) {
      setCelulaSelecionada({ paginaId, td: celula });
    } else {
      setCelulaSelecionada(null);
    }
  }

  /** Botão direito numa imagem: seleciona (se ainda não estava) e abre o menu de contexto no ponto do clique. */
  function aoClicarComBotaoDireitoNaPagina(e: React.MouseEvent<HTMLDivElement>, paginaId: string) {
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "IMG") {
      e.preventDefault();
      garantirIdImagem(alvo as HTMLImageElement);
      setImagemSelecionada({ paginaId, el: alvo as HTMLImageElement });
      setMenuTextoPos(null);
      setMenuImagemPos({ x: e.clientX, y: e.clientY });
      return;
    }
    if (alvo.closest("td, th")) {
      // Célula de tabela já tem painel dedicado (docked) — não sobrepõe com o menu de texto genérico.
      setMenuImagemPos(null);
      setMenuTextoPos(null);
      return;
    }
    e.preventDefault();
    setImagemSelecionada(null);
    setMenuImagemPos(null);
    setMenuTextoPos({ x: e.clientX, y: e.clientY });
  }

  /** Elemento de bloco (parágrafo/título/item de lista/etc) mais próximo do cursor atual — usado por
   * "Duplicar bloco"/"Excluir bloco" no menu de botão direito do texto. */
  function blocoDeTextoAtual(): HTMLElement | null {
    const el = paginaRefs.current[paginaAtivaId];
    const selecao = window.getSelection();
    if (!el || !selecao || selecao.rangeCount === 0) return null;
    let no: Node | null = selecao.getRangeAt(0).startContainer;
    while (no && no.parentElement !== el) {
      no = no.parentNode;
    }
    return no instanceof HTMLElement ? no : null;
  }

  function duplicarBlocoDeTexto() {
    const bloco = blocoDeTextoAtual();
    if (!bloco) return;
    const copia = bloco.cloneNode(true) as HTMLElement;
    bloco.after(copia);
    salvarConteudoPagina(paginaAtivaId);
  }

  function excluirBlocoDeTexto() {
    const bloco = blocoDeTextoAtual();
    if (!bloco) return;
    bloco.remove();
    salvarConteudoPagina(paginaAtivaId);
  }

  function atualizarImagemSelecionada(mudar: (img: HTMLImageElement) => void) {
    if (!imagemSelecionada) return;
    mudar(imagemSelecionada.el);
    salvarConteudoPagina(imagemSelecionada.paginaId);
    // Força o painel a re-renderizar com os novos valores lidos do elemento.
    setImagemSelecionada({ ...imagemSelecionada });
  }

  function substituirImagemSelecionada() {
    if (!imagemSelecionada) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      const leitor = new FileReader();
      leitor.onload = () => {
        const src = String(leitor.result);
        atualizarImagemSelecionada((img) => {
          img.src = src;
          img.dataset.originalSrc = src;
        });
      };
      leitor.readAsDataURL(arquivo);
    };
    input.click();
  }

  function excluirImagemSelecionada() {
    if (!imagemSelecionada) return;
    const { paginaId, el } = imagemSelecionada;
    el.remove();
    salvarConteudoPagina(paginaId);
    setImagemSelecionada(null);
  }

  function duplicarImagemSelecionada() {
    if (!imagemSelecionada) return;
    const { paginaId, el } = imagemSelecionada;
    const copia = el.cloneNode(true) as HTMLImageElement;
    copia.dataset.docImgId = proximoIdImagem();
    // Desloca um pouco a cópia pra ficar visível quando a original está em posição fixa (senão fica
    // exatamente por cima, parecendo que nada aconteceu).
    if (copia.style.position === "absolute") {
      copia.style.left = `${(parseFloat(copia.style.left || "0") || 0) + 16}px`;
      copia.style.top = `${(parseFloat(copia.style.top || "0") || 0) + 16}px`;
    }
    el.after(copia);
    salvarConteudoPagina(paginaId);
    setImagemSelecionada({ paginaId, el: copia });
    setMenuImagemPos(null);
  }

  function estaBloqueada(img: HTMLImageElement): boolean {
    return img.dataset.bloqueada === "1";
  }

  function alternarBloqueioImagemSelecionada() {
    atualizarImagemSelecionada((img) => {
      img.dataset.bloqueada = estaBloqueada(img) ? "0" : "1";
    });
  }

  function trazerImagemSelecionadaParaFrente() {
    atualizarImagemSelecionada((img) => {
      img.style.zIndex = "50";
    });
  }

  function enviarImagemSelecionadaParaTras() {
    atualizarImagemSelecionada((img) => {
      img.style.zIndex = "-1";
    });
  }

  function iniciarArrasteRedimensionarImagem(e: React.MouseEvent) {
    e.preventDefault();
    if (!imagemSelecionada || estaBloqueada(imagemSelecionada.el)) return;
    const img = imagemSelecionada.el;
    const larguraInicial = img.getBoundingClientRect().width;
    const xInicial = e.clientX;
    function mover(ev: MouseEvent) {
      const novaLargura = Math.max(30, larguraInicial + (ev.clientX - xInicial));
      img.style.width = `${novaLargura}px`;
      img.style.height = "auto";
    }
    function soltar() {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      atualizarImagemSelecionada(() => undefined);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  /** Arrastar livre — só faz sentido (e só habilitamos) quando a imagem está em "posição fixa". */
  /**
   * Guias de alinhamento (snap) — ao arrastar uma imagem em posição fixa, encaixa nas margens e no
   * centro da página (horizontal e vertical) e mostra uma linha guia enquanto o encaixe está ativo,
   * igual ao comportamento do PowerPoint/Google Slides. As linhas são manipuladas direto no DOM (sem
   * passar por estado do React) pra não haver atraso visual durante o arraste.
   */
  function iniciarArrasteLivreImagem(e: { preventDefault: () => void; clientX: number; clientY: number }) {
    if (!imagemSelecionada) return;
    const img = imagemSelecionada.el;
    if (img.style.position !== "absolute" || estaBloqueada(img)) return;
    e.preventDefault();
    const folha = img.closest(".doc-page-sheet") as HTMLElement | null;
    if (!folha) return;
    const folhaRect = folha.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const dx = e.clientX - imgRect.left;
    const dy = e.clientY - imgRect.top;
    const pxPorMm = folhaRect.width / larguraMm;
    const larguraImgPx = imgRect.width;
    const alturaImgPx = imgRect.height;

    const margemEsqPx = margemEsquerdaMm * pxPorMm;
    const margemDirPx = margemDireitaMm * pxPorMm;
    const margemSupPx = margemSuperiorMm * pxPorMm;
    const margemInfPx = margemInferiorMm * pxPorMm;

    // Cada candidato tem a posição do canto (left/top) da imagem que gera o encaixe, e a posição da
    // linha guia (guia) — que para o encaixe central é o centro real da página, não a borda da imagem.
    const candidatosX = [
      { alvo: 0, guia: 0 },
      { alvo: margemEsqPx, guia: margemEsqPx },
      { alvo: (folhaRect.width - larguraImgPx) / 2, guia: folhaRect.width / 2 },
      { alvo: folhaRect.width - margemDirPx - larguraImgPx, guia: folhaRect.width - margemDirPx },
      { alvo: folhaRect.width - larguraImgPx, guia: folhaRect.width },
    ];
    const candidatosY = [
      { alvo: 0, guia: 0 },
      { alvo: margemSupPx, guia: margemSupPx },
      { alvo: (folhaRect.height - alturaImgPx) / 2, guia: folhaRect.height / 2 },
      { alvo: folhaRect.height - margemInfPx - alturaImgPx, guia: folhaRect.height - margemInfPx },
      { alvo: folhaRect.height - alturaImgPx, guia: folhaRect.height },
    ];
    const LIMIAR_SNAP = 8;

    const linhaV = document.createElement("div");
    linhaV.className = "doc-guia-alinhamento doc-guia-alinhamento-v";
    const linhaH = document.createElement("div");
    linhaH.className = "doc-guia-alinhamento doc-guia-alinhamento-h";
    folha.append(linhaV, linhaH);

    function mover(ev: MouseEvent) {
      let x = ev.clientX - folhaRect.left - dx;
      let y = ev.clientY - folhaRect.top - dy;

      let guiaX: number | null = null;
      for (const c of candidatosX) {
        if (Math.abs(x - c.alvo) < LIMIAR_SNAP) { x = c.alvo; guiaX = c.guia; break; }
      }
      let guiaY: number | null = null;
      for (const c of candidatosY) {
        if (Math.abs(y - c.alvo) < LIMIAR_SNAP) { y = c.alvo; guiaY = c.guia; break; }
      }

      img.style.left = `${Math.max(0, x)}px`;
      img.style.top = `${Math.max(0, y)}px`;

      linhaV.style.display = guiaX !== null ? "block" : "none";
      linhaV.style.left = `${guiaX ?? 0}px`;
      linhaH.style.display = guiaY !== null ? "block" : "none";
      linhaH.style.top = `${guiaY ?? 0}px`;
    }
    function soltar() {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      linhaV.remove();
      linhaH.remove();
      atualizarImagemSelecionada(() => undefined);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  function inserirTabela() {
    const linhas = Number(window.prompt("Quantas linhas?", "3") ?? 0);
    const colunas = Number(window.prompt("Quantas colunas?", "3") ?? 0);
    if (!linhas || !colunas) return;
    const linhaHtml = `<tr>${"<td style=\"border:1px solid #999;padding:4px 8px;\">&nbsp;</td>".repeat(colunas)}</tr>`;
    inserirNaPagina(`<table style="border-collapse:collapse;width:100%;">${linhaHtml.repeat(linhas)}</table>`);
  }

  /** Edição real de tabela — inserir/excluir linha ou coluna a partir da célula selecionada (ver PainelTabela). */
  function comCelulaSelecionada(fn: (td: HTMLTableCellElement, tabela: HTMLTableElement) => void) {
    if (!celulaSelecionada) return;
    const { paginaId, td } = celulaSelecionada;
    const tabela = td.closest("table");
    if (!tabela) return;
    fn(td, tabela);
    salvarConteudoPagina(paginaId);
  }

  function inserirLinhaTabela(onde: "acima" | "abaixo") {
    comCelulaSelecionada((td) => {
      const linha = td.closest("tr");
      if (!linha) return;
      const qtdColunas = linha.children.length;
      const novaLinha = document.createElement("tr");
      for (let i = 0; i < qtdColunas; i++) {
        const novaCelula = document.createElement("td");
        novaCelula.style.border = "1px solid #999";
        novaCelula.style.padding = "4px 8px";
        novaCelula.innerHTML = "&nbsp;";
        novaLinha.appendChild(novaCelula);
      }
      if (onde === "acima") linha.before(novaLinha);
      else linha.after(novaLinha);
    });
  }

  function inserirColunaTabela(onde: "esquerda" | "direita") {
    comCelulaSelecionada((td, tabela) => {
      const linha = td.closest("tr");
      if (!linha) return;
      const indice = Array.from(linha.children).indexOf(td);
      tabela.querySelectorAll("tr").forEach((tr) => {
        const celulaRef = tr.children[indice] as HTMLTableCellElement | undefined;
        const novaCelula = document.createElement(celulaRef?.tagName === "TH" ? "th" : "td");
        novaCelula.style.border = "1px solid #999";
        novaCelula.style.padding = "4px 8px";
        novaCelula.innerHTML = "&nbsp;";
        if (onde === "esquerda") celulaRef?.before(novaCelula);
        else celulaRef?.after(novaCelula);
      });
    });
  }

  function excluirLinhaTabela() {
    comCelulaSelecionada((td, tabela) => {
      const linha = td.closest("tr");
      if (!linha) return;
      const totalLinhas = tabela.querySelectorAll("tr").length;
      linha.remove();
      if (totalLinhas <= 1) tabela.remove(); // não sobrou nenhuma linha: a tabela também vai
    });
    setCelulaSelecionada(null);
  }

  function excluirColunaTabela() {
    comCelulaSelecionada((td, tabela) => {
      const linha = td.closest("tr");
      if (!linha) return;
      const indice = Array.from(linha.children).indexOf(td);
      const totalColunas = linha.children.length;
      tabela.querySelectorAll("tr").forEach((tr) => tr.children[indice]?.remove());
      if (totalColunas <= 1) tabela.remove(); // não sobrou nenhuma coluna: a tabela também vai
    });
    setCelulaSelecionada(null);
  }

  function excluirTabelaInteira() {
    comCelulaSelecionada((_td, tabela) => tabela.remove());
    setCelulaSelecionada(null);
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

  function extrairEstrutura() {
    const itens: { texto: string; nivel: number; paginaId: string }[] = [];
    const div = document.createElement("div");
    for (const p of paginasLocais) {
      div.innerHTML = p.conteudoHtml;
      div.querySelectorAll("h1, h2, h3, h4").forEach((h) => {
        const nivel = Number(h.tagName.replace("H", ""));
        itens.push({ texto: h.textContent ?? "", nivel, paginaId: p.id });
      });
    }
    return itens;
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

  /**
   * Modo sugestão de verdade — não é só um aviso decorativo. Entrar no modo tira uma foto do conteúdo
   * de cada página; "Aceitar todas" mantém o que foi editado (só sai do modo); "Rejeitar todas" restaura
   * o conteúdo exatamente como estava antes de entrar no modo, em todas as páginas.
   */
  function entrarModoSugestao() {
    const snapshot: Record<string, string> = {};
    for (const p of paginasComConteudoAtual()) snapshot[p.id] = p.conteudoHtml;
    setSugestaoSnapshot(snapshot);
    setModo("sugestao");
  }

  function aceitarSugestoes() {
    setSugestaoSnapshot(null);
    setModo("edicao");
  }

  function rejeitarSugestoes() {
    if (!sugestaoSnapshot) {
      setModo("edicao");
      return;
    }
    for (const [paginaId, html] of Object.entries(sugestaoSnapshot)) {
      aplicarSnapshotHistorico(paginaId, html);
    }
    setSugestaoSnapshot(null);
    setModo("edicao");
  }

  function estatisticasSugestao(): { adicionados: number; removidos: number } | null {
    if (!sugestaoSnapshot) return null;
    let adicionados = 0;
    let removidos = 0;
    for (const p of paginasLocais) {
      const original = sugestaoSnapshot[p.id] ?? "";
      const div = document.createElement("div");
      div.innerHTML = original;
      const textoOriginal = div.textContent ?? "";
      div.innerHTML = p.conteudoHtml;
      const textoAtual = div.textContent ?? "";
      const diferenca = textoAtual.length - textoOriginal.length;
      if (diferenca > 0) adicionados += diferenca;
      else removidos += -diferenca;
    }
    return { adicionados, removidos };
  }

  const contagem = contarPalavrasTexto(paginasLocais);
  const estrutura = extrairEstrutura();
  const statsSugestao = estatisticasSugestao();

  const menuArquivo: ("sep" | ItemMenu)[] = [
    { label: "Novo documento", onClick: () => window.dispatchEvent(new CustomEvent("doc-novo")) },
    { label: "Fazer uma cópia", onClick: () => duplicarDocumento(id) },
    {
      label: "Salvar como modelo",
      onClick: () => {
        setNomeNovoModelo(doc.titulo);
        setDescricaoNovoModelo("");
        setSalvarModeloAberto(true);
      },
    },
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
    { label: "Visualizar impressão / Imprimir", atalho: "Ctrl+P", onClick: abrirPreviaImpressao },
    "sep",
    {
      label: "Mover para a lixeira",
      onClick: () => {
        excluirDocumento(id);
        onFechar();
      },
    },
    "sep",
    { label: "Baixar como PDF", onClick: () => setExportarPdfAberto(true) },
    { label: "Baixar como Word (.docx)", onClick: () => baixarDocx(doc.titulo, paginasParaExportar()) },
    { label: "Baixar como texto simples (.txt)", onClick: () => baixarTxt(doc.titulo, paginasParaExportar()) },
    { label: "Baixar como RTF", onClick: () => baixarRtf(doc.titulo, paginasParaExportar()) },
    { label: "Baixar como HTML", onClick: () => baixarHtml(doc.titulo, paginasParaExportar()) },
  ];

  const historicoAtivo = historicoEdicaoRef.current[paginaAtivaId];
  const podeDesfazer = !!historicoAtivo && historicoAtivo.indice > 0;
  const podeRefazer = !!historicoAtivo && historicoAtivo.indice < historicoAtivo.pilha.length - 1;

  const menuEditar: ("sep" | ItemMenu)[] = [
    { label: "Desfazer", atalho: "Ctrl+Z", onClick: desfazer, disabled: !podeDesfazer },
    { label: "Refazer", atalho: "Ctrl+Y", onClick: refazer, disabled: !podeRefazer },
    "sep",
    { label: "Recortar", atalho: "Ctrl+X", onClick: () => aplicarFormatacao("cut") },
    { label: "Copiar", atalho: "Ctrl+C", onClick: () => aplicarFormatacao("copy") },
    { label: "Colar", atalho: "Ctrl+V", onClick: () => colarConteudo(false) },
    { label: "Colar sem formatação", atalho: "Ctrl+Shift+V", onClick: () => colarConteudo(true) },
    "sep",
    { label: "Selecionar tudo", atalho: "Ctrl+A", onClick: selecionarTudoNaPagina },
    { label: "Excluir", onClick: () => aplicarFormatacao("delete") },
    "sep",
    { label: "Localizar", atalho: "Ctrl+F", onClick: () => setLocalizarAberto(true) },
    { label: "Localizar e substituir", atalho: "Ctrl+H", onClick: () => setLocalizarAberto(true) },
  ];

  const menuVer: ("sep" | ItemMenu)[] = [
    { label: mostrarRegua ? "Ocultar régua" : "Mostrar régua", onClick: () => setMostrarRegua((v) => !v) },
    { label: estruturaAberta ? "Ocultar estrutura do documento" : "Mostrar estrutura do documento", onClick: () => setEstruturaAberta((v) => !v) },
    {
      label: mostrarNaoImprimiveis ? "Ocultar caracteres não imprimíveis" : "Mostrar caracteres não imprimíveis",
      onClick: () => setMostrarNaoImprimiveis((v) => !v),
    },
    { label: semPaginas ? "Ativar visualização paginada" : "Visualização sem páginas (modo contínuo)", onClick: () => setSemPaginas((v) => !v) },
    { label: mostrarToolbar ? "Ocultar barra de ferramentas" : "Mostrar barra de ferramentas", onClick: () => setMostrarToolbar((v) => !v) },
    "sep",
    {
      label: telaCheia ? "Sair da tela cheia" : "Tela cheia",
      onClick: () => {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
        else document.documentElement.requestFullscreen?.().catch(() => undefined);
      },
    },
    { label: "Visualização de impressão", onClick: () => abrirPreviaImpressao() },
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
    { label: "Cabeçalho", onClick: () => setCabecalhoRodapeAberto("cabecalho") },
    { label: "Rodapé", onClick: () => setCabecalhoRodapeAberto("rodape") },
    { label: "Número de página", onClick: () => setCabecalhoRodapeAberto("rodape") },
    { label: "Quebra de página", atalho: "Ctrl+Enter", onClick: inserirQuebraDePaginaNoCursor },
    { label: "Quebra de coluna", disabled: qtdColunas <= 1, onClick: () => inserirNaPagina('<span style="break-after:column;display:inline-block;width:0;"></span>') },
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
    { label: "Colunas: uma coluna", onClick: () => atualizarConfigPagina(id, { colunas: 1 }), disabled: qtdColunas === 1 },
    { label: "Colunas: duas colunas", onClick: () => atualizarConfigPagina(id, { colunas: 2 }), disabled: qtdColunas === 2 },
    { label: "Colunas: três colunas", onClick: () => atualizarConfigPagina(id, { colunas: 3 }), disabled: qtdColunas === 3 },
    { label: "Colunas: mais opções…", onClick: () => setColunasAberto(true) },
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
    { label: "Atalhos de teclado", onClick: () => setAjudaAberta(true) },
    { label: "Central de ajuda do CRM AZUZ", onClick: () => setAjudaAberta(true) },
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
          <button type="button" className="doc-toolbar-btn" title="Desfazer" disabled={!podeDesfazer} onMouseDown={(e) => e.preventDefault()} onClick={desfazer}>↶</button>
          <button type="button" className="doc-toolbar-btn" title="Refazer" disabled={!podeRefazer} onMouseDown={(e) => e.preventDefault()} onClick={refazer}>↷</button>
          <button type="button" className="doc-toolbar-btn" title="Zoom: diminuir" onClick={() => setZoom((z) => Math.max(50, z - 10))}>−</button>
          <span className="hint" style={{ minWidth: 34, textAlign: "center" }}>{zoom}%</span>
          <button type="button" className="doc-toolbar-btn" title="Zoom: aumentar" onClick={() => setZoom((z) => Math.min(200, z + 10))}>+</button>
          <button type="button" className="doc-toolbar-btn" title="Imprimir" onClick={abrirPreviaImpressao}>🖨</button>
          <span className="doc-header-sep" />
          <button
            type="button"
            className={`btn ghost${mostrarToolbar ? " active" : ""}`}
            title={mostrarToolbar ? "Ocultar ferramentas de formatação" : "Mostrar ferramentas de formatação"}
            onClick={() => setMostrarToolbar((v) => !v)}
          >
            🎨 Formatação
          </button>
          <button
            type="button"
            className={`btn ghost${painelLateralAberto ? " active" : ""}`}
            title={painelLateralAberto ? "Recolher painel lateral" : "Abrir painel lateral"}
            onClick={() => setPainelLateralAberto((v) => !v)}
          >
            🎛 Painel
          </button>
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

      <div className="doc-toolbar doc-toolbar-rich" style={{ display: mostrarToolbar ? undefined : "none" }}>
        <select className="doc-toolbar-select" defaultValue={ESTILOS_PARAGRAFO[0].valor} aria-label="Estilo do parágrafo" onChange={(e) => aplicarFormatacao("formatBlock", e.target.value)}>
          {ESTILOS_PARAGRAFO.map((e) => (
            <option key={e.valor} value={e.valor}>{e.label}</option>
          ))}
        </select>
        <SeletorFonte
          fontes={FONTES_DOCUMENTO}
          valorAtual={fonteAtual}
          onEscolher={(valor) => {
            setFonteAtual(valor);
            aplicarFormatacao("fontName", valor);
          }}
        />
        <select className="doc-toolbar-select" defaultValue={TAMANHOS_FONTE_DOC[1].valor} aria-label="Tamanho da fonte" onChange={(e) => aplicarFormatacao("fontSize", e.target.value)}>
          {TAMANHOS_FONTE_DOC.map((t) => (
            <option key={t.label} value={t.valor}>{t.label}</option>
          ))}
        </select>
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" style={{ fontWeight: 700 }} title="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("bold")}>N</button>
        <button type="button" className="doc-toolbar-btn" style={{ fontStyle: "italic" }} title="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("italic")}>I</button>
        <button type="button" className="doc-toolbar-btn" style={{ textDecoration: "underline" }} title="Sublinhado" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("underline")}>S</button>
        <SeletorCor titulo="Cor do texto" cores={CORES_TEXTO} onEscolher={(c) => aplicarFormatacao("foreColor", c)} rotulo="A" />
        <span className="doc-toolbar-sep" />
        <button type="button" className="doc-toolbar-btn" title="Alinhar à esquerda" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyLeft")}>≡◧</button>
        <button type="button" className="doc-toolbar-btn" title="Inserir imagem" onClick={inserirImagem}>🖼</button>
        <span className="doc-toolbar-sep" />

        <GrupoToolbar rotulo="+ Inserir" largura={260}>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <p className="doc-menu-categoria">Conteúdo</p>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => inserirNaPagina("<div>Novo texto</div>")}>
              <span className="n">📝 Texto</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => inserirNaPagina('<div style="border:1px solid #999;padding:8px;display:inline-block;">Caixa de texto</div>')}>
              <span className="n">▭ Caixa de texto</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => aplicarFormatacao("formatBlock", "H1")}>
              <span className="n">H Título</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => aplicarFormatacao("insertUnorderedList")}>
              <span className="n">• Lista</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => inserirNaPagina("<div>☐ </div>")}>
              <span className="n">☑ Checklist</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => aplicarFormatacao("formatBlock", "BLOCKQUOTE")}>
              <span className="n">❝ Citação</span>
            </button>

            <p className="doc-menu-categoria">Mídia</p>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={inserirImagem}>
              <span className="n">🖼 Imagem</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => inserirNaPagina('<span style="border:1px solid #999;border-radius:6px;padding:4px 8px;display:inline-block;">📎 arquivo.pdf</span>')}>
              <span className="n">📎 Arquivo</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={inserirSimbolo}>
              <span className="n">☺ Ícone</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => aplicarFormatacao("insertHorizontalRule")}>
              <span className="n">— Linha</span>
            </button>

            <p className="doc-menu-categoria">Estrutura</p>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={inserirTabela}>
              <span className="n">▦ Tabela</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => setColunasAberto(true)}>
              <span className="n">▥ Colunas</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => aplicarFormatacao("insertHorizontalRule")}>
              <span className="n">┄ Divisor</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={inserirQuebraDePaginaNoCursor}>
              <span className="n">⤓ Quebra de página</span>
            </button>

            <p className="doc-menu-categoria">Documentos</p>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => setCabecalhoRodapeAberto("cabecalho")}>
              <span className="n">⬒ Cabeçalho</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => setCabecalhoRodapeAberto("rodape")}>
              <span className="n">⬓ Rodapé</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => inserirNaPagina('<div style="margin-top:40px;border-top:1px solid #333;width:240px;padding-top:4px;">Assinatura</div>')}>
              <span className="n">✍ Assinatura</span>
            </button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left" }} onClick={() => inserirNaPagina('<span style="border:1px dashed #999;padding:2px 10px;display:inline-block;color:#888;">[assinar aqui]</span>')}>
              <span className="n">▢ Campo de assinatura</span>
            </button>

            <p className="doc-menu-categoria">CRM <span className="hint">(placeholder visual, sem dado real)</span></p>
            {[
              ["Nome do cliente", "nome_cliente"],
              ["Empresa", "empresa"],
              ["CPF/CNPJ", "cpf_cnpj"],
              ["Telefone", "telefone"],
              ["E-mail", "email"],
              ["Responsável", "responsavel"],
              ["Valor", "valor"],
              ["Data", "data"],
            ].map(([label, token]) => (
              <button
                key={token}
                type="button"
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => inserirNaPagina(`{{${token}}}`)}
              >
                <span className="n">{"{ }"} {label}</span>
              </button>
            ))}
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => {
                const nome = window.prompt("Nome do campo personalizado:");
                if (nome) inserirNaPagina(`{{${nome.trim().toLowerCase().replace(/\s+/g, "_")}}}`);
              }}
            >
              <span className="n">{"{ }"} Campo personalizado</span>
            </button>
          </div>
        </GrupoToolbar>

        <GrupoToolbar rotulo="Parágrafo" largura={250}>
          <div className="field">
            <label>Alinhamento</label>
            <div className="filters-row" style={{ margin: 0 }}>
              <button type="button" className="doc-toolbar-btn" title="Centralizar" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyCenter")}>≡</button>
              <button type="button" className="doc-toolbar-btn" title="Alinhar à direita" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyRight")}>◨≡</button>
              <button type="button" className="doc-toolbar-btn" title="Justificar" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyFull")}>☰</button>
            </div>
          </div>
          <div className="field">
            <label>Espaçamento entre linhas</label>
            <select className="input" style={{ width: "100%" }} defaultValue="1.5" onChange={(e) => {
              const el = paginaRefs.current[paginaAtivaId];
              if (el) el.style.lineHeight = e.target.value;
              salvarConteudoPagina(paginaAtivaId);
            }}>
              <option value="1">Simples</option>
              <option value="1.15">1,15</option>
              <option value="1.5">1,5</option>
              <option value="2">Duplo</option>
            </select>
          </div>
          <div className="field">
            <label>Listas</label>
            <div className="filters-row" style={{ margin: 0 }}>
              <button type="button" className="doc-toolbar-btn" title="Lista com marcadores" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("insertUnorderedList")}>• ≡</button>
              <button type="button" className="doc-toolbar-btn" title="Lista numerada" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("insertOrderedList")}>1.≡</button>
              <button type="button" className="doc-toolbar-btn" title="Checklist" onClick={() => inserirNaPagina('<div>☐ </div>')}>☑</button>
            </div>
          </div>
          <div className="field">
            <label>Recuo e formatação</label>
            <div className="filters-row" style={{ margin: 0 }}>
              <button type="button" className="doc-toolbar-btn" title="Diminuir recuo" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("outdent")}>⇤</button>
              <button type="button" className="doc-toolbar-btn" title="Aumentar recuo" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("indent")}>⇥</button>
              <button type="button" className="doc-toolbar-btn" title="Tachado" style={{ textDecoration: "line-through" }} onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("strikeThrough")}>T</button>
              <button type="button" className="doc-toolbar-btn" title="Limpar formatação" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("removeFormat")}>✕A</button>
            </div>
          </div>
          <div className="field">
            <label>Cor de destaque</label>
            <SeletorCor titulo="Cor de destaque" cores={CORES_DESTAQUE} onEscolher={(c) => aplicarFormatacao("hiliteColor", c)} rotulo="🖊 Destacar" />
          </div>
        </GrupoToolbar>

        <GrupoToolbar rotulo="Mais opções" largura={200}>
          <button
            type="button"
            className={`dropdown-item${corretorAtivo ? " active" : ""}`}
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => setCorretorAtivo((v) => !v)}
          >
            <span className="n">ABC Corretor ortográfico{corretorAtivo ? " ✓" : ""}</span>
          </button>
          <button
            type="button"
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={copiarFormatacao}
            onDoubleClick={colarFormatacao}
            title="Clique pra copiar a formatação, clique duas vezes num trecho selecionado pra colar"
          >
            <span className="n">🖌 Copiar formatação</span>
          </button>
        </GrupoToolbar>

        <span className="doc-toolbar-sep" />
        <div className="doc-modo-switch">
          {(["edicao", "sugestao", "visualizacao"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`fchip${modo === m ? " active" : ""}`}
              onClick={() => (m === "sugestao" ? entrarModoSugestao() : setModo(m))}
            >
              {m === "edicao" ? "Edição" : m === "sugestao" ? "Sugestão" : "Visualização"}
            </button>
          ))}
        </div>
      </div>

      {modo === "sugestao" ? (
        <div className="doc-aviso-modo">
          <span>
            ✏️ Modo sugestão ativo —{" "}
            {statsSugestao && (statsSugestao.adicionados > 0 || statsSugestao.removidos > 0)
              ? `${statsSugestao.adicionados} caractere(s) adicionado(s), ${statsSugestao.removidos} removido(s) desde que o modo foi ativado.`
              : "edite normalmente; as mudanças feitas a partir de agora podem ser aceitas ou rejeitadas em bloco."}
          </span>
          <button type="button" className="btn ghost" style={{ marginLeft: 12 }} onClick={rejeitarSugestoes}>
            Rejeitar todas
          </button>
          <button type="button" className="btn primary" onClick={aceitarSugestoes}>
            Aceitar todas
          </button>
        </div>
      ) : null}

      <div className="doc-canvas" style={{ zoom: `${zoom}%` } as React.CSSProperties}>
        {estruturaAberta ? (
          <aside className="doc-estrutura-painel">
            <div className="panel-h">
              <h4>Estrutura do documento</h4>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setEstruturaAberta(false)}>✕</button>
            </div>
            {estrutura.length === 0 ? (
              <p className="hint" style={{ padding: 17 }}>Use Título 1, Título 2 ou Título 3 no texto pra ver a estrutura aqui.</p>
            ) : (
              estrutura.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className="doc-estrutura-item"
                  style={{ paddingLeft: 12 + (item.nivel - 1) * 14 }}
                  onClick={() => setPaginaAtivaId(item.paginaId)}
                >
                  {item.texto || "(sem título)"}
                </button>
              ))
            )}
          </aside>
        ) : null}
        <div className="doc-paginas-coluna">
          {paginasLocais.map((pagina, indice) => (
            <div className="doc-page-wrap" key={pagina.id}>
              {mostrarRegua ? (
                <ReguaDocumento
                  larguraMm={larguraMm}
                  margemEsquerdaMm={margemEsquerdaMm}
                  margemDireitaMm={margemDireitaMm}
                  onMudarEsquerda={(mm) => atualizarConfigPagina(id, { margemEsquerdaMm: mm })}
                  onMudarDireita={(mm) => atualizarConfigPagina(id, { margemDireitaMm: mm })}
                  tabulacoesMm={doc.config.tabulacoesMm ?? []}
                  onMudarTabulacoes={(novas) => atualizarConfigPagina(id, { tabulacoesMm: novas })}
                  recuo={recuoAtual}
                  onMudarRecuo={mudarRecuoParagrafo}
                />
              ) : null}
              <div className="doc-page-linha">
                {mostrarRegua ? (
                  <ReguaVerticalDocumento
                    alturaMm={alturaMm}
                    margemSuperiorMm={margemSuperiorMm}
                    margemInferiorMm={margemInferiorMm}
                    onMudarSuperior={(mm) => atualizarConfigPagina(id, { margemSuperiorMm: mm })}
                    onMudarInferior={(mm) => atualizarConfigPagina(id, { margemInferiorMm: mm })}
                  />
                ) : null}
                <div
                  ref={(el) => {
                    folhaRefs.current[pagina.id] = el;
                  }}
                  className={`doc-page-sheet doc-print-area${semPaginas ? " doc-page-sheet-semborda" : ""}`}
                  style={{
                    width: `${larguraMm}mm`,
                    minHeight: semPaginas ? undefined : `${alturaMm}mm`,
                    padding: `${margemSuperiorMm}mm ${margemDireitaMm}mm ${margemInferiorMm}mm ${margemEsquerdaMm}mm`,
                    background: doc.config.corFundo,
                  }}
                >
                {doc.config.cabecalhoHtml ? (
                  <div
                    className="doc-cabecalho-repetido"
                    dangerouslySetInnerHTML={{
                      __html: substituirTokensPagina(doc.config.cabecalhoHtml, indice + 1, paginasLocais.length),
                    }}
                  />
                ) : null}
                <div
                  key={pagina.id}
                  ref={(el) => {
                    paginaRefs.current[pagina.id] = el;
                    if (el && ultimoConteudoRef.current[pagina.id] === undefined) {
                      el.innerHTML = pagina.conteudoHtml;
                      ultimoConteudoRef.current[pagina.id] = pagina.conteudoHtml;
                      // Snapshot inicial no histórico — sem isso, desfazer a primeiríssima edição não
                      // teria pra onde voltar (o histórico só nasceria depois de já ter uma mudança).
                      historicoEdicaoRef.current[pagina.id] = { pilha: [pagina.conteudoHtml], indice: 0 };
                    }
                  }}
                  className={`doc-body-rich${mostrarNaoImprimiveis ? " doc-body-rich-marcas" : ""}${qtdColunas > 1 ? " doc-body-rich-colunas" : ""}`}
                  style={{
                    maxHeight: semPaginas ? undefined : `${alturaMm - margemSuperiorMm - margemInferiorMm}mm`,
                    overflow: semPaginas ? "visible" : "hidden",
                    columnCount: qtdColunas > 1 ? qtdColunas : undefined,
                    columnGap: qtdColunas > 1 ? `${doc.config.colunasEspacoMm ?? 10}mm` : undefined,
                    columnRuleWidth: qtdColunas > 1 && doc.config.colunasLinha ? "1px" : undefined,
                    columnRuleStyle: qtdColunas > 1 && doc.config.colunasLinha ? "solid" : undefined,
                    columnRuleColor: qtdColunas > 1 && doc.config.colunasLinha ? "currentColor" : undefined,
                  }}
                  contentEditable={modo !== "visualizacao"}
                  suppressContentEditableWarning
                  spellCheck={corretorAtivo}
                  lang={idioma}
                  onFocus={() => focarPagina(pagina.id)}
                  onInput={() => aoDigitarNaPagina(pagina.id)}
                  onBlur={() => {
                    salvarConteudoPagina(pagina.id);
                    // Cursor saiu do bloco: se ainda sobrar transbordo que a divisão no meio da digitação
                    // não pôde mover (nada depois do cursor naquele instante), reavalia agora sem risco.
                    reflowPagina(pagina.id);
                  }}
                  onKeyDown={aoTeclarNaPagina}
                  onClick={(e) => aoClicarNaPagina(e, pagina.id)}
                  onContextMenu={(e) => aoClicarComBotaoDireitoNaPagina(e, pagina.id)}
                  onMouseDown={(e) => {
                    if (imagemSelecionada && e.target === imagemSelecionada.el && imagemSelecionada.el.style.position === "absolute" && !estaBloqueada(imagemSelecionada.el)) {
                      iniciarArrasteLivreImagem(e);
                    }
                  }}
                />
                {doc.config.rodapeHtml ? (
                  <div
                    className="doc-rodape-repetido"
                    dangerouslySetInnerHTML={{
                      __html: substituirTokensPagina(doc.config.rodapeHtml, indice + 1, paginasLocais.length),
                    }}
                  />
                ) : null}
                </div>
                {/* Indicador só de UI (fora de .doc-page-sheet/.doc-print-area de propósito): a impressão e o
                    PDF não podem mostrar nenhum número de página que o usuário não tenha inserido explicitamente
                    (ver Inserir → Número de página, que usa o token {{PAGINA}} dentro do rodapé de verdade). */}
                <div className="doc-page-numero-ui" aria-hidden="true">Página {indice + 1} de {paginasLocais.length}</div>
              </div>
              <div className="doc-page-fim">
                <button type="button" className="doc-page-fim-btn" onClick={novaPaginaAposAtiva}>+ Adicionar página</button>
                <button type="button" className="doc-page-fim-btn doc-page-fim-apagar" disabled={paginasLocais.length <= 1} onClick={excluirPaginaAtiva}>🗑 Apagar essa página</button>
              </div>
            </div>
          ))}
        </div>

        {imagemSelecionada ? (
          <PainelImagem
            key={imagemSelecionada.el.dataset.docImgId}
            imagem={imagemSelecionada.el}
            onFechar={() => setImagemSelecionada(null)}
            onMudar={atualizarImagemSelecionada}
            onSubstituir={substituirImagemSelecionada}
            onExcluir={excluirImagemSelecionada}
            onDuplicar={duplicarImagemSelecionada}
            onIniciarRedimensionar={iniciarArrasteRedimensionarImagem}
          />
        ) : celulaSelecionada ? (
          <aside className="doc-lateral-painel">
            <div className="panel-h">
              <h4>Tabela</h4>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setCelulaSelecionada(null)}>✕</button>
            </div>
            <div className="field">
              <label>Linha</label>
              <div className="filters-row" style={{ margin: 0, flexWrap: "wrap" }}>
                <button type="button" className="fchip" onClick={() => inserirLinhaTabela("acima")}>+ Acima</button>
                <button type="button" className="fchip" onClick={() => inserirLinhaTabela("abaixo")}>+ Abaixo</button>
                <button type="button" className="fchip" style={{ color: "var(--danger)" }} onClick={excluirLinhaTabela}>Excluir linha</button>
              </div>
            </div>
            <div className="field">
              <label>Coluna</label>
              <div className="filters-row" style={{ margin: 0, flexWrap: "wrap" }}>
                <button type="button" className="fchip" onClick={() => inserirColunaTabela("esquerda")}>+ Esquerda</button>
                <button type="button" className="fchip" onClick={() => inserirColunaTabela("direita")}>+ Direita</button>
                <button type="button" className="fchip" style={{ color: "var(--danger)" }} onClick={excluirColunaTabela}>Excluir coluna</button>
              </div>
            </div>
            <button type="button" className="btn danger block" onClick={excluirTabelaInteira}>
              Excluir tabela inteira
            </button>
          </aside>
        ) : comentariosAberto ? (
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
        ) : painelLateralAberto ? (
          <aside className="doc-lateral-painel">
            <div className="panel-h">
              <h4>Painel</h4>
              <button type="button" className="modal-close-btn" aria-label="Recolher painel" onClick={() => setPainelLateralAberto(false)}>✕</button>
            </div>
            <div className="doc-painel-tabs">
              <button type="button" className={`doc-painel-tab${abaPainelPadrao === "texto" ? " on" : ""}`} onClick={() => setAbaPainelPadrao("texto")}>Texto</button>
              <button type="button" className={`doc-painel-tab${abaPainelPadrao === "pagina" ? " on" : ""}`} onClick={() => setAbaPainelPadrao("pagina")}>Página</button>
            </div>

            {abaPainelPadrao === "texto" ? (
              <>
                <div className="field">
                  <label>Estilo do parágrafo</label>
                  <select className="input" defaultValue={ESTILOS_PARAGRAFO[0].valor} onChange={(e) => aplicarFormatacao("formatBlock", e.target.value)}>
                    {ESTILOS_PARAGRAFO.map((e) => (
                      <option key={e.valor} value={e.valor}>{e.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Fonte</label>
                  <SeletorFonte fontes={FONTES_DOCUMENTO} valorAtual={fonteAtual} onEscolher={(valor) => { setFonteAtual(valor); aplicarFormatacao("fontName", valor); }} />
                </div>
                <div className="field">
                  <label>Tamanho</label>
                  <select className="input" defaultValue={TAMANHOS_FONTE_DOC[1].valor} onChange={(e) => aplicarFormatacao("fontSize", e.target.value)}>
                    {TAMANHOS_FONTE_DOC.map((t) => (
                      <option key={t.label} value={t.valor}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Estilo</label>
                  <div className="filters-row" style={{ margin: 0 }}>
                    <button type="button" className="fchip" style={{ fontWeight: 700 }} onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("bold")}>N</button>
                    <button type="button" className="fchip" style={{ fontStyle: "italic" }} onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("italic")}>I</button>
                    <button type="button" className="fchip" style={{ textDecoration: "underline" }} onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("underline")}>S</button>
                    <button type="button" className="fchip" style={{ textDecoration: "line-through" }} onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("strikeThrough")}>T</button>
                  </div>
                </div>
                <div className="field">
                  <label>Cor</label>
                  <div className="filters-row" style={{ margin: 0 }}>
                    <SeletorCor titulo="Cor do texto" cores={CORES_TEXTO} onEscolher={(c) => aplicarFormatacao("foreColor", c)} rotulo="A Texto" />
                    <SeletorCor titulo="Cor de destaque" cores={CORES_DESTAQUE} onEscolher={(c) => aplicarFormatacao("hiliteColor", c)} rotulo="🖊 Destaque" />
                  </div>
                </div>
                <div className="field">
                  <label>Maiúsculas / minúsculas</label>
                  <div className="filters-row" style={{ margin: 0 }}>
                    <button type="button" className="fchip" onClick={() => document.execCommand("insertText", false, (window.getSelection()?.toString() ?? "").toUpperCase())}>MAIÚSCULAS</button>
                    <button type="button" className="fchip" onClick={() => document.execCommand("insertText", false, (window.getSelection()?.toString() ?? "").toLowerCase())}>minúsculas</button>
                  </div>
                </div>
                <div className="field">
                  <label>Espaçamento entre linhas</label>
                  <select className="input" defaultValue="1.5" onChange={(e) => {
                    const el = paginaRefs.current[paginaAtivaId];
                    if (el) el.style.lineHeight = e.target.value;
                    salvarConteudoPagina(paginaAtivaId);
                  }}>
                    <option value="1">Simples</option>
                    <option value="1.15">1,15</option>
                    <option value="1.5">1,5</option>
                    <option value="2">Duplo</option>
                  </select>
                </div>
                <div className="field">
                  <label>Alinhamento</label>
                  <div className="filters-row" style={{ margin: 0 }}>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyLeft")}>≡◧</button>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyCenter")}>≡</button>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyRight")}>◨≡</button>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("justifyFull")}>☰</button>
                  </div>
                </div>
                <div className="field">
                  <label>Recuo</label>
                  <div className="filters-row" style={{ margin: 0 }}>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("outdent")}>⇤ Diminuir</button>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("indent")}>⇥ Aumentar</button>
                  </div>
                </div>
                <div className="field">
                  <label>Listas</label>
                  <div className="filters-row" style={{ margin: 0 }}>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("insertUnorderedList")}>• Marcadores</button>
                    <button type="button" className="fchip" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("insertOrderedList")}>1. Numerada</button>
                    <button type="button" className="fchip" onClick={() => inserirNaPagina('<div>☐ </div>')}>☑ Checklist</button>
                  </div>
                </div>
                <div className="field">
                  <button type="button" className="btn ghost block" onClick={inserirLink}>🔗 Inserir link</button>
                </div>
                <div className="field">
                  <button type="button" className="btn ghost block" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatacao("removeFormat")}>✕A Limpar formatação</button>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Tamanho do papel</label>
                  <select className="input" value={doc.config.tamanho} onChange={(e) => atualizarConfigPagina(id, { tamanho: e.target.value as TamanhoPapel })}>
                    <option value="A4">A4</option>
                    <option value="Carta">Carta</option>
                    <option value="Ofício">Ofício</option>
                    <option value="Personalizado">Personalizado</option>
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
                  <label>Margem superior (mm)</label>
                  <input type="number" className="input" style={{ width: "100%" }} value={doc.config.margemSuperiorMm} onChange={(e) => atualizarConfigPagina(id, { margemSuperiorMm: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label>Margem inferior (mm)</label>
                  <input type="number" className="input" style={{ width: "100%" }} value={doc.config.margemInferiorMm} onChange={(e) => atualizarConfigPagina(id, { margemInferiorMm: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label>Margem esquerda (mm)</label>
                  <input type="number" className="input" style={{ width: "100%" }} value={doc.config.margemEsquerdaMm} onChange={(e) => atualizarConfigPagina(id, { margemEsquerdaMm: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label>Margem direita (mm)</label>
                  <input type="number" className="input" style={{ width: "100%" }} value={doc.config.margemDireitaMm} onChange={(e) => atualizarConfigPagina(id, { margemDireitaMm: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label>Cor de fundo</label>
                  <input type="color" className="input" style={{ width: "100%", height: 34, padding: 4 }} value={doc.config.corFundo ?? "#ffffff"} onChange={(e) => atualizarConfigPagina(id, { corFundo: e.target.value })} />
                </div>
                <div className="field">
                  <label>Colunas</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={4}
                    value={doc.config.colunas ?? 1}
                    onChange={(e) => atualizarConfigPagina(id, { colunas: Math.min(4, Math.max(1, Number(e.target.value) || 1)) })}
                  />
                </div>
                <div className="field">
                  <button type="button" className="btn ghost block" onClick={() => setCabecalhoRodapeAberto("cabecalho")}>Editar cabeçalho</button>
                </div>
                <div className="field">
                  <button type="button" className="btn ghost block" onClick={() => setCabecalhoRodapeAberto("rodape")}>Editar rodapé</button>
                </div>
                <div className="field">
                  <button type="button" className="btn ghost block" onClick={() => setConfigPaginaAberto(true)}>Mais opções de página…</button>
                </div>
              </>
            )}
          </aside>
        ) : null}
      </div>

      {localizarAberto ? (
        <div
          ref={localizarRef}
          className="wa-email-modal wa-email-floating doc-localizar-modal"
          style={localizarPos ? { left: localizarPos.x, top: localizarPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setLocalizarPos)}>
            <p className="n">Localizar e substituir</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setLocalizarAberto(false)}>✕</button>
          </div>
          <div className="field" style={{ padding: "6px 0" }}>
            <input
              className="input"
              style={{ width: "100%" }}
              placeholder="Localizar"
              value={buscaTexto}
              autoFocus
              onChange={(e) => {
                setBuscaTexto(e.target.value);
                setBuscaIndiceAtual(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) localizarAnterior();
                  else localizarProximo();
                }
              }}
            />
          </div>
          <div className="field" style={{ padding: "6px 0" }}>
            <input className="input" style={{ width: "100%" }} placeholder="Substituir por" value={substituirTexto} onChange={(e) => setSubstituirTexto(e.target.value)} />
          </div>
          <label className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={diferenciarCase} onChange={(e) => { setDiferenciarCase(e.target.checked); setBuscaIndiceAtual(0); }} />
            Diferenciar maiúsculas de minúsculas
          </label>
          <p className="hint" style={{ marginBottom: 8 }}>
            {buscaTexto.trim()
              ? totalOcorrencias > 0
                ? `${((buscaIndiceAtual % totalOcorrencias) + totalOcorrencias) % totalOcorrencias + 1} de ${totalOcorrencias} ocorrência(s)`
                : "Nenhuma ocorrência encontrada"
              : "Digite um termo pra buscar"}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={localizarAnterior}>◂ Anterior</button>
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={localizarProximo}>Próxima ▸</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={substituirAtual}>Substituir</button>
            <button type="button" className="btn primary" style={{ flex: 1 }} onClick={substituirTodos}>Substituir todos</button>
          </div>
        </div>
      ) : null}

      {contagemAberta ? (
        <div
          ref={contagemRef}
          className="wa-email-modal wa-email-floating doc-contagem-modal"
          style={contagemPos ? { left: contagemPos.x, top: contagemPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setContagemPos)}>
            <p className="n">Contagem</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setContagemAberta(false)}>✕</button>
          </div>
          <div className="stat-row"><span className="sl">Palavras</span><span className="sv">{contagem.palavras}</span></div>
          <div className="stat-row"><span className="sl">Caracteres</span><span className="sv">{contagem.caracteres}</span></div>
          <div className="stat-row"><span className="sl">Páginas</span><span className="sv">{contagem.paginas}</span></div>
        </div>
      ) : null}

      {detalhesAberto ? (
        <div
          ref={detalhesRef}
          className="wa-email-modal wa-email-floating doc-contagem-modal"
          style={detalhesPos ? { left: detalhesPos.x, top: detalhesPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setDetalhesPos)}>
            <p className="n">Detalhes do documento</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setDetalhesAberto(false)}>✕</button>
          </div>
          <div className="stat-row"><span className="sl">Autor</span><span className="sv">{doc.autor}</span></div>
          <div className="stat-row"><span className="sl">Criado em</span><span className="sv">{formatarQuando(doc.criadoEm)}</span></div>
          <div className="stat-row"><span className="sl">Última edição</span><span className="sv">{formatarQuando(doc.atualizadoEm)}</span></div>
          <div className="stat-row"><span className="sl">Palavras</span><span className="sv">{contagem.palavras}</span></div>
        </div>
      ) : null}

      {ajudaAberta ? (
        <div
          ref={ajudaRef}
          className="wa-email-modal wa-email-floating doc-ajuda-modal"
          style={ajudaPos ? { left: ajudaPos.x, top: ajudaPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setAjudaPos)}>
            <p className="n">Central de ajuda — Documentos</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setAjudaAberta(false)}>✕</button>
          </div>
          <div className="doc-ajuda-conteudo">
            <p className="hint" style={{ marginTop: 0 }}>Atalhos de teclado</p>
            <div className="stat-row"><span className="sl">Desfazer / Refazer</span><span className="sv">Ctrl+Z / Ctrl+Y</span></div>
            <div className="stat-row"><span className="sl">Negrito / Itálico / Sublinhado</span><span className="sv">Ctrl+B / Ctrl+I / Ctrl+U</span></div>
            <div className="stat-row"><span className="sl">Recortar / Copiar / Colar</span><span className="sv">Ctrl+X / Ctrl+C / Ctrl+V</span></div>
            <div className="stat-row"><span className="sl">Colar sem formatação</span><span className="sv">Ctrl+Shift+V</span></div>
            <div className="stat-row"><span className="sl">Selecionar tudo</span><span className="sv">Ctrl+A</span></div>
            <div className="stat-row"><span className="sl">Localizar / Substituir</span><span className="sv">Ctrl+F / Ctrl+H</span></div>
            <div className="stat-row"><span className="sl">Link</span><span className="sv">Ctrl+K</span></div>
            <div className="stat-row"><span className="sl">Comentário</span><span className="sv">Ctrl+Alt+M</span></div>
            <div className="stat-row"><span className="sl">Contagem de palavras</span><span className="sv">Ctrl+Shift+C</span></div>
            <div className="stat-row"><span className="sl">Imprimir</span><span className="sv">Ctrl+P</span></div>
            <div className="stat-row"><span className="sl">Quebra de página</span><span className="sv">Ctrl+Enter</span></div>
            <div className="stat-row"><span className="sl">Fechar menus/janelas</span><span className="sv">Esc</span></div>
            <p className="hint">Guia rápido</p>
            <ul className="doc-ajuda-lista">
              <li><b>Arquivo</b> — novo documento, cópia, compartilhar, exportar (PDF/Word/TXT/RTF/HTML) e configuração da página.</li>
              <li><b>Inserir</b> → Imagem: clique na imagem depois de inserida para redimensionar, recortar, girar e definir a quebra de texto.</li>
              <li><b>Formatar</b> → Colunas: define 1, 2 ou 3 colunas para o documento ou para a seleção.</li>
              <li><b>Ver</b> → alterna régua, caracteres não imprimíveis, modo paginado/contínuo e zoom.</li>
              <li>A auto-paginação move o texto para a página seguinte automaticamente conforme você digita.</li>
            </ul>
          </div>
        </div>
      ) : null}

      {cabecalhoRodapeAberto ? (
        <div className="modal-overlay" onClick={() => setCabecalhoRodapeAberto(null)}>
          <div className="modal" style={{ width: "min(480px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-h">
              <h4>{cabecalhoRodapeAberto === "cabecalho" ? "Cabeçalho" : "Rodapé"}</h4>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setCabecalhoRodapeAberto(null)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <p className="hint" style={{ marginTop: 0 }}>
                O que você escrever aqui se repete em todas as páginas do documento — na tela, na impressão e no PDF.
              </p>
              <div
                ref={cabecalhoRodapeEditRef}
                className="input doc-cabecalho-rodape-editor"
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{
                  __html: (cabecalhoRodapeAberto === "cabecalho" ? doc.config.cabecalhoHtml : doc.config.rodapeHtml) ?? "",
                }}
              />
              <div className="filters-row" style={{ margin: "10px 0 0" }}>
                <button
                  type="button"
                  className="fchip"
                  onClick={() => {
                    cabecalhoRodapeEditRef.current?.focus();
                    document.execCommand("insertText", false, "{{PAGINA}}");
                  }}
                >
                  Inserir número da página
                </button>
                <button
                  type="button"
                  className="fchip"
                  onClick={() => {
                    cabecalhoRodapeEditRef.current?.focus();
                    document.execCommand("insertText", false, "{{TOTAL}}");
                  }}
                >
                  Inserir total de páginas
                </button>
              </div>
            </div>
            <div className="panel-f" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn ghost"
                style={{ color: "var(--danger)" }}
                onClick={() => {
                  atualizarConfigPagina(id, cabecalhoRodapeAberto === "cabecalho" ? { cabecalhoHtml: "" } : { rodapeHtml: "" });
                  setCabecalhoRodapeAberto(null);
                }}
              >
                Remover
              </button>
              <button type="button" className="btn ghost" onClick={() => setCabecalhoRodapeAberto(null)}>Cancelar</button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const html = cabecalhoRodapeEditRef.current?.innerHTML ?? "";
                  atualizarConfigPagina(id, cabecalhoRodapeAberto === "cabecalho" ? { cabecalhoHtml: html } : { rodapeHtml: html });
                  setCabecalhoRodapeAberto(null);
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {salvarModeloAberto ? (
        <div className="modal-overlay" onClick={() => setSalvarModeloAberto(false)}>
          <div className="modal" style={{ width: "min(420px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-h">
              <h4>Salvar como modelo</h4>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setSalvarModeloAberto(false)}>✕</button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Nome do modelo</label>
                <input className="input" style={{ width: "100%" }} value={nomeNovoModelo} onChange={(e) => setNomeNovoModelo(e.target.value)} />
              </div>
              <div className="field">
                <label>Descrição</label>
                <input className="input" style={{ width: "100%" }} value={descricaoNovoModelo} onChange={(e) => setDescricaoNovoModelo(e.target.value)} placeholder="Pra que serve esse modelo" />
              </div>
              <div className="field">
                <label>Categoria</label>
                <select className="input" style={{ width: "100%" }} value={categoriaNovoModelo} onChange={(e) => setCategoriaNovoModelo(e.target.value as CategoriaModelo)}>
                  {(["Negócios", "Vendas", "Marketing", "Saúde", "Recursos Humanos", "Jurídico", "Financeiro", "Educação", "Planejamento", "Relatórios", "Comunicação", "Documentos pessoais"] as CategoriaModelo[]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <label className="hint" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={compartilharNovoModelo} onChange={(e) => setCompartilharNovoModelo(e.target.checked)} />
                Compartilhar com a organização (modelo da equipe)
              </label>
            </div>
            <div className="panel-f" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={() => setSalvarModeloAberto(false)}>Cancelar</button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  salvarComoModelo(id, {
                    nome: nomeNovoModelo,
                    descricao: descricaoNovoModelo,
                    categoria: categoriaNovoModelo,
                    compartilhado: compartilharNovoModelo,
                  });
                  setSalvarModeloAberto(false);
                }}
              >
                Salvar modelo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {configPaginaAberto ? (
        <div
          ref={configPaginaRef}
          className="wa-email-modal wa-email-floating"
          style={configPaginaPos ? { left: configPaginaPos.x, top: configPaginaPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setConfigPaginaPos)}>
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
            <label>Margens (mm) — cada lado é independente</label>
            <div className="doc-margens-grid">
              <label className="doc-margem-campo">
                <span>Superior</span>
                <input
                  type="number"
                  className="input"
                  value={margemSuperiorMm}
                  onChange={(e) => atualizarConfigPagina(id, { margemSuperiorMm: Number(e.target.value) })}
                />
              </label>
              <label className="doc-margem-campo">
                <span>Inferior</span>
                <input
                  type="number"
                  className="input"
                  value={margemInferiorMm}
                  onChange={(e) => atualizarConfigPagina(id, { margemInferiorMm: Number(e.target.value) })}
                />
              </label>
              <label className="doc-margem-campo">
                <span>Esquerda</span>
                <input
                  type="number"
                  className="input"
                  value={margemEsquerdaMm}
                  onChange={(e) => atualizarConfigPagina(id, { margemEsquerdaMm: Number(e.target.value) })}
                />
              </label>
              <label className="doc-margem-campo">
                <span>Direita</span>
                <input
                  type="number"
                  className="input"
                  value={margemDireitaMm}
                  onChange={(e) => atualizarConfigPagina(id, { margemDireitaMm: Number(e.target.value) })}
                />
              </label>
            </div>
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
      ) : null}

      {compartilharAberto ? (
        <div
          ref={compartilharRef}
          className="wa-email-modal wa-email-floating"
          style={compartilharPos ? { left: compartilharPos.x, top: compartilharPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setCompartilharPos)}>
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
                    style={{ color: "var(--danger)" }}
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
      ) : null}

      {historicoAberto ? (
        <div
          ref={historicoRef}
          className="wa-email-modal wa-email-floating"
          style={historicoPos ? { left: historicoPos.x, top: historicoPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setHistoricoPos)}>
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
      ) : null}

      {colunasAberto ? (
        <div
          ref={colunasRef}
          className="wa-email-modal wa-email-floating"
          style={colunasPos ? { left: colunasPos.x, top: colunasPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setColunasPos)}>
            <p className="n">Colunas</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setColunasAberto(false)}>✕</button>
          </div>
          <div className="field">
            <label>Quantidade de colunas</label>
            <input
              type="number"
              min={1}
              max={4}
              className="input"
              style={{ width: "100%" }}
              value={qtdColunas}
              onChange={(e) => atualizarConfigPagina(id, { colunas: Math.min(4, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </div>
          <div className="field">
            <label>Espaçamento entre colunas (mm)</label>
            <input
              type="number"
              min={2}
              max={30}
              className="input"
              style={{ width: "100%" }}
              value={doc.config.colunasEspacoMm ?? 10}
              onChange={(e) => atualizarConfigPagina(id, { colunasEspacoMm: Number(e.target.value) || 10 })}
            />
          </div>
          <label className="hint" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={!!doc.config.colunasLinha}
              onChange={(e) => atualizarConfigPagina(id, { colunasLinha: e.target.checked })}
            />
            Linha divisória entre colunas
          </label>
          <p className="hint" style={{ marginTop: 10 }}>
            Aplica ao documento inteiro (todas as páginas). Colunas de verdade via CSS — sem tabela.
          </p>
          <button type="button" className="btn primary block" onClick={() => setColunasAberto(false)}>
            Aplicar
          </button>
        </div>
      ) : null}

      {exportarPdfAberto ? (
        <div
          ref={exportarPdfRef}
          className="wa-email-modal wa-email-floating"
          style={exportarPdfPos ? { left: exportarPdfPos.x, top: exportarPdfPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setExportarPdfPos)}>
            <p className="n">Baixar como PDF</p>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setExportarPdfAberto(false)}>✕</button>
          </div>
          <p className="hint" style={{ marginBottom: 10 }}>
            {doc.titulo} · {paginasLocais.length} página(s) · {doc.config.tamanho} {doc.config.orientacao}
          </p>
          <div className="field">
            <label>O que exportar</label>
            <div className="filters-row" style={{ margin: 0, flexWrap: "wrap" }}>
              <button type="button" className={`fchip${escopoExportar === "todas" ? " active" : ""}`} onClick={() => setEscopoExportar("todas")}>Todas as páginas</button>
              <button type="button" className={`fchip${escopoExportar === "atual" ? " active" : ""}`} onClick={() => setEscopoExportar("atual")}>Só a página atual</button>
              <button type="button" className={`fchip${escopoExportar === "especificas" ? " active" : ""}`} onClick={() => setEscopoExportar("especificas")}>Páginas específicas</button>
            </div>
          </div>
          {escopoExportar === "especificas" ? (
            <div className="field">
              <label>Quais páginas (ex.: 1, 3, 5 ou 2-7)</label>
              <input
                className="input"
                style={{ width: "100%" }}
                placeholder="1-3, 6, 9-12"
                value={paginasEspecificasTexto}
                onChange={(e) => setPaginasEspecificasTexto(e.target.value)}
              />
            </div>
          ) : null}
          <p className="hint" style={{ marginBottom: 10 }}>
            Usa o tamanho, a orientação e as margens já configurados no documento. O arquivo é gerado de verdade
            e baixado direto — não abre a janela de impressão.
          </p>
          <button type="button" className="btn primary block" disabled={gerandoPdf} onClick={confirmarExportarPdf}>
            {gerandoPdf ? "Gerando PDF…" : "Baixar PDF"}
          </button>
        </div>
      ) : null}

      {imagemSelecionada ? (
        <AlcasRedimensionarImagem
          key={`${imagemSelecionada.el.dataset.docImgId}-alcas`}
          imagem={imagemSelecionada.el}
          bloqueada={estaBloqueada(imagemSelecionada.el)}
          onMudar={atualizarImagemSelecionada}
        />
      ) : null}

      {menuImagemPos && imagemSelecionada ? (
        <MenuContextoImagem
          pos={menuImagemPos}
          bloqueada={estaBloqueada(imagemSelecionada.el)}
          onFechar={() => setMenuImagemPos(null)}
          onSubstituir={() => { setMenuImagemPos(null); substituirImagemSelecionada(); }}
          onDuplicar={() => { setMenuImagemPos(null); duplicarImagemSelecionada(); }}
          onAlinhar={(lado) => {
            setMenuImagemPos(null);
            atualizarImagemSelecionada((img) => {
              img.style.position = "static";
              img.style.float = "none";
              img.style.display = "block";
              img.style.margin = lado === "centro" ? "8px auto" : lado === "direita" ? "8px 0 8px auto" : "8px auto 8px 0";
            });
          }}
          onTrazerFrente={() => { setMenuImagemPos(null); trazerImagemSelecionadaParaFrente(); }}
          onEnviarTras={() => { setMenuImagemPos(null); enviarImagemSelecionadaParaTras(); }}
          onBloquear={() => { setMenuImagemPos(null); alternarBloqueioImagemSelecionada(); }}
          onExcluir={() => { setMenuImagemPos(null); excluirImagemSelecionada(); }}
        />
      ) : null}

      {menuTextoPos ? (
        <MenuContextoTexto
          pos={menuTextoPos}
          onFechar={() => setMenuTextoPos(null)}
          onCopiar={() => { setMenuTextoPos(null); document.execCommand("copy"); }}
          onRecortar={() => { setMenuTextoPos(null); document.execCommand("cut"); salvarConteudoPagina(paginaAtivaId); }}
          onColar={() => { setMenuTextoPos(null); colarConteudo(false); }}
          onNegrito={() => { setMenuTextoPos(null); aplicarFormatacao("bold"); }}
          onItalico={() => { setMenuTextoPos(null); aplicarFormatacao("italic"); }}
          onLink={() => { setMenuTextoPos(null); inserirLink(); }}
          onCor={(c) => { setMenuTextoPos(null); aplicarFormatacao("foreColor", c); }}
          onAlinhar={(modo) => { setMenuTextoPos(null); aplicarFormatacao(modo); }}
          onDuplicarBloco={() => { setMenuTextoPos(null); duplicarBlocoDeTexto(); }}
          onExcluirBloco={() => { setMenuTextoPos(null); excluirBlocoDeTexto(); }}
        />
      ) : null}

      {toolbarSelecaoPos && !menuTextoPos && !menuImagemPos ? (
        <ToolbarFlutuanteTexto
          pos={toolbarSelecaoPos}
          onNegrito={() => aplicarFormatacao("bold")}
          onItalico={() => aplicarFormatacao("italic")}
          onSublinhado={() => aplicarFormatacao("underline")}
          onCor={(c) => aplicarFormatacao("foreColor", c)}
          onLink={inserirLink}
        />
      ) : null}

    </div>
  );
}

type ModoPosicaoImagem = "inline" | "quebrar" | "acima-abaixo" | "atras" | "frente" | "fixa";

/** Painel real de edição de imagem — aparece flutuando ao selecionar uma imagem no documento. */
function PainelImagem({
  imagem,
  onFechar,
  onMudar,
  onSubstituir,
  onExcluir,
  onDuplicar,
  onIniciarRedimensionar,
}: {
  imagem: HTMLImageElement;
  onFechar: () => void;
  onMudar: (fn: (img: HTMLImageElement) => void) => void;
  onSubstituir: () => void;
  onExcluir: () => void;
  onDuplicar: () => void;
  onIniciarRedimensionar: (e: React.MouseEvent) => void;
}) {
  const [manterProporcao, setManterProporcao] = useState(true);
  const [unidadeTamanho, setUnidadeTamanho] = useState<"px" | "cm" | "%">("px");
  const [cortarTopo, setCortarTopo] = useState(0);
  const [cortarDireita, setCortarDireita] = useState(0);
  const [cortarBaixo, setCortarBaixo] = useState(0);
  const [cortarEsquerda, setCortarEsquerda] = useState(0);
  const [efeitos, setEfeitos] = useState({ desfoque: 0, brilho: 100, contraste: 100, saturacao: 100 });
  const bloqueada = imagem.dataset.bloqueada === "1";

  const larguraAtual = Math.round(imagem.getBoundingClientRect().width) || imagem.naturalWidth;
  const alturaAtual = Math.round(imagem.getBoundingClientRect().height) || imagem.naturalHeight;
  const proporcao = imagem.naturalWidth && imagem.naturalHeight ? imagem.naturalWidth / imagem.naturalHeight : 1;
  // Referência pra converter %: a largura útil do container (a folha da página, se existir).
  const referenciaLarguraPx = imagem.closest(".doc-page-sheet")?.clientWidth || imagem.parentElement?.clientWidth || larguraAtual;

  const PX_POR_CM = 96 / 2.54;
  function converterParaPx(valor: number, unidade: "px" | "cm" | "%") {
    if (unidade === "cm") return valor * PX_POR_CM;
    if (unidade === "%") return (valor / 100) * referenciaLarguraPx;
    return valor;
  }
  function converterDePx(px: number, unidade: "px" | "cm" | "%") {
    if (unidade === "cm") return Math.round((px / PX_POR_CM) * 10) / 10;
    if (unidade === "%") return Math.round((px / referenciaLarguraPx) * 1000) / 10;
    return Math.round(px);
  }

  function aplicarLargura(novaLarguraNaUnidade: number) {
    const novaLargura = Math.round(converterParaPx(novaLarguraNaUnidade, unidadeTamanho));
    onMudar((img) => {
      img.style.width = `${novaLargura}px`;
      img.style.height = manterProporcao ? "auto" : img.style.height || "auto";
    });
  }

  function aplicarAltura(novaAlturaNaUnidade: number) {
    const novaAltura = Math.round(converterParaPx(novaAlturaNaUnidade, unidadeTamanho));
    onMudar((img) => {
      if (manterProporcao) {
        img.style.width = `${Math.round(novaAltura * proporcao)}px`;
        img.style.height = "auto";
      } else {
        img.style.height = `${novaAltura}px`;
      }
    });
  }

  function girar(graus: number) {
    onMudar((img) => {
      const atual = Number((img.dataset.rotacao ?? "0")) + graus;
      img.dataset.rotacao = String(atual);
      img.style.transform = montarTransform(img);
    });
  }

  function espelhar(eixo: "h" | "v") {
    onMudar((img) => {
      const chave = eixo === "h" ? "espelhoH" : "espelhoV";
      img.dataset[chave] = img.dataset[chave] === "1" ? "0" : "1";
      img.style.transform = montarTransform(img);
    });
  }

  function montarTransform(img: HTMLImageElement) {
    const rotacao = img.dataset.rotacao ?? "0";
    const eh = img.dataset.espelhoH === "1" ? -1 : 1;
    const ev = img.dataset.espelhoV === "1" ? -1 : 1;
    return `rotate(${rotacao}deg) scale(${eh}, ${ev})`;
  }

  function restaurarOriginal() {
    onMudar((img) => {
      // Desfaz de verdade o corte (que substitui o src por um recorte via canvas), não só o CSS —
      // a imagem original fica guardada em data-original-src desde a inserção/substituição.
      if (img.dataset.originalSrc) img.src = img.dataset.originalSrc;
      img.removeAttribute("style");
      img.style.maxWidth = "100%";
      delete img.dataset.rotacao;
      delete img.dataset.espelhoH;
      delete img.dataset.espelhoV;
    });
  }

  function alternarBorda() {
    onMudar((img) => {
      // Usa border-style como a fonte da verdade de "tem borda ou não" — os controles de espessura e
      // cor abaixo mexem só em border-width/border-color (longhand), nunca no atalho "border" inteiro,
      // então os dois nunca se pisam.
      const temBorda = img.style.borderStyle === "solid";
      if (temBorda) {
        img.style.borderStyle = "none";
      } else {
        img.style.borderStyle = "solid";
        if (!img.style.borderWidth) img.style.borderWidth = "2px";
        if (!img.style.borderColor) img.style.borderColor = "#0b1533";
      }
    });
  }

  function aplicarEfeitos(patch: Partial<typeof efeitos>) {
    const novo = { ...efeitos, ...patch };
    setEfeitos(novo);
    onMudar((img) => {
      img.style.filter = `blur(${novo.desfoque}px) brightness(${novo.brilho}%) contrast(${novo.contraste}%) saturate(${novo.saturacao}%)`;
    });
  }

  function aplicarPresetEfeito(preset: "pb" | "sepia" | "nenhum") {
    const novo = preset === "nenhum" ? { desfoque: 0, brilho: 100, contraste: 100, saturacao: 100 } : efeitos;
    setEfeitos(novo);
    onMudar((img) => {
      if (preset === "pb") img.style.filter = "grayscale(1)";
      else if (preset === "sepia") img.style.filter = "sepia(0.7)";
      else img.style.filter = `blur(${novo.desfoque}px) brightness(${novo.brilho}%) contrast(${novo.contraste}%) saturate(${novo.saturacao}%)`;
    });
  }

  function alternarBloqueio() {
    onMudar((img) => {
      img.dataset.bloqueada = bloqueada ? "0" : "1";
    });
  }

  function mudarPosicao(modo: ModoPosicaoImagem) {
    onMudar((img) => {
      img.style.float = "none";
      img.style.position = "static";
      img.style.display = "inline-block";
      img.style.zIndex = "";
      if (modo === "quebrar") {
        img.style.float = "left";
        img.style.margin = "0 12px 8px 0";
      } else if (modo === "acima-abaixo") {
        img.style.display = "block";
        img.style.margin = "8px auto";
      } else if (modo === "atras") {
        img.style.position = "absolute";
        img.style.zIndex = "-1";
        img.style.left = img.style.left || "0px";
        img.style.top = img.style.top || "0px";
      } else if (modo === "frente") {
        img.style.position = "absolute";
        img.style.zIndex = "5";
        img.style.left = img.style.left || "0px";
        img.style.top = img.style.top || "0px";
      } else if (modo === "fixa") {
        img.style.position = "absolute";
        img.style.zIndex = "1";
        img.style.left = img.style.left || "0px";
        img.style.top = img.style.top || "0px";
      }
    });
  }

  function alinhar(lado: "esquerda" | "centro" | "direita") {
    onMudar((img) => {
      img.style.position = "static";
      img.style.float = "none";
      img.style.display = "block";
      img.style.margin = lado === "centro" ? "8px auto" : lado === "direita" ? "8px 0 8px auto" : "8px auto 8px 0";
    });
  }

  function aplicarCorte() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const nl = imagem.naturalWidth;
    const na = imagem.naturalHeight;
    const sx = (cortarEsquerda / 100) * nl;
    const sy = (cortarTopo / 100) * na;
    const sw = nl - sx - (cortarDireita / 100) * nl;
    const sh = na - sy - (cortarBaixo / 100) * na;
    if (sw <= 0 || sh <= 0) {
      window.alert("Corte inválido — a área restante ficaria vazia.");
      return;
    }
    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(imagem, sx, sy, sw, sh, 0, 0, sw, sh);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      onMudar((img) => {
        img.src = dataUrl;
      });
      setCortarTopo(0);
      setCortarDireita(0);
      setCortarBaixo(0);
      setCortarEsquerda(0);
    } catch {
      window.alert("Não foi possível cortar essa imagem (pode ser uma imagem de outra origem, bloqueada por CORS).");
    }
  }

  return (
    <aside className="doc-lateral-painel doc-img-painel">
      <div className="panel-h">
        <h4>Imagem{bloqueada ? " 🔒" : ""}</h4>
        <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
      </div>

      <div className="field">
        <button type="button" className={`fchip${bloqueada ? " active" : ""}`} onClick={alternarBloqueio} style={{ width: "100%" }}>
          {bloqueada ? "🔓 Desbloquear posição" : "🔒 Bloquear posição"}
        </button>
        {bloqueada ? <p className="hint" style={{ marginTop: 6 }}>Arrastar e redimensionar ficam desativados até desbloquear.</p> : null}
      </div>

      <p className="hint" style={{ marginBottom: 8 }}>Dimensões atuais: {larguraAtual}×{alturaAtual}px</p>

      <div className="field">
        <label>Unidade</label>
        <div className="filters-row" style={{ margin: 0 }}>
          <button type="button" className={`fchip${unidadeTamanho === "px" ? " active" : ""}`} onClick={() => setUnidadeTamanho("px")}>Pixels</button>
          <button type="button" className={`fchip${unidadeTamanho === "cm" ? " active" : ""}`} onClick={() => setUnidadeTamanho("cm")}>Centímetros</button>
          <button type="button" className={`fchip${unidadeTamanho === "%" ? " active" : ""}`} onClick={() => setUnidadeTamanho("%")}>% da página</button>
        </div>
      </div>
      <div className="field" style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>Largura ({unidadeTamanho})</label>
          <input
            type="number"
            className="input"
            style={{ width: "100%" }}
            value={converterDePx(larguraAtual, unidadeTamanho)}
            onChange={(e) => aplicarLargura(Number(e.target.value) || 1)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Altura ({unidadeTamanho})</label>
          <input
            type="number"
            className="input"
            style={{ width: "100%" }}
            value={converterDePx(alturaAtual, unidadeTamanho)}
            onChange={(e) => aplicarAltura(Number(e.target.value) || 1)}
          />
        </div>
      </div>
      <label className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={manterProporcao} onChange={(e) => setManterProporcao(e.target.checked)} />
        Manter proporção
      </label>
      {!bloqueada ? (
        <div
          className="doc-img-resize-alca"
          title="Arraste pra redimensionar (ou use as alças nos cantos da imagem)"
          onMouseDown={onIniciarRedimensionar}
        >
          ⤡ Arrastar pra redimensionar
        </div>
      ) : null}

      <div className="field">
        <label>Girar / espelhar</label>
        <div className="filters-row" style={{ margin: 0 }}>
          <button type="button" className="fchip" onClick={() => girar(-90)}>↺ Girar esquerda</button>
          <button type="button" className="fchip" onClick={() => girar(90)}>↻ Girar direita</button>
          <button type="button" className="fchip" onClick={() => espelhar("h")}>⇋ Espelhar H</button>
          <button type="button" className="fchip" onClick={() => espelhar("v")}>⇵ Espelhar V</button>
        </div>
      </div>

      <div className="field">
        <label>Posição no texto</label>
        <div className="filters-row" style={{ margin: 0, flexWrap: "wrap" }}>
          <button type="button" className="fchip" onClick={() => mudarPosicao("inline")}>Em linha</button>
          <button type="button" className="fchip" onClick={() => mudarPosicao("quebrar")}>Quebrar texto</button>
          <button type="button" className="fchip" onClick={() => mudarPosicao("acima-abaixo")}>Acima/abaixo</button>
          <button type="button" className="fchip" onClick={() => mudarPosicao("atras")}>Atrás do texto</button>
          <button type="button" className="fchip" onClick={() => mudarPosicao("frente")}>Na frente</button>
          <button type="button" className="fchip" onClick={() => mudarPosicao("fixa")}>Posição fixa (arrastável)</button>
        </div>
        {imagem.style.position === "absolute" ? (
          <p className="hint" style={{ marginTop: 6 }}>Arraste a imagem ou use as setas do teclado pra mover (Shift+seta move mais rápido).</p>
        ) : null}
      </div>

      <div className="field">
        <label>Alinhamento</label>
        <div className="filters-row" style={{ margin: 0 }}>
          <button type="button" className="fchip" onClick={() => alinhar("esquerda")}>Esquerda</button>
          <button type="button" className="fchip" onClick={() => alinhar("centro")}>Centro</button>
          <button type="button" className="fchip" onClick={() => alinhar("direita")}>Direita</button>
        </div>
      </div>

      <div className="field">
        <label>Camadas</label>
        <div className="filters-row" style={{ margin: 0, flexWrap: "wrap" }}>
          <button type="button" className="fchip" onClick={() => onMudar((img) => { img.style.zIndex = "50"; })}>⬆ Trazer pra frente</button>
          <button type="button" className="fchip" onClick={() => onMudar((img) => { const a = parseInt(img.style.zIndex || "0", 10) || 0; img.style.zIndex = String(a + 1); })}>Avançar</button>
          <button type="button" className="fchip" onClick={() => onMudar((img) => { const a = parseInt(img.style.zIndex || "0", 10) || 0; img.style.zIndex = String(a - 1); })}>Recuar</button>
          <button type="button" className="fchip" onClick={() => onMudar((img) => { img.style.zIndex = "-1"; })}>⬇ Enviar pra trás</button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>Só tem efeito visível quando a posição não é &quot;Em linha&quot;.</p>
      </div>

      <div className="field">
        <label>Cortar (% de cada lado)</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input type="number" className="input" placeholder="Topo" value={cortarTopo} onChange={(e) => setCortarTopo(Number(e.target.value) || 0)} />
          <input type="number" className="input" placeholder="Direita" value={cortarDireita} onChange={(e) => setCortarDireita(Number(e.target.value) || 0)} />
          <input type="number" className="input" placeholder="Baixo" value={cortarBaixo} onChange={(e) => setCortarBaixo(Number(e.target.value) || 0)} />
          <input type="number" className="input" placeholder="Esquerda" value={cortarEsquerda} onChange={(e) => setCortarEsquerda(Number(e.target.value) || 0)} />
        </div>
        <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={aplicarCorte}>✂ Aplicar corte</button>
      </div>

      <div className="field">
        <label>Borda, transparência e distância do texto</label>
        <div className="filters-row" style={{ margin: 0 }}>
          <button type="button" className="fchip" onClick={alternarBorda}>Alternar borda</button>
        </div>
        <input
          type="range"
          min={2}
          max={12}
          defaultValue={2}
          onChange={(e) => onMudar((img) => { img.style.borderStyle = "solid"; img.style.borderWidth = `${e.target.value}px`; })}
          style={{ width: "100%", marginTop: 6 }}
          title="Espessura da borda"
        />
        <input
          type="color"
          className="input"
          style={{ width: "100%", height: 34, padding: 4, marginTop: 6 }}
          defaultValue="#0b1533"
          onChange={(e) => onMudar((img) => { img.style.borderStyle = "solid"; img.style.borderColor = e.target.value; })}
          title="Cor da borda"
        />
        <input
          type="range"
          min={10}
          max={100}
          defaultValue={100}
          onChange={(e) => onMudar((img) => { img.style.opacity = String(Number(e.target.value) / 100); })}
          style={{ width: "100%", marginTop: 10 }}
          title="Transparência"
        />
        <input
          type="range"
          min={0}
          max={40}
          defaultValue={0}
          onChange={(e) => onMudar((img) => { img.style.margin = `${e.target.value}px`; })}
          style={{ width: "100%", marginTop: 10 }}
          title="Distância entre a imagem e o texto"
        />
      </div>

      <div className="field">
        <label>Raio da borda e sombra</label>
        <input
          type="range"
          min={0}
          max={60}
          defaultValue={0}
          onChange={(e) => onMudar((img) => { img.style.borderRadius = `${e.target.value}px`; })}
          style={{ width: "100%" }}
          title="Raio da borda (cantos arredondados)"
        />
        <div className="filters-row" style={{ margin: "8px 0 0" }}>
          <button
            type="button"
            className="fchip"
            onClick={() => onMudar((img) => {
              img.style.boxShadow = img.style.boxShadow ? "" : "0 8px 20px rgba(0,0,0,0.25)";
            })}
          >
            Alternar sombra
          </button>
        </div>
      </div>

      <div className="field">
        <label>Efeitos</label>
        <div className="filters-row" style={{ margin: 0 }}>
          <button type="button" className="fchip" onClick={() => aplicarPresetEfeito("pb")}>Preto e branco</button>
          <button type="button" className="fchip" onClick={() => aplicarPresetEfeito("sepia")}>Sépia</button>
          <button type="button" className="fchip" onClick={() => aplicarPresetEfeito("nenhum")}>Nenhum</button>
        </div>
        <label className="hint" style={{ display: "block", marginTop: 8 }}>Desfoque</label>
        <input type="range" min={0} max={10} value={efeitos.desfoque} onChange={(e) => aplicarEfeitos({ desfoque: Number(e.target.value) })} style={{ width: "100%" }} />
        <label className="hint" style={{ display: "block", marginTop: 8 }}>Brilho</label>
        <input type="range" min={50} max={150} value={efeitos.brilho} onChange={(e) => aplicarEfeitos({ brilho: Number(e.target.value) })} style={{ width: "100%" }} />
        <label className="hint" style={{ display: "block", marginTop: 8 }}>Contraste</label>
        <input type="range" min={50} max={150} value={efeitos.contraste} onChange={(e) => aplicarEfeitos({ contraste: Number(e.target.value) })} style={{ width: "100%" }} />
        <label className="hint" style={{ display: "block", marginTop: 8 }}>Saturação</label>
        <input type="range" min={0} max={200} value={efeitos.saturacao} onChange={(e) => aplicarEfeitos({ saturacao: Number(e.target.value) })} style={{ width: "100%" }} />
      </div>

      <div className="field" style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn ghost"
          style={{ flex: 1 }}
          onClick={() => {
            const atual = imagem.alt;
            const novo = window.prompt("Texto alternativo (acessibilidade):", atual);
            if (novo !== null) onMudar((img) => { img.alt = novo; });
          }}
        >
          Texto alternativo
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ flex: 1 }}
          onClick={() => {
            const legendaExistente = imagem.nextElementSibling?.classList.contains("doc-img-legenda")
              ? imagem.nextElementSibling.textContent ?? ""
              : "";
            const texto = window.prompt("Legenda da imagem:", legendaExistente);
            if (texto === null) return;
            onMudar((img) => {
              if (img.nextElementSibling?.classList.contains("doc-img-legenda")) {
                img.nextElementSibling.textContent = texto;
              } else {
                const legenda = document.createElement("div");
                legenda.className = "doc-img-legenda";
                legenda.textContent = texto;
                img.after(legenda);
              }
            });
          }}
        >
          Legenda
        </button>
      </div>

      <div className="field" style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onSubstituir}>Substituir</button>
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onDuplicar}>Duplicar</button>
      </div>
      <div className="field" style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={restaurarOriginal}>Restaurar original</button>
        <button type="button" className="btn ghost" style={{ flex: 1, color: "var(--danger)" }} onClick={onExcluir}>Excluir</button>
      </div>
    </aside>
  );
}

type PosicaoAlca = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
const ALCAS: { pos: PosicaoAlca; cursor: string }[] = [
  { pos: "nw", cursor: "nwse-resize" },
  { pos: "n", cursor: "ns-resize" },
  { pos: "ne", cursor: "nesw-resize" },
  { pos: "w", cursor: "ew-resize" },
  { pos: "e", cursor: "ew-resize" },
  { pos: "sw", cursor: "nesw-resize" },
  { pos: "s", cursor: "ns-resize" },
  { pos: "se", cursor: "nwse-resize" },
];

/**
 * Alças visuais de redimensionar sobrepostas na própria imagem selecionada — cantos redimensionam
 * mantendo proporção, laterais redimensionam livre (só largura ou só altura), igual Canva/Figma/Word.
 * A posição é recalculada via `getBoundingClientRect()` (a imagem é DOM cru, fora do React) sempre que
 * a janela rola/redimensiona ou a própria imagem muda de tamanho.
 */
function AlcasRedimensionarImagem({
  imagem,
  bloqueada,
  onMudar,
}: {
  imagem: HTMLImageElement;
  bloqueada: boolean;
  onMudar: (fn: (img: HTMLImageElement) => void) => void;
}) {
  const [, recalcular] = useState(0);

  useEffect(() => {
    function aoRolarOuRedimensionar() {
      recalcular((n) => n + 1);
    }
    window.addEventListener("scroll", aoRolarOuRedimensionar, true);
    window.addEventListener("resize", aoRolarOuRedimensionar);
    const observer = new ResizeObserver(aoRolarOuRedimensionar);
    observer.observe(imagem);
    return () => {
      window.removeEventListener("scroll", aoRolarOuRedimensionar, true);
      window.removeEventListener("resize", aoRolarOuRedimensionar);
      observer.disconnect();
    };
  }, [imagem]);

  if (bloqueada) return null;
  const rect = imagem.getBoundingClientRect();

  function iniciarAlca(e: React.MouseEvent, pos: PosicaoAlca) {
    e.preventDefault();
    e.stopPropagation();
    const inicial = imagem.getBoundingClientRect();
    const xInicial = e.clientX;
    const yInicial = e.clientY;
    const aspecto = inicial.width / inicial.height || 1;
    const ehCanto = pos.length === 2;
    const ehAbsoluta = imagem.style.position === "absolute";
    const esquerdaInicial = parseFloat(imagem.style.left || "0") || 0;
    const topoInicial = parseFloat(imagem.style.top || "0") || 0;

    function mover(ev: MouseEvent) {
      const dx = ev.clientX - xInicial;
      const dy = ev.clientY - yInicial;
      let novaLargura = inicial.width;
      let novaAltura = inicial.height;
      if (pos.includes("e")) novaLargura = inicial.width + dx;
      if (pos.includes("w")) novaLargura = inicial.width - dx;
      if (pos.includes("s")) novaAltura = inicial.height + dy;
      if (pos.includes("n")) novaAltura = inicial.height - dy;
      novaLargura = Math.max(24, novaLargura);
      novaAltura = Math.max(24, novaAltura);
      if (ehCanto) novaAltura = novaLargura / aspecto;

      imagem.style.width = `${Math.round(novaLargura)}px`;
      imagem.style.height = ehCanto ? "auto" : `${Math.round(novaAltura)}px`;
      if (ehAbsoluta) {
        if (pos.includes("w")) imagem.style.left = `${Math.round(esquerdaInicial + (inicial.width - novaLargura))}px`;
        if (pos.includes("n")) imagem.style.top = `${Math.round(topoInicial + (inicial.height - novaAltura))}px`;
      }
      recalcular((n) => n + 1);
    }
    function soltar() {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      onMudar(() => undefined);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  return (
    <div className="doc-img-handles" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      {ALCAS.map((a) => (
        <div
          key={a.pos}
          className={`doc-img-handle doc-img-handle-${a.pos}`}
          style={{ cursor: a.cursor }}
          onMouseDown={(e) => iniciarAlca(e, a.pos)}
        />
      ))}
    </div>
  );
}

/** Menu de botão direito na imagem — reposiciona sozinho se abriria fora da viewport. */
function MenuContextoImagem({
  pos,
  bloqueada,
  onFechar,
  onSubstituir,
  onDuplicar,
  onAlinhar,
  onTrazerFrente,
  onEnviarTras,
  onBloquear,
  onExcluir,
}: {
  pos: { x: number; y: number };
  bloqueada: boolean;
  onFechar: () => void;
  onSubstituir: () => void;
  onDuplicar: () => void;
  onAlinhar: (lado: "esquerda" | "centro" | "direita") => void;
  onTrazerFrente: () => void;
  onEnviarTras: () => void;
  onBloquear: () => void;
  onExcluir: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ajuste, setAjuste] = useState({ x: 0, y: 0 });
  useFecharAoClicarFora(ref, true, onFechar);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margem = 8;
    const dx = rect.right > window.innerWidth - margem ? window.innerWidth - margem - rect.right : 0;
    const dy = rect.bottom > window.innerHeight - margem ? window.innerHeight - margem - rect.bottom : 0;
    if (dx || dy) setAjuste({ x: dx, y: dy });
  }, []);

  return (
    <div
      ref={ref}
      className="doc-context-menu"
      style={{ left: pos.x + ajuste.x, top: pos.y + ajuste.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" onClick={onSubstituir}>🔁 Substituir imagem</button>
      <button type="button" onClick={onDuplicar}>⧉ Duplicar</button>
      <div className="doc-context-menu-sep" />
      <div className="doc-context-menu-linha">
        <button type="button" onClick={() => onAlinhar("esquerda")}>◧</button>
        <button type="button" onClick={() => onAlinhar("centro")}>▣</button>
        <button type="button" onClick={() => onAlinhar("direita")}>◨</button>
      </div>
      <button type="button" onClick={onTrazerFrente}>⬆ Trazer pra frente</button>
      <button type="button" onClick={onEnviarTras}>⬇ Enviar pra trás</button>
      <button type="button" onClick={onBloquear}>{bloqueada ? "🔓 Desbloquear" : "🔒 Bloquear"}</button>
      <div className="doc-context-menu-sep" />
      <button type="button" className="perigo" onClick={onExcluir}>🗑 Excluir</button>
    </div>
  );
}

const CORES_MENU_TEXTO = ["#0b1533", "#2e6bff", "#0f9d63", "#d64545", "#c9660a"];

/** Menu de botão direito em texto (item 5) — reposiciona sozinho se abriria fora da viewport, igual o de imagem. */
function MenuContextoTexto({
  pos,
  onFechar,
  onCopiar,
  onRecortar,
  onColar,
  onNegrito,
  onItalico,
  onLink,
  onCor,
  onAlinhar,
  onDuplicarBloco,
  onExcluirBloco,
}: {
  pos: { x: number; y: number };
  onFechar: () => void;
  onCopiar: () => void;
  onRecortar: () => void;
  onColar: () => void;
  onNegrito: () => void;
  onItalico: () => void;
  onLink: () => void;
  onCor: (cor: string) => void;
  onAlinhar: (comando: string) => void;
  onDuplicarBloco: () => void;
  onExcluirBloco: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ajuste, setAjuste] = useState({ x: 0, y: 0 });
  useFecharAoClicarFora(ref, true, onFechar);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margem = 8;
    const dx = rect.right > window.innerWidth - margem ? window.innerWidth - margem - rect.right : 0;
    const dy = rect.bottom > window.innerHeight - margem ? window.innerHeight - margem - rect.bottom : 0;
    if (dx || dy) setAjuste({ x: dx, y: dy });
  }, []);

  return (
    <div
      ref={ref}
      className="doc-context-menu"
      style={{ left: pos.x + ajuste.x, top: pos.y + ajuste.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" onClick={onCopiar}>📋 Copiar</button>
      <button type="button" onClick={onRecortar}>✂ Recortar</button>
      <button type="button" onClick={onColar}>📥 Colar</button>
      <div className="doc-context-menu-sep" />
      <button type="button" style={{ fontWeight: 700 }} onMouseDown={(e) => e.preventDefault()} onClick={onNegrito}>N Negrito</button>
      <button type="button" style={{ fontStyle: "italic" }} onMouseDown={(e) => e.preventDefault()} onClick={onItalico}>I Itálico</button>
      <button type="button" onClick={onLink}>🔗 Link</button>
      <div className="doc-context-menu-linha">
        {CORES_MENU_TEXTO.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCor(c)}
            style={{ background: c, width: 22, height: 22, borderRadius: "50%", padding: 0, border: "1px solid var(--line)" }}
          />
        ))}
      </div>
      <div className="doc-context-menu-linha">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlinhar("justifyLeft")}>≡◧</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlinhar("justifyCenter")}>≡</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlinhar("justifyRight")}>◨≡</button>
      </div>
      <div className="doc-context-menu-sep" />
      <button type="button" onClick={onDuplicarBloco}>⧉ Duplicar bloco</button>
      <button type="button" className="perigo" onClick={onExcluirBloco}>🗑 Excluir bloco</button>
    </div>
  );
}

/** Toolbar mini flutuante (Prioridade 4) — some sozinha quando a seleção de texto acaba (governada
 * pelo `selectionchange` no componente pai, não tem estado próprio de aberto/fechado). */
function ToolbarFlutuanteTexto({
  pos,
  onNegrito,
  onItalico,
  onSublinhado,
  onCor,
  onLink,
}: {
  pos: { x: number; y: number };
  onNegrito: () => void;
  onItalico: () => void;
  onSublinhado: () => void;
  onCor: (cor: string) => void;
  onLink: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ajuste, setAjuste] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margem = 8;
    const dx = rect.left < margem ? margem - rect.left : rect.right > window.innerWidth - margem ? window.innerWidth - margem - rect.right : 0;
    const dy = rect.top < margem ? rect.height + 16 : 0;
    setAjuste({ x: dx, y: dy });
  }, [pos]);

  return (
    <div
      ref={ref}
      className="doc-toolbar-flutuante"
      style={{ left: pos.x + ajuste.x, top: pos.y + ajuste.y - 44 }}
    >
      <button type="button" style={{ fontWeight: 700 }} onMouseDown={(e) => { e.preventDefault(); onNegrito(); }}>N</button>
      <button type="button" style={{ fontStyle: "italic" }} onMouseDown={(e) => { e.preventDefault(); onItalico(); }}>I</button>
      <button type="button" style={{ textDecoration: "underline" }} onMouseDown={(e) => { e.preventDefault(); onSublinhado(); }}>S</button>
      <span className="doc-toolbar-flutuante-sep" />
      {CORES_MENU_TEXTO.slice(0, 3).map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${c}`}
          onMouseDown={(e) => { e.preventDefault(); onCor(c); }}
          style={{ background: c, width: 16, height: 16, borderRadius: "50%", padding: 0 }}
        />
      ))}
      <span className="doc-toolbar-flutuante-sep" />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onLink(); }}>🔗</button>
    </div>
  );
}

/**
 * Seletor de fonte com busca e prévia visual — cada opção é renderizada na própria fonte que
 * representa, e um campo de busca filtra a lista por nome. Substitui o <select> nativo, que não dá
 * pra estilizar cada <option> de forma confiável entre navegadores nem colocar um campo de busca
 * dentro dele.
 */
function SeletorFonte({
  fontes,
  valorAtual,
  onEscolher,
}: {
  fontes: { label: string; valor: string }[];
  valorAtual: string;
  onEscolher: (valor: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [busca, setBusca] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const atual = fontes.find((f) => f.valor === valorAtual) ?? fontes[0];
  const termo = busca.trim().toLowerCase();
  const filtradas = termo ? fontes.filter((f) => f.label.toLowerCase().includes(termo)) : fontes;

  function fechar() {
    setAberto(false);
    setBusca("");
  }

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="doc-toolbar-select doc-toolbar-fonte-btn"
        style={{ fontFamily: atual.valor }}
        title="Fonte"
        onClick={() => {
          if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
          setAberto((v) => !v);
        }}
      >
        {atual.label} ▾
      </button>
      <FloatingDropdown anchorRect={aberto ? rect : null} onClose={fechar} width={220} maxHeight={320}>
        <div style={{ padding: "8px 8px 4px" }}>
          <input
            className="input"
            style={{ width: "100%" }}
            placeholder="Buscar fonte…"
            value={busca}
            autoFocus
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: 250, overflowY: "auto" }}>
          {filtradas.length === 0 ? (
            <p className="hint" style={{ padding: "8px 14px" }}>Nenhuma fonte encontrada.</p>
          ) : (
            filtradas.map((f) => (
              <button
                key={f.valor}
                type="button"
                className={`dropdown-item${f.valor === valorAtual ? " active" : ""}`}
                style={{ width: "100%", textAlign: "left", fontFamily: f.valor, fontSize: 15 }}
                onClick={() => {
                  onEscolher(f.valor);
                  fechar();
                }}
              >
                {f.label}
              </button>
            ))
          )}
        </div>
      </FloatingDropdown>
    </>
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
