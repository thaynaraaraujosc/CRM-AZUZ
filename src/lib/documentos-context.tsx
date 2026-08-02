"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { currentUser } from "./data";

export type PaginaDoc = {
  id: string;
  conteudoHtml: string;
};

export type ComentarioDoc = {
  id: string;
  trecho: string;
  texto: string;
  autor: string;
  quando: string;
  resolvido: boolean;
  respostas: { autor: string; texto: string; quando: string }[];
};

export type VersaoDoc = {
  id: string;
  quando: string;
  autor: string;
  nome?: string;
  paginas: PaginaDoc[];
};

export type PermissaoAcesso = "visualizar" | "comentar" | "editar";

export type PessoaAcesso = { email: string; permissao: PermissaoAcesso };

export type TamanhoPapel = "A4" | "Carta" | "Ofício" | "Personalizado";
export type OrientacaoPapel = "retrato" | "paisagem";

export type ConfigPagina = {
  tamanho: TamanhoPapel;
  orientacao: OrientacaoPapel;
  margemMm: number;
  corFundo: string;
};

export type Documento = {
  id: string;
  titulo: string;
  favorito: boolean;
  criadoEm: string;
  atualizadoEm: string;
  autor: string;
  paginas: PaginaDoc[];
  config: ConfigPagina;
  pessoasAcesso: PessoaAcesso[];
  linkAtivo: boolean;
  linkPermissao: PermissaoAcesso;
  comentarios: ComentarioDoc[];
  versoes: VersaoDoc[];
  excluido: boolean;
};

export const CONFIG_PAGINA_PADRAO: ConfigPagina = {
  tamanho: "A4",
  orientacao: "retrato",
  margemMm: 20,
  corFundo: "#ffffff",
};

export type ModeloDocumento = {
  id: string;
  nome: string;
  descricao: string;
  conteudoHtml: string;
};

export const MODELOS_DOCUMENTO: ModeloDocumento[] = [
  { id: "em-branco", nome: "Documento em branco", descricao: "Comece do zero", conteudoHtml: "" },
  {
    id: "ata",
    nome: "Ata de reunião",
    descricao: "Registro formal de decisões",
    conteudoHtml:
      "<h2>Ata de reunião</h2><p><b>Data:</b> </p><p><b>Participantes:</b> </p><h3>Pauta</h3><p></p><h3>Decisões</h3><p></p>",
  },
  {
    id: "relatorio",
    nome: "Relatório",
    descricao: "Estrutura pronta pra relatar resultados",
    conteudoHtml:
      "<h2>Relatório</h2><h3>Resumo</h3><p></p><h3>Resultados</h3><p></p><h3>Próximos passos</h3><p></p>",
  },
  {
    id: "proposta",
    nome: "Proposta comercial",
    descricao: "Pra enviar pra um cliente",
    conteudoHtml:
      "<h2>Proposta comercial</h2><p><b>Cliente:</b> </p><h3>Escopo</h3><p></p><h3>Investimento</h3><p></p><h3>Condições</h3><p></p>",
  },
  {
    id: "contrato",
    nome: "Contrato",
    descricao: "Modelo base de contrato de prestação",
    conteudoHtml:
      "<h2>Contrato de prestação de serviços</h2><p><b>Contratante:</b> </p><p><b>Contratado:</b> </p><h3>Objeto</h3><p></p><h3>Cláusulas</h3><p></p>",
  },
  {
    id: "planejamento",
    nome: "Planejamento",
    descricao: "Organize metas e etapas",
    conteudoHtml: "<h2>Planejamento</h2><h3>Objetivo</h3><p></p><h3>Etapas</h3><p></p><h3>Prazo</h3><p></p>",
  },
  {
    id: "curriculo",
    nome: "Currículo",
    descricao: "Modelo simples de currículo",
    conteudoHtml:
      "<h2>Nome completo</h2><p>E-mail · Telefone</p><h3>Experiência</h3><p></p><h3>Formação</h3><p></p>",
  },
  {
    id: "carta",
    nome: "Carta",
    descricao: "Formato de carta formal",
    conteudoHtml: "<p>Data</p><p></p><p>Prezado(a),</p><p></p><p>Atenciosamente,</p>",
  },
  {
    id: "rascunho-email",
    nome: "Rascunho de e-mail",
    descricao: "Comece um e-mail mais longo por aqui",
    conteudoHtml: "<p>Assunto: </p><p></p><p>Olá,</p><p></p>",
  },
  {
    id: "pauta",
    nome: "Pauta de reunião",
    descricao: "Lista de tópicos a discutir",
    conteudoHtml: "<h2>Pauta de reunião</h2><h3>Tópicos</h3><p></p>",
  },
];

