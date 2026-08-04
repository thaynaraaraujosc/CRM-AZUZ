"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** Categorias do menu "Adicionar campo" — mesma organização usada no painel de configuração. */
export type CategoriaCampo = "texto" | "data" | "escolha" | "upload" | "pessoas" | "layout";

export type TipoCampoFormulario =
  // texto
  | "texto_curto"
  | "texto_longo"
  | "numero"
  | "moeda"
  | "telefone"
  | "email"
  | "cpf"
  | "cnpj"
  | "url"
  // data
  | "data"
  | "hora"
  | "data_hora"
  // escolha
  | "lista_suspensa"
  | "opcao_unica"
  | "checkbox"
  | "multipla_escolha"
  | "sim_nao"
  | "avaliacao"
  | "nota"
  // upload (visual apenas — sem storage real, front-end apenas)
  | "arquivo"
  | "imagem"
  // pessoas (via busca real no CRM)
  | "contato"
  | "responsavel"
  // layout (não captura resposta)
  | "titulo"
  | "texto_bloco"
  | "divisor"
  | "espacamento"
  | "imagem_bloco";

export const TIPOS_CAMPO_FORMULARIO: {
  tipo: TipoCampoFormulario;
  label: string;
  categoria: CategoriaCampo;
}[] = [
  { tipo: "texto_curto", label: "Texto curto", categoria: "texto" },
  { tipo: "texto_longo", label: "Texto longo", categoria: "texto" },
  { tipo: "numero", label: "Número", categoria: "texto" },
  { tipo: "moeda", label: "Moeda", categoria: "texto" },
  { tipo: "telefone", label: "Telefone", categoria: "texto" },
  { tipo: "email", label: "E-mail", categoria: "texto" },
  { tipo: "cpf", label: "CPF", categoria: "texto" },
  { tipo: "cnpj", label: "CNPJ", categoria: "texto" },
  { tipo: "url", label: "URL", categoria: "texto" },
  { tipo: "data", label: "Data", categoria: "data" },
  { tipo: "hora", label: "Hora", categoria: "data" },
  { tipo: "data_hora", label: "Data e hora", categoria: "data" },
  { tipo: "lista_suspensa", label: "Lista suspensa", categoria: "escolha" },
  { tipo: "opcao_unica", label: "Múltipla escolha (uma opção)", categoria: "escolha" },
  { tipo: "checkbox", label: "Caixas de seleção", categoria: "escolha" },
  { tipo: "multipla_escolha", label: "Múltipla escolha (várias opções)", categoria: "escolha" },
  { tipo: "sim_nao", label: "Sim / Não", categoria: "escolha" },
  { tipo: "avaliacao", label: "Avaliação (estrelas)", categoria: "escolha" },
  { tipo: "nota", label: "Nota (0 a 10)", categoria: "escolha" },
  { tipo: "arquivo", label: "Arquivo", categoria: "upload" },
  { tipo: "imagem", label: "Imagem", categoria: "upload" },
  { tipo: "contato", label: "Contato", categoria: "pessoas" },
  { tipo: "responsavel", label: "Responsável", categoria: "pessoas" },
  { tipo: "titulo", label: "Título", categoria: "layout" },
  { tipo: "texto_bloco", label: "Texto", categoria: "layout" },
  { tipo: "divisor", label: "Divisor", categoria: "layout" },
  { tipo: "espacamento", label: "Espaçamento", categoria: "layout" },
  { tipo: "imagem_bloco", label: "Imagem", categoria: "layout" },
];

export const CATEGORIAS_CAMPO: { categoria: CategoriaCampo; label: string }[] = [
  { categoria: "texto", label: "Textos" },
  { categoria: "data", label: "Datas" },
  { categoria: "escolha", label: "Escolhas" },
  { categoria: "upload", label: "Uploads" },
  { categoria: "pessoas", label: "Pessoas" },
  { categoria: "layout", label: "Layout" },
];

/** Tipos que não capturam resposta — são só blocos visuais no canvas. */
export const TIPOS_LAYOUT: TipoCampoFormulario[] = [
  "titulo",
  "texto_bloco",
  "divisor",
  "espacamento",
  "imagem_bloco",
];

export function labelTipoCampo(tipo: TipoCampoFormulario) {
  return TIPOS_CAMPO_FORMULARIO.find((t) => t.tipo === tipo)?.label ?? tipo;
}

