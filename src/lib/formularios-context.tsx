"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type TipoPerguntaFormulario =
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

export const TIPOS_PERGUNTA_FORMULARIO: {
  tipo: TipoPerguntaFormulario;
  label: string;
  grupo: string;
}[] = [
  { tipo: "texto_curto", label: "Texto curto", grupo: "Campos" },
  { tipo: "texto_longo", label: "Texto longo", grupo: "Campos" },
  { tipo: "data", label: "Datas", grupo: "Campos" },
  { tipo: "opcao_unica", label: "Opção única", grupo: "Campos" },
  { tipo: "multipla_escolha", label: "Múltipla escolha", grupo: "Campos" },
  { tipo: "numero", label: "Número", grupo: "Campos" },
  { tipo: "upload", label: "Uploads", grupo: "Campos" },
  { tipo: "contato_email", label: "E-mail", grupo: "Informações de contato" },
  {
    tipo: "contato_telefone",
    label: "Telefone",
    grupo: "Informações de contato",
  },
  { tipo: "contato_site", label: "Site", grupo: "Informações de contato" },
  {
    tipo: "contato_localizacao",
    label: "Localização",
    grupo: "Informações de contato",
  },
];

export function labelTipoPergunta(tipo: TipoPerguntaFormulario) {
  return TIPOS_PERGUNTA_FORMULARIO.find((t) => t.tipo === tipo)?.label ?? tipo;
}

export const CORES_FUNDO_FORMULARIO = [
  "#ffffff",
  "#eef2ff",
  "#e6f7ee",
  "#fff8e1",
  "#fdeaea",
  "#f3e8ff",
];

export const CORES_BOTAO_FORMULARIO = [
  "#0b1533",
  "#2e6bff",
  "#0f9d63",
  "#c9660a",
  "#d81b60",
  "#8a3ffc",
];

export type PerguntaFormulario = {
  id: string;
  tipo: TipoPerguntaFormulario;
  rotulo: string;
  obrigatoria: boolean;
  dica?: string;
  opcoes?: string[];
};

export type Formulario = {
  id: string;
  nome: string;
  descricao: string;
  perguntas: PerguntaFormulario[];
  rotuloBotao: string;
  urlRedirecionamento: string;
  corFundo: string;
  corBotao: string;
  senha: string;
};

export type RespostaFormulario = {
  id: string;
  formularioId: string;
  criadoEm: string;
  valores: Record<string, string>;
};

type FormulariosContextValue = {
  formularios: Formulario[];
  criarFormulario: () => string;
  atualizarFormulario: (id: string, patch: Partial<Formulario>) => void;
  excluirFormulario: (id: string) => void;
  adicionarPergunta: (formularioId: string, tipo: TipoPerguntaFormulario) => string;
  atualizarPergunta: (
    formularioId: string,
    perguntaId: string,
    patch: Partial<PerguntaFormulario>,
  ) => void;
  removerPergunta: (formularioId: string, perguntaId: string) => void;
  registrarResposta: (
    formularioId: string,
    valores: Record<string, string>,
  ) => void;
  respostasDoFormulario: (formularioId: string) => RespostaFormulario[];
};

const FormulariosContext = createContext<FormulariosContextValue | null>(null);

/**
 * Chave usada tanto aqui quanto na página pública de pré-visualização
 * (`/formulario-preview`) — essa página abre numa aba nova, sem acesso ao
 * Context do React, então lê o rascunho mais recente direto do localStorage.
 */
export const FORMULARIOS_STORAGE_KEY = "azuz-crm-formularios";