type DocumentosContextValue = {
  documentos: Documento[];
  criarDocumento: (titulo?: string, modeloId?: string) => string;
  excluirDocumento: (id: string) => void;
  restaurarDocumento: (id: string) => void;
  excluirPermanente: (id: string) => void;
  esvaziarLixeira: () => void;
  duplicarDocumento: (id: string) => string;
  renomearDocumento: (id: string, titulo: string) => void;
  favoritarDocumento: (id: string) => void;
  atualizarPaginas: (id: string, paginas: PaginaDoc[]) => void;
  adicionarPagina: (id: string) => void;
  removerPagina: (id: string, paginaId: string) => void;
  atualizarConfigPagina: (id: string, patch: Partial<ConfigPagina>) => void;
  adicionarComentario: (id: string, trecho: string, texto: string) => void;
  responderComentario: (id: string, comentarioId: string, texto: string) => void;
  resolverComentario: (id: string, comentarioId: string) => void;
  salvarVersao: (id: string, nome?: string) => void;
  restaurarVersao: (id: string, versaoId: string) => void;
  atualizarAcesso: (
    id: string,
    patch: Partial<Pick<Documento, "pessoasAcesso" | "linkAtivo" | "linkPermissao">>,
  ) => void;
};

const DocumentosContext = createContext<DocumentosContextValue | null>(null);

export const DOCUMENTOS_STORAGE_KEY = "azuz-crm-documentos";

function agora() {
  return new Date().toISOString();
}

function idUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Datas fixas (não `agora()`) — esse array é avaliado no carregamento do módulo, tanto no
 * servidor quanto no cliente, em instantes diferentes; usar `new Date()` aqui causaria
 * hydration mismatch (o texto da data renderizada no servidor não bateria com o do cliente).
 */
const DOCUMENTOS_INICIAIS: Documento[] = [
  {
    id: "doc-1",
    titulo: "Sem título",
    favorito: false,
    criadoEm: "2026-01-05T09:00:00.000Z",
    atualizadoEm: "2026-01-05T09:00:00.000Z",
    autor: currentUser.name,
    paginas: [{ id: "pagina-1", conteudoHtml: "" }],
    config: CONFIG_PAGINA_PADRAO,
    pessoasAcesso: [],
    linkAtivo: false,
    linkPermissao: "visualizar",
    comentarios: [],
    versoes: [],
    excluido: false,
  },
];

