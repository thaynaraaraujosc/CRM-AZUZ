"use client";

import { useRef, useState } from "react";

import { IconDoc } from "@/components/icons";
import { Topbar } from "@/components/ui";

type PaginaDocumento = {
  id: string;
  titulo: string;
  conteudoHtml: string;
};

const PAGINAS_INICIAIS: PaginaDocumento[] = [
  {
    id: "pagina-1",
    titulo: "Notas gerais",
    conteudoHtml:
      "<p>Anotações e combinados da equipe — use as páginas ao lado pra separar por assunto.</p>",
  },
];

const FONTES_DOCUMENTO = [
  { label: "Arial", valor: "Arial, sans-serif" },
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

export default function DocumentosPage() {
  const [paginas, setPaginas] = useState<PaginaDocumento[]>(PAGINAS_INICIAIS);
  const [paginaAtivaId, setPaginaAtivaId] = useState(PAGINAS_INICIAIS[0].id);
  const corpoRef = useRef<HTMLDivElement>(null);

  const paginaAtiva = paginas.find((p) => p.id === paginaAtivaId) ?? paginas[0];

  function atualizarPaginaAtiva(patch: Partial<PaginaDocumento>) {
    setPaginas((prev) =>
      prev.map((p) => (p.id === paginaAtivaId ? { ...p, ...patch } : p)),
    );
  }

  function salvarConteudoAtual() {
    if (corpoRef.current) {
      atualizarPaginaAtiva({ conteudoHtml: corpoRef.current.innerHTML });
    }
  }

  function trocarPagina(id: string) {
    salvarConteudoAtual();
    setPaginaAtivaId(id);
  }

  function adicionarPagina() {
    salvarConteudoAtual();
    // eslint-disable-next-line react-hooks/purity -- só roda a partir de um clique, nunca durante o render
    const id = `pagina-${Date.now()}`;
    const nova: PaginaDocumento = {
      id,
      titulo: "Sem título",
      conteudoHtml: "",
    };
    setPaginas((prev) => [...prev, nova]);
    setPaginaAtivaId(nova.id);
  }

  function excluirPagina(id: string) {
    if (paginas.length <= 1) return;
    if (!window.confirm("Excluir essa página?")) return;
    setPaginas((prev) => {
      const restante = prev.filter((p) => p.id !== id);
      if (paginaAtivaId === id) setPaginaAtivaId(restante[0].id);
      return restante;
    });
  }

  function aplicarFormatacao(comando: string, valor?: string) {
    corpoRef.current?.focus();
    document.execCommand(comando, false, valor);
  }

  if (!paginaAtiva) return null;

  return (
    <>
      <Topbar
        title="Documentos"
        sub="Escreva documentos com formatação — negrito, fonte, tamanho — em quantas páginas precisar"
      />

      <div className="content">
        <div className="doc-view">
          <aside className="doc-sidebar">
            <p className="doc-sidebar-h">Páginas</p>
            {paginas.map((p) => (
              <div
                key={p.id}
                className={`doc-page-item${p.id === paginaAtivaId ? " active" : ""}`}
                onClick={() => trocarPagina(p.id)}
              >
                <IconDoc width={13} height={13} />
                <span>{p.titulo || "Sem título"}</span>
                {paginas.length > 1 ? (
                  <span
                    role="button"
                    aria-label={`Excluir página ${p.titulo}`}
                    className="doc-page-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      excluirPagina(p.id);
                    }}
                  >
                    ✕
                  </span>
                ) : null}
              </div>
            ))}
            <button type="button" className="doc-page-add" onClick={adicionarPagina}>
              + Adicionar página
            </button>
          </aside>

          <div className="doc-main">
            <div className="doc-toolbar doc-toolbar-rich">
              <select
                className="doc-toolbar-select"
                defaultValue={FONTES_DOCUMENTO[0].valor}
                aria-label="Fonte"
                onChange={(e) => aplicarFormatacao("fontName", e.target.value)}
              >
                {FONTES_DOCUMENTO.map((f) => (
                  <option key={f.label} value={f.valor}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="doc-toolbar-select"
                defaultValue={TAMANHOS_FONTE_DOC[1].valor}
                aria-label="Tamanho da fonte"
                onChange={(e) => aplicarFormatacao("fontSize", e.target.value)}
              >
                {TAMANHOS_FONTE_DOC.map((t) => (
                  <option key={t.label} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="doc-toolbar-sep" />
              <button
                type="button"
                className="doc-toolbar-btn"
                style={{ fontWeight: 700 }}
                aria-label="Negrito"
                title="Negrito"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => aplicarFormatacao("bold")}
              >
                N
              </button>
              <button
                type="button"
                className="doc-toolbar-btn"
                style={{ fontStyle: "italic" }}
                aria-label="Itálico"
                title="Itálico"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => aplicarFormatacao("italic")}
              >
                I
              </button>
              <button
                type="button"
                className="doc-toolbar-btn"
                style={{ textDecoration: "underline" }}
                aria-label="Sublinhado"
                title="Sublinhado"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => aplicarFormatacao("underline")}
              >
                S
              </button>
              <span className="doc-toolbar-sep" />
              <button
                type="button"
                className="btn ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => window.print()}
              >
                Imprimir
              </button>
            </div>

            <div className="doc-canvas">
              <div className="doc-page-sheet doc-print-area">
                <input
                  className="doc-title-input"
                  value={paginaAtiva.titulo}
                  onChange={(e) => atualizarPaginaAtiva({ titulo: e.target.value })}
                  placeholder="Sem título"
                />
                <div
                  key={paginaAtiva.id}
                  ref={corpoRef}
                  className="doc-body-rich"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: paginaAtiva.conteudoHtml }}
                  onBlur={salvarConteudoAtual}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