const FORMULARIOS_INICIAIS: Formulario[] = [
  {
    id: "form-triagem",
    nome: "Triagem de novo paciente",
    descricao: "Leva menos de 2 minutos — nos ajuda a te atender melhor.",
    perguntas: [
      {
        id: "pergunta-nome",
        tipo: "texto_curto",
        rotulo: "Nome completo",
        obrigatoria: true,
        dica: "Use o nome como está no seu documento.",
      },
      {
        id: "pergunta-email",
        tipo: "contato_email",
        rotulo: "E-mail",
        obrigatoria: true,
      },
      {
        id: "pergunta-telefone",
        tipo: "contato_telefone",
        rotulo: "Telefone / WhatsApp",
        obrigatoria: true,
      },
      {
        id: "pergunta-motivo",
        tipo: "opcao_unica",
        rotulo: "O que você procura?",
        obrigatoria: false,
        opcoes: ["Emagrecimento", "Controle de diabetes", "Avaliação geral"],
      },
    ],
    rotuloBotao: "Enviar",
    urlRedirecionamento: "",
    corFundo: "#ffffff",
    corBotao: "#2e6bff",
    senha: "vitta2026",
  },
];

/**
 * Formulários viram contatos do CRM quando alguém responde — por isso as
 * respostas registradas aqui são usadas por quem chama `registrarResposta`
 * (a própria página) pra também chamar `criarContato` do ContatosProvider.
 */
export function FormulariosProvider({ children }: { children: ReactNode }) {
  const [formularios, setFormularios] = useState<Formulario[]>(() => {
    if (typeof window === "undefined") return FORMULARIOS_INICIAIS;
    try {
      const salvos = localStorage.getItem(FORMULARIOS_STORAGE_KEY);
      return salvos ? JSON.parse(salvos) : FORMULARIOS_INICIAIS;
    } catch {
      return FORMULARIOS_INICIAIS;
    }
  });
  const [respostas, setRespostas] = useState<RespostaFormulario[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(FORMULARIOS_STORAGE_KEY, JSON.stringify(formularios));
    } catch {
      // localStorage indisponível (modo privado, por exemplo) — segue só em memória.
    }
  }, [formularios]);

  function criarFormulario() {
    const id = `form-${Date.now()}`;
    setFormularios((prev) => [
      ...prev,
      {
        id,
        nome: "Formulário sem título",
        descricao: "",
        perguntas: [],
        rotuloBotao: "Enviar",
        urlRedirecionamento: "",
        corFundo: "#ffffff",
        corBotao: "#2e6bff",
        senha: "",
      },
    ]);
    return id;
  }

  function atualizarFormulario(id: string, patch: Partial<Formulario>) {
    setFormularios((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  function excluirFormulario(id: string) {
    setFormularios((prev) => prev.filter((f) => f.id !== id));
    setRespostas((prev) => prev.filter((r) => r.formularioId !== id));
  }

  function adicionarPergunta(formularioId: string, tipo: TipoPerguntaFormulario) {
    const id = `pergunta-${Date.now()}`;
    setFormularios((prev) =>
      prev.map((f) => {
        if (f.id !== formularioId) return f;
        const nova: PerguntaFormulario = {
          id,
          tipo,
          rotulo: labelTipoPergunta(tipo),
          obrigatoria: false,
          opcoes:
            tipo === "opcao_unica" || tipo === "multipla_escolha"
              ? ["Opção 1", "Opção 2"]
              : undefined,
        };
        return { ...f, perguntas: [...f.perguntas, nova] };
      }),
    );
    return id;
  }

  function atualizarPergunta(
    formularioId: string,
    perguntaId: string,
    patch: Partial<PerguntaFormulario>,
  ) {
    setFormularios((prev) =>
      prev.map((f) =>
        f.id !== formularioId
          ? f
          : {
              ...f,
              perguntas: f.perguntas.map((p) =>
                p.id === perguntaId ? { ...p, ...patch } : p,
              ),
            },
      ),
    );
  }

  function removerPergunta(formularioId: string, perguntaId: string) {
    setFormularios((prev) =>
      prev.map((f) =>
        f.id !== formularioId
          ? f
          : { ...f, perguntas: f.perguntas.filter((p) => p.id !== perguntaId) },
      ),
    );
  }

  function registrarResposta(
    formularioId: string,
    valores: Record<string, string>,
  ) {
    setRespostas((prev) => [
      ...prev,
      { id: `resposta-${Date.now()}`, formularioId, criadoEm: "agora", valores },
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
        atualizarFormulario,
        excluirFormulario,
        adicionarPergunta,
        atualizarPergunta,
        removerPergunta,
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
