"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { automacoes as automacoesIniciais, funis as funisIniciais } from "@/lib/data";

export type Automacao = {
  id: string;
  titulo: string;
  gatilho: string;
  acoes: string[];
  mensagem: string;
  execucoes: string;
  ativa: boolean;
};

type AutomacoesContextValue = {
  automacoesPorFunil: Record<string, Automacao[]>;
  /** Cria a aba de automações (vazia) pra um funil novo. */
  criarAbaParaFunil: (funilId: string) => void;
  /** Apaga a aba (e as automações dela) quando o funil é excluído. */
  excluirAbaDoFunil: (funilId: string) => void;
  criarAutomacao: (
    funilId: string,
    dados: Omit<Automacao, "id" | "execucoes">,
  ) => void;
  atualizarAutomacao: (
    funilId: string,
    automacaoId: string,
    dados: Partial<Omit<Automacao, "id">>,
  ) => void;
  excluirAutomacao: (funilId: string, automacaoId: string) => void;
  alternarAtiva: (funilId: string, automacaoId: string) => void;
};

const AutomacoesContext = createContext<AutomacoesContextValue | null>(null);

function automacoesIniciaisConvertidas(): Automacao[] {
  return automacoesIniciais.map((a, i) => ({
    id: `auto-inicial-${i}`,
    titulo: a.titulo,
    gatilho: a.fluxo[0] ?? "",
    acoes: a.fluxo.slice(1),
    mensagem: "",
    execucoes: a.execucoes,
    ativa: a.ativa,
  }));
}

/**
 * Automações vivem agrupadas por funil (cada funil tem sua própria aba) —
 * mesmo motivo dos outros contextos: criar/apagar funil em /funil precisa
 * refletir aqui sem as telas ficarem dessincronizadas.
 */
export function AutomacoesProvider({ children }: { children: ReactNode }) {
  const [automacoesPorFunil, setAutomacoesPorFunil] = useState<
    Record<string, Automacao[]>
  >(() => ({
    [funisIniciais[0]?.id ?? ""]: automacoesIniciaisConvertidas(),
  }));

  function criarAbaParaFunil(funilId: string) {
    setAutomacoesPorFunil((prev) =>
      prev[funilId] ? prev : { ...prev, [funilId]: [] },
    );
  }

  function excluirAbaDoFunil(funilId: string) {
    setAutomacoesPorFunil((prev) => {
      const next = { ...prev };
      delete next[funilId];
      return next;
    });
  }

  function criarAutomacao(
    funilId: string,
    dados: Omit<Automacao, "id" | "execucoes">,
  ) {
    setAutomacoesPorFunil((prev) => ({
      ...prev,
      [funilId]: [
        ...(prev[funilId] ?? []),
        { ...dados, id: `auto-${Date.now()}`, execucoes: "0 execuções" },
      ],
    }));
  }

  function atualizarAutomacao(
    funilId: string,
    automacaoId: string,
    dados: Partial<Omit<Automacao, "id">>,
  ) {
    setAutomacoesPorFunil((prev) => ({
      ...prev,
      [funilId]: (prev[funilId] ?? []).map((a) =>
        a.id === automacaoId ? { ...a, ...dados } : a,
      ),
    }));
  }

  function excluirAutomacao(funilId: string, automacaoId: string) {
    setAutomacoesPorFunil((prev) => ({
      ...prev,
      [funilId]: (prev[funilId] ?? []).filter((a) => a.id !== automacaoId),
    }));
  }

  function alternarAtiva(funilId: string, automacaoId: string) {
    setAutomacoesPorFunil((prev) => ({
      ...prev,
      [funilId]: (prev[funilId] ?? []).map((a) =>
        a.id === automacaoId ? { ...a, ativa: !a.ativa } : a,
      ),
    }));
  }

  return (
    <AutomacoesContext.Provider
      value={{
        automacoesPorFunil,
        criarAbaParaFunil,
        excluirAbaDoFunil,
        criarAutomacao,
        atualizarAutomacao,
        excluirAutomacao,
        alternarAtiva,
      }}
    >
      {children}
    </AutomacoesContext.Provider>
  );
}

export function useAutomacoes() {
  const ctx = useContext(AutomacoesContext);
  if (!ctx) {
    throw new Error("useAutomacoes precisa estar dentro de AutomacoesProvider");
  }
  return ctx;
}