export const CORES_TEMA_FORMULARIO = ["#2e6bff", "#0f9d63", "#c9660a", "#d81b60", "#8a3ffc", "#0b1533"];

/** Campos do Contato que uma pergunta pode ser mapeada — usado no seletor "Mapear para campo
 * existente" e na hora de criar/atualizar o contato de verdade ao registrar uma resposta. */
export const CAMPOS_CRM_MAPEAVEIS: { campo: string; label: string }[] = [
  { campo: "nome", label: "Nome" },
  { campo: "sobrenome", label: "Sobrenome" },
  { campo: "email", label: "E-mail" },
  { campo: "whatsapp", label: "Telefone / WhatsApp" },
  { campo: "empresa", label: "Empresa" },
  { campo: "cargo", label: "Cargo" },
  { campo: "cidade", label: "Cidade" },
  { campo: "estado", label: "Estado" },
  { campo: "pais", label: "País" },
  { campo: "endereco", label: "Endereço" },
];

export type OperadorLogica = "igual" | "diferente" | "contem" | "preenchido" | "vazio";

export const OPERADORES_LOGICA: { operador: OperadorLogica; label: string }[] = [
  { operador: "igual", label: "é igual a" },
  { operador: "diferente", label: "é diferente de" },
  { operador: "contem", label: "contém" },
  { operador: "preenchido", label: "foi preenchido" },
  { operador: "vazio", label: "está vazio" },
];

export type RegraLogica = {
  campoId: string;
  operador: OperadorLogica;
  valor?: string;
};

export type LogicaCampo = {
  modo: "mostrar_se" | "ocultar_se" | "obrigatorio_se";
  regras: RegraLogica[];
};

export type PerguntaFormulario = {
  id: string;
  tipo: TipoCampoFormulario;
  rotulo: string;
  descricao?: string;
  placeholder?: string;
  obrigatoria: boolean;
  oculta: boolean;
  somenteLeitura: boolean;
  valorPadrao?: string;
  textoAjuda?: string;
  /** lista_suspensa / opcao_unica / checkbox / multipla_escolha */
  opcoes?: string[];
  min?: number;
  max?: number;
  largura: "total" | "metade";
  /** Campo do Contato que essa resposta preenche de verdade — undefined = campo novo, não mapeado. */
  mapeamentoCrm?: string;
  logica?: LogicaCampo;
};

export type CondicaoPagina = {
  campoId: string;
  operador: OperadorLogica;
  valor?: string;
};

export type PaginaFormulario = {
  id: string;
  titulo: string;
  descricao?: string;
  perguntas: PerguntaFormulario[];
  /** Se definida, a página só é exibida quando a condição bate — avaliada contra respostas de páginas anteriores. */
  condicao?: CondicaoPagina;
};

export const MENSAGEM_FINAL_PADRAO = "Obrigado por você ter respondido o nosso formulário.";

export type TemaFormulario = {
  corPrincipal: string;
  corBotao: string;
  temaEscuro: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  imagemFundoUrl?: string;
  layout: "coluna-unica" | "duas-colunas";
  larguraFixa: boolean;
};

export type StatusFormulario = "rascunho" | "publicado";

