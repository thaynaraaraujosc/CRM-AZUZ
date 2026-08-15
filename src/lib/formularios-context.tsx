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
  | "porcentagem"
  | "telefone"
  | "email"
  | "cpf"
  | "cnpj"
  | "url"
  | "senha"
  // data
  | "data"
  | "hora"
  | "data_hora"
  | "periodo"
  // escolha
  | "lista_suspensa"
  | "opcao_unica"
  | "checkbox"
  | "multipla_escolha"
  | "tags"
  | "sim_nao"
  | "avaliacao"
  | "nota"
  // upload (visual apenas — sem storage real, front-end apenas)
  | "arquivo"
  | "documento"
  | "imagem"
  | "video"
  | "audio"
  | "assinatura"
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
  { tipo: "porcentagem", label: "Porcentagem", categoria: "texto" },
  { tipo: "telefone", label: "Telefone", categoria: "texto" },
  { tipo: "email", label: "E-mail", categoria: "texto" },
  { tipo: "cpf", label: "CPF", categoria: "texto" },
  { tipo: "cnpj", label: "CNPJ", categoria: "texto" },
  { tipo: "url", label: "URL", categoria: "texto" },
  { tipo: "senha", label: "Senha", categoria: "texto" },
  { tipo: "data", label: "Data", categoria: "data" },
  { tipo: "hora", label: "Hora", categoria: "data" },
  { tipo: "data_hora", label: "Data e hora", categoria: "data" },
  { tipo: "periodo", label: "Período", categoria: "data" },
  { tipo: "lista_suspensa", label: "Lista suspensa", categoria: "escolha" },
  { tipo: "opcao_unica", label: "Múltipla escolha (uma opção)", categoria: "escolha" },
  { tipo: "checkbox", label: "Caixas de seleção", categoria: "escolha" },
  { tipo: "multipla_escolha", label: "Múltipla escolha (várias opções)", categoria: "escolha" },
  { tipo: "tags", label: "Tags", categoria: "escolha" },
  { tipo: "sim_nao", label: "Sim / Não", categoria: "escolha" },
  { tipo: "avaliacao", label: "Avaliação (estrelas)", categoria: "escolha" },
  { tipo: "nota", label: "Nota (0 a 10)", categoria: "escolha" },
  { tipo: "arquivo", label: "Arquivo", categoria: "upload" },
  { tipo: "documento", label: "Documento", categoria: "upload" },
  { tipo: "imagem", label: "Imagem", categoria: "upload" },
  { tipo: "video", label: "Vídeo", categoria: "upload" },
  { tipo: "audio", label: "Áudio", categoria: "upload" },
  { tipo: "assinatura", label: "Assinatura", categoria: "upload" },
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

/** Tipos de upload de arquivo — guardam a resposta como "nomeDoArquivo|data:...;base64,..." (ver
 * `campo-resposta.tsx`), não texto puro. Assinatura fica de fora: já é só a imagem em data URL,
 * sem nome de arquivo pra separar. */
export const TIPOS_UPLOAD: TipoCampoFormulario[] = ["arquivo", "documento", "imagem", "video", "audio"];

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
  /** Padrão de máscara (ex.: "999.999.999-99") — "9" vira dígito digitado, o resto é literal e é
   * inserido automaticamente enquanto a pessoa digita. Só faz sentido pra campos de texto/número. */
  mascara?: string;
  /** Regex adicional que o valor precisa bater pra ser aceito no envio (além de obrigatório/min/max). */
  regex?: string;
  largura: "total" | "metade";
  /** Campo do Contato que essa resposta preenche de verdade — undefined = campo novo, não mapeado. */
  mapeamentoCrm?: string;
  logica?: LogicaCampo;
  /** Aparência individual — sem valor definido, cada propriedade cai no visual padrão do tema do formulário. */
  estilo?: {
    corFundo?: string;
    corBorda?: string;
    corTexto?: string;
    raioBorda?: number;
    margemSuperior?: number;
    margemInferior?: number;
  };
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

/** Fotografia do conteúdo do formulário no momento em que foi publicado — permite voltar pra uma
 * versão anterior sem precisar reconstruir tudo manualmente. Não existe backend/cron aqui: a
 * fotografia é tirada só quando `alternarPublicacao` liga o status pra "publicado". */
export type VersaoFormulario = {
  id: string;
  numero: number;
  criadoEm: string;
  paginas: PaginaFormulario[];
  tema: TemaFormulario;
  paginaFinal: { mensagem: string; urlRedirecionamento?: string; redirecionarAutomaticamente: boolean };
};

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
  /** Quando preenchido, cada resposta pública vira automaticamente um negócio no funil/etapa
   * escolhidos e dispara o evento "formulario_preenchido" pras automações — ver `/formulario-preview`. */
  integracoes?: {
    funilId?: string;
    etapaTitulo?: string;
    responsavelPadrao?: string;
  };
  /** Histórico de fotografias tiradas a cada publicação — mais recente por último. */
  versoes: VersaoFormulario[];
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
    integracoes: {},
    versoes: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/** Exportado só pra `prisma/seed.ts` semear a tabela — o Provider agora busca da API. */
