"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type DocumentoBiblioteca = {
  id: string;
  nome: string;
  categoria: string;
  formato: string;
  tamanho: number;
  /** ISO — última alteração. */
  atualizadoEm: string;
  autor: string;
  /** Data URL do conteúdo real do arquivo — o mesmo que é anexado na conversa. */
  url: string;
};

export const CATEGORIAS_DOCUMENTO = [
  "Institucional",
  "Financeiro",
  "Contratos",
  "Exames e laudos",
  "Marketing",
] as const;

type BibliotecaDocumentosContextValue = {
  documentos: DocumentoBiblioteca[];
  adicionarDocumento: (
    doc: Omit<DocumentoBiblioteca, "id" | "atualizadoEm">,
  ) => DocumentoBiblioteca;
};

const BibliotecaDocumentosContext =
  createContext<BibliotecaDocumentosContextValue | null>(null);

/** Um SVG mínimo em data URL — só pra biblioteca ter algo "real" pra pré-visualizar/baixar sem precisar de arquivos binários versionados. */
function svgPlaceholder(texto: string, cor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${cor}"/><text x="50%" y="50%" font-family="sans-serif" font-size="28" fill="white" text-anchor="middle">${texto}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DOCUMENTOS_INICIAIS: DocumentoBiblioteca[] = [
  {
    id: "doc-apresentacao",
    nome: "Apresentação da Clínica Vitta.pdf",
    categoria: "Institucional",
    formato: "PDF",
    tamanho: 842_000,
    atualizadoEm: "2026-07-18",
    autor: "Ana Ferreira",
    url: svgPlaceholder("Apresentação Vitta", "#2e6bff"),
  },
  {
    id: "doc-tabela-precos",
    nome: "Tabela de preços — pacotes.pdf",
    categoria: "Financeiro",
    formato: "PDF",
    tamanho: 231_000,
    atualizadoEm: "2026-07-22",
    autor: "Bruno Salles",
    url: svgPlaceholder("Tabela de preços", "#0f9d63"),
  },
  {
    id: "doc-contrato-padrao",
    nome: "Contrato de adesão — modelo.pdf",
    categoria: "Contratos",
    formato: "PDF",
    tamanho: 156_000,
    atualizadoEm: "2026-06-30",
    autor: "Ana Ferreira",
    url: svgPlaceholder("Contrato padrão", "#8a3ffc"),
  },
  {
    id: "doc-guia-emagrecimento",
    nome: "Guia — primeiros passos no tratamento.pdf",
    categoria: "Marketing",
    formato: "PDF",
    tamanho: 1_240_000,
    atualizadoEm: "2026-07-27",
    autor: "Dr. Hélio Marinho",
    url: svgPlaceholder("Guia do tratamento", "#c9660a"),
  },
];

export function BibliotecaDocumentosProvider({ children }: { children: ReactNode }) {
  const [documentos, setDocumentos] = useState<DocumentoBiblioteca[]>(
    DOCUMENTOS_INICIAIS,
  );

  function adicionarDocumento(doc: Omit<DocumentoBiblioteca, "id" | "atualizadoEm">) {
    const novo: DocumentoBiblioteca = {
      ...doc,
      id: `doc-${Date.now()}`,
      atualizadoEm: new Date().toISOString().slice(0, 10),
    };
    setDocumentos((prev) => [novo, ...prev]);
    return novo;
  }

  return (
    <BibliotecaDocumentosContext.Provider value={{ documentos, adicionarDocumento }}>
      {children}
    </BibliotecaDocumentosContext.Provider>
  );
}

export function useBibliotecaDocumentos() {
  const ctx = useContext(BibliotecaDocumentosContext);
  if (!ctx) {
    throw new Error(
      "useBibliotecaDocumentos precisa estar dentro de BibliotecaDocumentosProvider",
    );
  }
  return ctx;
}