export type Formulario = {
  id: string;
  nome: string;
  descricao: string;
  status: StatusFormulario;
  paginas: PaginaFormulario[];
  paginaFinal: {
    mensagem: string;
    urlRedirecionamento?: string;
    redirecionarAutomaticamente: boolean;
  };
  tema: TemaFormulario;
  senha?: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type RespostaFormulario = {
  id: string;
  formularioId: string;
  criadoEm: string;
  valores: Record<string, string>;
};

function idUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function temaVazio(): TemaFormulario {
  return {
    corPrincipal: "#ffffff",
    corBotao: "#2e6bff",
    temaEscuro: false,
    layout: "coluna-unica",
    larguraFixa: true,
  };
}

function perguntaVazia(tipo: TipoCampoFormulario): PerguntaFormulario {
  const comOpcoes = tipo === "lista_suspensa" || tipo === "opcao_unica" || tipo === "checkbox" || tipo === "multipla_escolha";
  return {
    id: idUnico("campo"),
    tipo,
    rotulo: labelTipoCampo(tipo),
    obrigatoria: false,
    oculta: false,
    somenteLeitura: false,
    largura: "total",
    opcoes: comOpcoes ? ["Opção 1", "Opção 2"] : undefined,
  };
}

function paginaVazia(titulo: string): PaginaFormulario {
  return { id: idUnico("pagina"), titulo, perguntas: [] };
}

function formularioNovo(): Formulario {
  const agora = new Date().toISOString();
  return {
    id: idUnico("form"),
    nome: "Formulário sem título",
    descricao: "",
    status: "rascunho",
    paginas: [paginaVazia("Página 1")],
    paginaFinal: { mensagem: MENSAGEM_FINAL_PADRAO, redirecionarAutomaticamente: false },
    tema: temaVazio(),
    senha: "",
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

const FORMULARIOS_INICIAIS: Formulario[] = [
  (() => {
    const base = formularioNovo();
    return {
      ...base,
      id: "form-triagem",
      nome: "Triagem de novo paciente",
      descricao: "Leva menos de 2 minutos — nos ajuda a te atender melhor.",
      status: "publicado" as StatusFormulario,
      senha: "vitta2026",
      paginas: [
        {
          id: "pagina-triagem-1",
          titulo: "Seus dados",
          perguntas: [
            {
              id: "pergunta-nome",
              tipo: "texto_curto",
              rotulo: "Nome completo",
              obrigatoria: true,
              oculta: false,
              somenteLeitura: false,
              largura: "total",
              textoAjuda: "Use o nome como está no seu documento.",
              mapeamentoCrm: "nome",
            },
            {
              id: "pergunta-email",
              tipo: "email",
              rotulo: "E-mail",
              obrigatoria: true,
              oculta: false,
              somenteLeitura: false,
              largura: "metade",
              mapeamentoCrm: "email",
            },
            {
              id: "pergunta-telefone",
              tipo: "telefone",
              rotulo: "Telefone / WhatsApp",
              obrigatoria: true,
              oculta: false,
              somenteLeitura: false,
              largura: "metade",
              mapeamentoCrm: "whatsapp",
            },
            {
              id: "pergunta-motivo",
              tipo: "opcao_unica",
              rotulo: "O que você procura?",
              obrigatoria: false,
              oculta: false,
              somenteLeitura: false,
              largura: "total",
              opcoes: ["Emagrecimento", "Controle de diabetes", "Avaliação geral"],
            },
          ],
        },
      ],
    };
  })(),
];

type LegadoPerguntaTipo =
  | "texto_curto"
  | "texto_longo"
  | "data"
  | "opcao_unica"
  | "multipla_escolha"
  | "numero"
  | "upload"
  | "contato_email"
  | "contato_telefone"
  | "contato_site"
  | "contato_localizacao";

const MAPA_TIPO_LEGADO: Record<LegadoPerguntaTipo, TipoCampoFormulario> = {
  texto_curto: "texto_curto",
  texto_longo: "texto_longo",
  data: "data",
  opcao_unica: "opcao_unica",
  multipla_escolha: "multipla_escolha",
  numero: "numero",
  upload: "arquivo",
  contato_email: "email",
  contato_telefone: "telefone",
  contato_site: "url",
  contato_localizacao: "texto_curto",
};

/**
 * Formulários salvos com o schema antigo (lista plana `perguntas`, sem `paginas`/`status`/`tema`)
 * viram uma única página, preservando o que o usuário já tinha criado em vez de resetar tudo —
 * mesmo espírito de `lerPrefVer` em Documentos, mas pra uma migração de shape inteira.
 */
export function migrarFormulario(bruto: unknown): Formulario {
  const f = bruto as Record<string, unknown>;
  if (Array.isArray(f.paginas)) {
    const base = formularioNovo();
    return {
      ...base,
      ...(f as unknown as Formulario),
      tema: { ...base.tema, ...(f.tema as Partial<TemaFormulario> | undefined) },
      paginaFinal: { ...base.paginaFinal, ...(f.paginaFinal as Partial<Formulario["paginaFinal"]> | undefined) },
    };
  }
  // Formato legado: perguntas num array plano, cores soltas, sem status/tema/paginas.
  const perguntasLegadas = (f.perguntas as { id: string; tipo: LegadoPerguntaTipo; rotulo: string; obrigatoria: boolean; dica?: string; opcoes?: string[] }[]) ?? [];
  const perguntas: PerguntaFormulario[] = perguntasLegadas.map((p) => ({
    id: p.id,
    tipo: MAPA_TIPO_LEGADO[p.tipo] ?? "texto_curto",
    rotulo: p.rotulo,
    obrigatoria: p.obrigatoria,
    oculta: false,
    somenteLeitura: false,
    largura: "total",
    textoAjuda: p.dica,
    opcoes: p.opcoes,
  }));
  const agora = new Date().toISOString();
  return {
    id: (f.id as string) ?? idUnico("form"),
    nome: (f.nome as string) ?? "Formulário sem título",
    descricao: (f.descricao as string) ?? "",
    status: "rascunho",
    paginas: [{ id: idUnico("pagina"), titulo: "Página 1", perguntas }],
    paginaFinal: {
      mensagem: (f.mensagemFinal as string) ?? MENSAGEM_FINAL_PADRAO,
      urlRedirecionamento: (f.urlRedirecionamento as string) || undefined,
      redirecionarAutomaticamente: false,
    },
    tema: {
      ...temaVazio(),
      corPrincipal: (f.corFundo as string) ?? "#ffffff",
      corBotao: (f.corBotao as string) ?? "#2e6bff",
    },
    senha: (f.senha as string) ?? "",
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

type FormulariosContextValue = {
  formularios: Formulario[];
  criarFormulario: () => string;
  duplicarFormulario: (id: string) => string;
  atualizarFormulario: (id: string, patch: Partial<Formulario>) => void;
  excluirFormulario: (id: string) => void;
  alternarPublicacao: (id: string) => void;

  adicionarPagina: (formularioId: string) => string;
  duplicarPagina: (formularioId: string, paginaId: string) => string;
  atualizarPagina: (formularioId: string, paginaId: string, patch: Partial<PaginaFormulario>) => void;
  excluirPagina: (formularioId: string, paginaId: string) => void;
  reordenarPagina: (formularioId: string, origemIndice: number, destinoIndice: number) => void;

  adicionarPergunta: (formularioId: string, paginaId: string, tipo: TipoCampoFormulario) => string;
  duplicarPergunta: (formularioId: string, paginaId: string, perguntaId: string) => string;
  atualizarPergunta: (
    formularioId: string,
    paginaId: string,
    perguntaId: string,
    patch: Partial<PerguntaFormulario>,
  ) => void;
  removerPergunta: (formularioId: string, paginaId: string, perguntaId: string) => void;
  reordenarPergunta: (formularioId: string, paginaId: string, origemIndice: number, destinoIndice: number) => void;

  registrarResposta: (formularioId: string, valores: Record<string, string>) => void;
  respostasDoFormulario: (formularioId: string) => RespostaFormulario[];
};

const FormulariosContext = createContext<FormulariosContextValue | null>(null);

/**
 * Chave usada tanto aqui quanto na página pública (`/formulario-preview`) — essa página abre numa
 * aba nova, sem acesso ao Context do React, então lê/grava direto no localStorage.
 */
export const FORMULARIOS_STORAGE_KEY = "azuz-crm-formularios";
export const RESPOSTAS_STORAGE_KEY = "azuz-crm-formularios-respostas";

function lerFormulariosStorage(): Formulario[] {
  if (typeof window === "undefined") return FORMULARIOS_INICIAIS;
  try {
    const salvos = window.localStorage.getItem(FORMULARIOS_STORAGE_KEY);
    if (!salvos) return FORMULARIOS_INICIAIS;
    const lista = JSON.parse(salvos) as unknown[];
    return lista.map(migrarFormulario);
  } catch {
    return FORMULARIOS_INICIAIS;
  }
}

function lerRespostasStorage(): RespostaFormulario[] {
  if (typeof window === "undefined") return [];
  try {
    const salvas = window.localStorage.getItem(RESPOSTAS_STORAGE_KEY);
    return salvas ? (JSON.parse(salvas) as RespostaFormulario[]) : [];
  } catch {
    return [];
  }
}

/**
 * Formulários viram contatos do CRM quando alguém responde — por isso as respostas registradas
 * aqui são usadas por quem chama `registrarResposta` (a própria página pública) pra também
 * atualizar o contato certo via `mapeamentoCrm` de cada pergunta.
 */
export function FormulariosProvider({ children }: { children: ReactNode }) {
  const [formularios, setFormularios] = useState<Formulario[]>(lerFormulariosStorage);
  const [respostas, setRespostas] = useState<RespostaFormulario[]>(lerRespostasStorage);

  useEffect(() => {
    try {
      window.localStorage.setItem(FORMULARIOS_STORAGE_KEY, JSON.stringify(formularios));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [formularios]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RESPOSTAS_STORAGE_KEY, JSON.stringify(respostas));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [respostas]);

  // A resposta pública (aba separada, sem esse Provider) grava resposta/contato direto no
  // localStorage — sem isso, a aba do CRM só veria a resposta nova depois de recarregar a página.
  useEffect(() => {
    function aoMudarStorage(e: StorageEvent) {
      if (e.key === RESPOSTAS_STORAGE_KEY && e.newValue) {
        try {
          setRespostas(JSON.parse(e.newValue) as RespostaFormulario[]);
        } catch {
          // payload inválido — ignora.
        }
      }
    }
    window.addEventListener("storage", aoMudarStorage);
    return () => window.removeEventListener("storage", aoMudarStorage);
  }, []);

  function tocar(id: string, atualizar: (f: Formulario) => Formulario) {
    setFormularios((prev) =>
      prev.map((f) => (f.id === id ? { ...atualizar(f), atualizadoEm: new Date().toISOString() } : f)),
    );
  }

  function criarFormulario() {
    const novo = formularioNovo();
    setFormularios((prev) => [...prev, novo]);
    return novo.id;
  }

  function duplicarFormulario(id: string) {
    const original = formularios.find((f) => f.id === id);
    if (!original) return id;
    const agora = new Date().toISOString();
    const copia: Formulario = {
      ...original,
      id: idUnico("form"),
      nome: `${original.nome} (cópia)`,
      status: "rascunho",
      paginas: original.paginas.map((p) => ({
        ...p,
        id: idUnico("pagina"),
        perguntas: p.perguntas.map((q) => ({ ...q, id: idUnico("campo") })),
      })),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    setFormularios((prev) => [...prev, copia]);
    return copia.id;
  }

  function atualizarFormulario(id: string, patch: Partial<Formulario>) {
    tocar(id, (f) => ({ ...f, ...patch }));
  }

  function excluirFormulario(id: string) {
    setFormularios((prev) => prev.filter((f) => f.id !== id));
    setRespostas((prev) => prev.filter((r) => r.formularioId !== id));
  }

  function alternarPublicacao(id: string) {
    tocar(id, (f) => ({ ...f, status: f.status === "publicado" ? "rascunho" : "publicado" }));
  }

  function adicionarPagina(formularioId: string) {
    const nova = paginaVazia("");
    tocar(formularioId, (f) => {
      nova.titulo = `Página ${f.paginas.length + 1}`;
      return { ...f, paginas: [...f.paginas, nova] };
    });
    return nova.id;
  }

  function duplicarPagina(formularioId: string, paginaId: string) {
    let novoId = paginaId;
    tocar(formularioId, (f) => {
      const original = f.paginas.find((p) => p.id === paginaId);
      if (!original) return f;
      const copia: PaginaFormulario = {
        ...original,
        id: idUnico("pagina"),
        titulo: `${original.titulo} (cópia)`,
        perguntas: original.perguntas.map((q) => ({ ...q, id: idUnico("campo") })),
      };
      novoId = copia.id;
      const indice = f.paginas.findIndex((p) => p.id === paginaId);
      const paginas = [...f.paginas];
      paginas.splice(indice + 1, 0, copia);
      return { ...f, paginas };
    });
    return novoId;
  }

  function atualizarPagina(formularioId: string, paginaId: string, patch: Partial<PaginaFormulario>) {
    tocar(formularioId, (f) => ({
      ...f,
      paginas: f.paginas.map((p) => (p.id === paginaId ? { ...p, ...patch } : p)),
    }));
  }

  function excluirPagina(formularioId: string, paginaId: string) {
    tocar(formularioId, (f) =>
      f.paginas.length <= 1 ? f : { ...f, paginas: f.paginas.filter((p) => p.id !== paginaId) },
    );
  }

  function reordenarPagina(formularioId: string, origemIndice: number, destinoIndice: number) {
    tocar(formularioId, (f) => {
      const paginas = [...f.paginas];
      const [movida] = paginas.splice(origemIndice, 1);
      paginas.splice(destinoIndice, 0, movida);
      return { ...f, paginas };
    });
  }

  function adicionarPergunta(formularioId: string, paginaId: string, tipo: TipoCampoFormulario) {
    const nova = perguntaVazia(tipo);
    tocar(formularioId, (f) => ({
      ...f,
      paginas: f.paginas.map((p) => (p.id === paginaId ? { ...p, perguntas: [...p.perguntas, nova] } : p)),
    }));
    return nova.id;
  }

  function duplicarPergunta(formularioId: string, paginaId: string, perguntaId: string) {
    let novoId = perguntaId;
    tocar(formularioId, (f) => ({
      ...f,
      paginas: f.paginas.map((p) => {
        if (p.id !== paginaId) return p;
        const indice = p.perguntas.findIndex((q) => q.id === perguntaId);
        if (indice === -1) return p;
        const copia = { ...p.perguntas[indice], id: idUnico("campo") };
        novoId = copia.id;
        const perguntas = [...p.perguntas];
        perguntas.splice(indice + 1, 0, copia);
        return { ...p, perguntas };
      }),
    }));
    return novoId;
  }

  function atualizarPergunta(
    formularioId: string,
    paginaId: string,
    perguntaId: string,
    patch: Partial<PerguntaFormulario>,
  ) {
    tocar(formularioId, (f) => ({
      ...f,
      paginas: f.paginas.map((p) =>
        p.id !== paginaId
          ? p
          : { ...p, perguntas: p.perguntas.map((q) => (q.id === perguntaId ? { ...q, ...patch } : q)) },
      ),
    }));
  }

  function removerPergunta(formularioId: string, paginaId: string, perguntaId: string) {
    tocar(formularioId, (f) => ({
      ...f,
      paginas: f.paginas.map((p) =>
        p.id !== paginaId ? p : { ...p, perguntas: p.perguntas.filter((q) => q.id !== perguntaId) },
      ),
    }));
  }

  function reordenarPergunta(formularioId: string, paginaId: string, origemIndice: number, destinoIndice: number) {
    tocar(formularioId, (f) => ({
      ...f,
      paginas: f.paginas.map((p) => {
        if (p.id !== paginaId) return p;
        const perguntas = [...p.perguntas];
        const [movida] = perguntas.splice(origemIndice, 1);
        perguntas.splice(destinoIndice, 0, movida);
        return { ...p, perguntas };
      }),
    }));
  }

  function registrarResposta(formularioId: string, valores: Record<string, string>) {
    setRespostas((prev) => [
      ...prev,
      { id: idUnico("resposta"), formularioId, criadoEm: new Date().toISOString(), valores },
    ]);
  }

  function respostasDoFormulario(formularioId: string) {
    return respostas.filter((r) => r.formularioId === formularioId);
  }

  return (
    <FormulariosContext.Provider
      value={{
        formularios,
        criarFormulario,
        duplicarFormulario,
        atualizarFormulario,
        excluirFormulario,
        alternarPublicacao,
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
      }}
    >
      {children}
    </FormulariosContext.Provider>
  );
}

export function useFormularios() {
  const ctx = useContext(FormulariosContext);
  if (!ctx) {
    throw new Error("useFormularios precisa estar dentro de FormulariosProvider");
  }
  return ctx;
}

/**
 * Avalia uma condição de página/lógica de campo contra os valores já respondidos — usada tanto no
 * builder (pra listar campos disponíveis) quanto na página pública (pra decidir o que mostrar).
 */
export function condicaoBate(
  operador: OperadorLogica,
  valorCampo: string | undefined,
  valorComparacao: string | undefined,
): boolean {
  const v = (valorCampo ?? "").trim();
  switch (operador) {
    case "preenchido":
      return v.length > 0;
    case "vazio":
      return v.length === 0;
    case "igual":
      return v.toLowerCase() === (valorComparacao ?? "").trim().toLowerCase();
    case "diferente":
      return v.toLowerCase() !== (valorComparacao ?? "").trim().toLowerCase();
    case "contem":
      return v.toLowerCase().includes((valorComparacao ?? "").trim().toLowerCase());
    default:
      return true;
  }
}