export const FORMULARIOS_INICIAIS: Formulario[] = [
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
      integracoes: { ...base.integracoes, ...(f.integracoes as Formulario["integracoes"] | undefined) },
      versoes: Array.isArray(f.versoes) ? (f.versoes as VersaoFormulario[]) : [],
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
    integracoes: {},
    versoes: [],
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
  restaurarVersaoFormulario: (formularioId: string, versaoId: string) => void;

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
 * Banco real (ver src/app/api/formularios/) — páginas/perguntas/tema/versões ficam como Json na
 * própria linha do formulário porque os mutadores sempre recalculam o array inteiro e substituem via
 * `tocar()`, o helper central que agora também sincroniza com a API a cada chamada.
 */
function criarRemoto(formulario: Formulario) {
  fetch("/api/formularios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formulario),
  }).catch((erro) => console.error("Falha ao criar formulário na API:", erro));
}

/**
 * Formulários viram contatos do CRM quando alguém responde — por isso as respostas registradas
 * aqui são usadas por quem chama `registrarResposta` (a própria página pública) pra também
 * atualizar o contato certo via `mapeamentoCrm` de cada pergunta.
 */
export function FormulariosProvider({ children }: { children: ReactNode }) {
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [respostas, setRespostas] = useState<RespostaFormulario[]>([]);

  useEffect(() => {
    fetch("/api/formularios")
      .then((r) => r.json())
      .then((dados: unknown[]) => setFormularios(dados.map(migrarFormulario)))
      .catch((erro) => console.error("Falha ao carregar formulários da API:", erro));
    fetch("/api/formularios/respostas")
      .then((r) => r.json())
      .then((dados: RespostaFormulario[]) => setRespostas(dados))
      .catch((erro) => console.error("Falha ao carregar respostas de formulário da API:", erro));
  }, []);

  function tocar(id: string, atualizar: (f: Formulario) => Formulario) {
    let atualizado: Formulario | undefined;
    setFormularios((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        atualizado = { ...atualizar(f), atualizadoEm: new Date().toISOString() };
        return atualizado;
      }),
    );
    if (atualizado) {
      fetch(`/api/formularios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(atualizado),
      }).catch((erro) => console.error("Falha ao atualizar formulário na API:", erro));
    }
  }

  function criarFormulario() {
    const novo = formularioNovo();
    setFormularios((prev) => [...prev, novo]);
    criarRemoto(novo);
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
    criarRemoto(copia);
    return copia.id;
  }

  function atualizarFormulario(id: string, patch: Partial<Formulario>) {
    tocar(id, (f) => ({ ...f, ...patch }));
  }

  function excluirFormulario(id: string) {
    setFormularios((prev) => prev.filter((f) => f.id !== id));
    setRespostas((prev) => prev.filter((r) => r.formularioId !== id));
    fetch(`/api/formularios/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao excluir formulário na API:", erro),
    );
  }

  function alternarPublicacao(id: string) {
    tocar(id, (f) => {
      if (f.status === "publicado") return { ...f, status: "rascunho" };
      const versao: VersaoFormulario = {
        id: idUnico("versao"),
        numero: (f.versoes.at(-1)?.numero ?? 0) + 1,
        criadoEm: new Date().toISOString(),
        paginas: f.paginas,
        tema: f.tema,
        paginaFinal: f.paginaFinal,
      };
      return { ...f, status: "publicado", versoes: [...f.versoes, versao] };
    });
  }

  /** Restaura o conteúdo (páginas/tema/mensagem final) de uma versão publicada anterior — o
   * formulário volta pra rascunho pra dar chance de revisar antes de publicar de novo. */
  function restaurarVersaoFormulario(formularioId: string, versaoId: string) {
    tocar(formularioId, (f) => {
      const versao = f.versoes.find((v) => v.id === versaoId);
      if (!versao) return f;
      return {
        ...f,
        status: "rascunho",
        paginas: versao.paginas,
        tema: versao.tema,
        paginaFinal: versao.paginaFinal,
      };
    });
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
    const provisoria: RespostaFormulario = {
      id: idUnico("resposta"),
      formularioId,
      criadoEm: new Date().toISOString(),
      valores,
    };
    setRespostas((prev) => [...prev, provisoria]);
    fetch(`/api/formularios/${formularioId}/respostas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valores }),
    })
      .then((r) => r.json())
      .then((salva: RespostaFormulario) => {
        setRespostas((prev) => prev.map((r) => (r.id === provisoria.id ? salva : r)));
      })
      .catch((erro) => console.error("Falha ao registrar resposta na API:", erro));
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

/**
 * Aplica uma máscara simples de dígito ("9" no padrão = próximo dígito digitado, qualquer outro
 * caractere do padrão é literal e entra sozinho) — mesma convenção usada por libs de máscara mais
 * conhecidas, suficiente pra CPF/CNPJ/telefone sem precisar de dependência nova. Ignora tudo que não
 * for dígito no valor digitado, então funciona bem tanto digitando quanto colando.
 */
export function aplicarMascara(valor: string, mascara: string): string {
  const digitos = valor.replace(/\D/g, "");
  let resultado = "";
  let indiceDigito = 0;
  for (let i = 0; i < mascara.length && indiceDigito < digitos.length; i++) {
    if (mascara[i] === "9") {
      resultado += digitos[indiceDigito];
      indiceDigito++;
    } else {
      resultado += mascara[i];
    }
  }
  return resultado;
}