export function DocumentosProvider({ children }: { children: ReactNode }) {
  const [documentos, setDocumentos] = useState<Documento[]>(() => {
    if (typeof window === "undefined") return DOCUMENTOS_INICIAIS;
    try {
      const salvos = localStorage.getItem(DOCUMENTOS_STORAGE_KEY);
      return salvos ? (JSON.parse(salvos) as Documento[]) : DOCUMENTOS_INICIAIS;
    } catch {
      return DOCUMENTOS_INICIAIS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DOCUMENTOS_STORAGE_KEY, JSON.stringify(documentos));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [documentos]);

  function criarDocumento(titulo?: string, modeloId?: string) {
    const id = idUnico("doc");
    const modelo = MODELOS_DOCUMENTO.find((m) => m.id === modeloId);
    const novo: Documento = {
      id,
      titulo: titulo?.trim() || "Sem título",
      favorito: false,
      criadoEm: agora(),
      atualizadoEm: agora(),
      autor: currentUser.name,
      paginas: [{ id: idUnico("pagina"), conteudoHtml: modelo?.conteudoHtml ?? "" }],
      config: CONFIG_PAGINA_PADRAO,
      pessoasAcesso: [],
      linkAtivo: false,
      linkPermissao: "visualizar",
      comentarios: [],
      versoes: [],
      excluido: false,
    };
    setDocumentos((prev) => [novo, ...prev]);
    return id;
  }

  function atualizarDocumento(id: string, patch: Partial<Documento>) {
    setDocumentos((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch, atualizadoEm: agora() } : d)),
    );
  }

  function excluirDocumento(id: string) {
    atualizarDocumento(id, { excluido: true });
  }

  function restaurarDocumento(id: string) {
    atualizarDocumento(id, { excluido: false });
  }

  function excluirPermanente(id: string) {
    setDocumentos((prev) => prev.filter((d) => d.id !== id));
  }

  function esvaziarLixeira() {
    setDocumentos((prev) => prev.filter((d) => !d.excluido));
  }

  function duplicarDocumento(id: string) {
    const original = documentos.find((d) => d.id === id);
    const novoId = idUnico("doc");
    if (!original) return novoId;
    const copia: Documento = {
      ...original,
      id: novoId,
      titulo: `Cópia de ${original.titulo}`,
      criadoEm: agora(),
      atualizadoEm: agora(),
      comentarios: [],
      versoes: [],
      excluido: false,
    };
    setDocumentos((prev) => [copia, ...prev]);
    return novoId;
  }

  function renomearDocumento(id: string, titulo: string) {
    atualizarDocumento(id, { titulo: titulo.trim() || "Sem título" });
  }

  function favoritarDocumento(id: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, { favorito: !doc.favorito });
  }

  function atualizarPaginas(id: string, paginas: PaginaDoc[]) {
    atualizarDocumento(id, { paginas });
  }

  function adicionarPagina(id: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, {
      paginas: [...doc.paginas, { id: idUnico("pagina"), conteudoHtml: "" }],
    });
  }

  function removerPagina(id: string, paginaId: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc || doc.paginas.length <= 1) return;
    atualizarDocumento(id, { paginas: doc.paginas.filter((p) => p.id !== paginaId) });
  }

  function atualizarConfigPagina(id: string, patch: Partial<ConfigPagina>) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, { config: { ...doc.config, ...patch } });
  }

  function adicionarComentario(id: string, trecho: string, texto: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    const comentario: ComentarioDoc = {
      id: idUnico("comentario"),
      trecho,
      texto,
      autor: currentUser.name,
      quando: agora(),
      resolvido: false,
      respostas: [],
    };
    atualizarDocumento(id, { comentarios: [...doc.comentarios, comentario] });
  }

  function responderComentario(id: string, comentarioId: string, texto: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, {
      comentarios: doc.comentarios.map((c) =>
        c.id === comentarioId
          ? {
              ...c,
              respostas: [...c.respostas, { autor: currentUser.name, texto, quando: agora() }],
            }
          : c,
      ),
    });
  }

  function resolverComentario(id: string, comentarioId: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, {
      comentarios: doc.comentarios.map((c) =>
        c.id === comentarioId ? { ...c, resolvido: !c.resolvido } : c,
      ),
    });
  }

  function salvarVersao(id: string, nome?: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    const versao: VersaoDoc = {
      id: idUnico("versao"),
      quando: agora(),
      autor: currentUser.name,
      nome,
      paginas: doc.paginas,
    };
    atualizarDocumento(id, { versoes: [...doc.versoes, versao] });
  }

  function restaurarVersao(id: string, versaoId: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    const versao = doc.versoes.find((v) => v.id === versaoId);
    if (!versao) return;
    atualizarDocumento(id, { paginas: versao.paginas });
  }

  function atualizarAcesso(
    id: string,
    patch: Partial<Pick<Documento, "pessoasAcesso" | "linkAtivo" | "linkPermissao">>,
  ) {
    atualizarDocumento(id, patch);
  }

  return (
    <DocumentosContext.Provider
      value={{
        documentos,
        criarDocumento,
        excluirDocumento,
        restaurarDocumento,
        excluirPermanente,
        esvaziarLixeira,
        duplicarDocumento,
        renomearDocumento,
        favoritarDocumento,
        atualizarPaginas,
        adicionarPagina,
        removerPagina,
        atualizarConfigPagina,
        adicionarComentario,
        responderComentario,
        resolverComentario,
        salvarVersao,
        restaurarVersao,
        atualizarAcesso,
      }}
    >
      {children}
    </DocumentosContext.Provider>
  );
}

export function useDocumentos() {
  const ctx = useContext(DocumentosContext);
  if (!ctx) throw new Error("useDocumentos precisa estar dentro de DocumentosProvider");
  return ctx;
}
