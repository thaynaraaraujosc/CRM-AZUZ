"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Tipo de mídia do arquivo — usado pra filtrar o que aparece no seletor de cada bloco (enviar
 * documento só oferece "documento", enviar imagem só "imagem", etc). */
export type TipoMidiaArquivo = "documento" | "imagem" | "video" | "audio";

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
  /** Ausente = "documento", pra não quebrar quem já usava essa biblioteca antes dela cobrir outras mídias. */
  tipoMidia?: TipoMidiaArquivo;
  descricao?: string;
  tags?: string[];
};

/** Categorias usadas em Conversas (documentos de atendimento em geral). */
export const CATEGORIAS_DOCUMENTO = [
  "Institucional",
  "Financeiro",
  "Contratos",
  "Exames e laudos",
  "Marketing",
] as const;

/** Categorias da biblioteca de arquivos reutilizável dos blocos de automação (item 7 da spec). */
export const CATEGORIAS_ARQUIVO_AUTOMACAO = [
  "Catálogos",
  "Propostas",
  "Contratos",
  "Tabelas",
  "Apresentações",
  "Materiais comerciais",
  "Outros",
] as const;

type BibliotecaDocumentosContextValue = {
  documentos: DocumentoBiblioteca[];
  adicionarDocumento: (
    doc: Omit<DocumentoBiblioteca, "id" | "atualizadoEm">,
  ) => DocumentoBiblioteca;
  atualizarDocumento: (id: string, patch: Partial<Omit<DocumentoBiblioteca, "id">>) => void;
  removerDocumento: (id: string) => void;
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
    tipoMidia: "documento",
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
    tipoMidia: "documento",
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
    tipoMidia: "documento",
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
    tipoMidia: "documento",
  },
  // ---- Biblioteca de arquivos reutilizável nos blocos de automação (itens 7-9 da spec) ----
  {
    id: "arq-catalogo-toldos",
    nome: "Catálogo de Toldos 2026.pdf",
    categoria: "Catálogos",
    formato: "PDF",
    tamanho: 4_200_000,
    atualizadoEm: "2026-07-10",
    autor: "Ana Ferreira",
    url: svgPlaceholder("Catálogo de Toldos", "#2e6bff"),
    tipoMidia: "documento",
    descricao: "Catálogo completo com todos os modelos de toldos disponíveis.",
    tags: ["toldos", "catálogo", "modelos"],
  },
  {
    id: "arq-tabela-modelos",
    nome: "Tabela de Modelos.pdf",
    categoria: "Tabelas",
    formato: "PDF",
    tamanho: 980_000,
    atualizadoEm: "2026-07-12",
    autor: "Bruno Salles",
    url: svgPlaceholder("Tabela de Modelos", "#0f9d63"),
    tipoMidia: "documento",
    descricao: "Comparativo de modelos, medidas e preços.",
    tags: ["tabela", "preços", "modelos"],
  },
  {
    id: "arq-apresentacao-comercial",
    nome: "Apresentação Comercial.pdf",
    categoria: "Apresentações",
    formato: "PDF",
    tamanho: 2_100_000,
    atualizadoEm: "2026-06-28",
    autor: "Carla Mendes",
    url: svgPlaceholder("Apresentação Comercial", "#8a3ffc"),
    tipoMidia: "documento",
    descricao: "Apresentação institucional pra usar em atendimento comercial.",
    tags: ["apresentação", "comercial"],
  },
  {
    id: "arq-guia-medidas",
    nome: "Guia de Medidas.pdf",
    categoria: "Materiais comerciais",
    formato: "PDF",
    tamanho: 610_000,
    atualizadoEm: "2026-07-20",
    autor: "Ana Ferreira",
    url: svgPlaceholder("Guia de Medidas", "#c9660a"),
    tipoMidia: "documento",
    descricao: "Passo a passo de como tirar medidas antes do orçamento.",
    tags: ["medidas", "orçamento", "guia"],
  },
  {
    id: "arq-foto-modelo-retratil",
    nome: "Toldo retrátil — foto modelo.jpg",
    categoria: "Materiais comerciais",
    formato: "JPG",
    tamanho: 1_800_000,
    atualizadoEm: "2026-07-05",
    autor: "Carla Mendes",
    url: svgPlaceholder("Toldo retrátil", "#0f9d63"),
    tipoMidia: "imagem",
    descricao: "Foto de referência do modelo retrátil instalado.",
    tags: ["toldos", "foto", "retrátil"],
  },
  {
    id: "arq-video-instalacao",
    nome: "Vídeo — como funciona a instalação.mp4",
    categoria: "Materiais comerciais",
    formato: "MP4",
    tamanho: 8_400_000,
    atualizadoEm: "2026-06-15",
    autor: "Bruno Salles",
    url: svgPlaceholder("Vídeo instalação", "#d8a400"),
    tipoMidia: "video",
    descricao: "Vídeo curto mostrando o processo de instalação.",
    tags: ["instalação", "vídeo"],
  },
  {
    id: "arq-audio-saudacao",
    nome: "Áudio — saudação padrão.mp3",
    categoria: "Materiais comerciais",
    formato: "MP3",
    tamanho: 420_000,
    atualizadoEm: "2026-07-01",
    autor: "Ana Ferreira",
    url: svgPlaceholder("Áudio saudação", "#d64545"),
    tipoMidia: "audio",
    descricao: "Áudio gravado de boas-vindas pra usar em atendimentos.",
    tags: ["áudio", "saudação"],
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

  function atualizarDocumento(id: string, patch: Partial<Omit<DocumentoBiblioteca, "id">>) {
    setDocumentos((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch, atualizadoEm: new Date().toISOString().slice(0, 10) } : d)),
    );
  }

  function removerDocumento(id: string) {
    setDocumentos((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <BibliotecaDocumentosContext.Provider
      value={{ documentos, adicionarDocumento, atualizarDocumento, removerDocumento }}
    >
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
