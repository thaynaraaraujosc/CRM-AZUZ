"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type { TipoAcaoAutomacao, TipoGatilhoEtapa } from "@/lib/data";

export type OpcaoResposta = {
  id: string;
  rotulo: string;
};

export type AcaoAutomacao = {
  id: string;
  tipo: TipoAcaoAutomacao;
  /** Usado por "mensagem" e "mensagem_interativa" (texto principal enviado). */
  mensagem?: string;
  /** Usado só por "mensagem_interativa" — as opções de resposta que o contato pode escolher. */
  opcoes?: OpcaoResposta[];
  /** Usado por "documento" e "audio" — nome do arquivo escolhido/gravado. */
  arquivoNome?: string;
  /** Usado por "lembrete" — em quanto tempo o lembrete dispara. */
  tempoValor?: string;
  tempoUnidade?: string;
  /** Usado por "mover_funil". */
  moverFunilId?: string;
  moverEtapaTitulo?: string;
};

export type Automacao = {
  id: string;
  funilId: string;
  etapaId: string;
  titulo: string;
  gatilhoTipo: TipoGatilhoEtapa;
  /** Só usado quando gatilhoTipo === "parado". */
  tempoValor?: string;
  tempoUnidade?: string;
  acoes: AcaoAutomacao[];
  ativa: boolean;
  execucoes: string;
};

type AutomacoesContextValue = {
  automacoes: Automacao[];
  automacoesDaEtapa: (funilId: string, etapaId: string) => Automacao[];
  /** Automações com gatilho "entrou" e ativas — usado pra simular o disparo ao soltar um card na coluna. */
  automacoesDeEntradaAtivas: (funilId: string, etapaId: string) => Automacao[];
  criarAutomacao: (dados: Omit<Automacao, "id" | "execucoes">) => void;
  atualizarAutomacao: (
    automacaoId: string,
    dados: Partial<Omit<Automacao, "id">>,
  ) => void;
  excluirAutomacao: (automacaoId: string) => void;
  alternarAtiva: (automacaoId: string) => void;
  /** Chamado quando uma etapa é apagada — some com as automações que só faziam sentido nela. */
  excluirAutomacoesDaEtapa: (funilId: string, etapaId: string) => void;
  /** Chamado quando um funil inteiro é apagado. */
  excluirAutomacoesDoFunil: (funilId: string) => void;
};

const AutomacoesContext = createContext<AutomacoesContextValue | null>(null);

const AUTOMACOES_INICIAIS: Automacao[] = [
  {
    id: "auto-boas-vindas",
    funilId: "emagrecimento-diabetes",
    etapaId: "novo",
    titulo: "Boas-vindas pro lead novo",
    gatilhoTipo: "entrou",
    acoes: [
      {
        id: "acao-boas-vindas-msg",
        tipo: "mensagem_interativa",
        mensagem:
          "Oi! Recebemos sua mensagem 💙 Antes de continuar, me conta uma coisa:",
        opcoes: [
          { id: "op-1", rotulo: "1 · Já sou paciente da clínica" },
          { id: "op-2", rotulo: "2 · É minha primeira vez por aqui" },
        ],
      },
    ],
    ativa: true,
    execucoes: "312 execuções",
  },
  {
    id: "auto-proposta-parada",
    funilId: "emagrecimento-diabetes",
    etapaId: "proposta",
    titulo: "Lembrete de proposta parada",
    gatilhoTipo: "parado",
    tempoValor: "3",
    tempoUnidade: "dias",
    acoes: [
      {
        id: "acao-proposta-lembrete",
        tipo: "lembrete",
        mensagem: "Retomar contato — proposta enviada sem resposta",
        tempoValor: "3",
        tempoUnidade: "dias",
      },
      {
        id: "acao-proposta-msg",
        tipo: "mensagem",
        mensagem: "Oi! Ainda tem interesse na proposta que te enviamos? 🙂",
      },
    ],
    ativa: true,
    execucoes: "28 execuções",
  },
];

/**
 * Automações agora vivem dentro da etapa de um funil (não numa aba separada
 * por funil) — cada card de automação mostra o gatilho + as ações dentro da
 * coluna do Kanban, igual /funil. Apagar a etapa ou o funil apaga junto as
 * automações que só faziam sentido ali.
 */
export function AutomacoesProvider({ children }: { children: ReactNode }) {
  const [automacoes, setAutomacoes] = useState<Automacao[]>(AUTOMACOES_INICIAIS);

  function automacoesDaEtapa(funilId: string, etapaId: string) {
    return automacoes.filter(
      (a) => a.funilId === funilId && a.etapaId === etapaId,
    );
  }

  function automacoesDeEntradaAtivas(funilId: string, etapaId: string) {
    return automacoes.filter(
      (a) =>
        a.funilId === funilId &&
        a.etapaId === etapaId &&
        a.gatilhoTipo === "entrou" &&
        a.ativa,
    );
  }

  function criarAutomacao(dados: Omit<Automacao, "id" | "execucoes">) {
    setAutomacoes((prev) => [
      ...prev,
      { ...dados, id: `auto-${Date.now()}`, execucoes: "0 execuções" },
    ]);
  }

  function atualizarAutomacao(
    automacaoId: string,
    dados: Partial<Omit<Automacao, "id">>,
  ) {
    setAutomacoes((prev) =>
      prev.map((a) => (a.id === automacaoId ? { ...a, ...dados } : a)),
    );
  }

  function excluirAutomacao(automacaoId: string) {
    setAutomacoes((prev) => prev.filter((a) => a.id !== automacaoId));
  }

  function alternarAtiva(automacaoId: string) {
    setAutomacoes((prev) =>
      prev.map((a) => (a.id === automacaoId ? { ...a, ativa: !a.ativa } : a)),
    );
  }

  function excluirAutomacoesDaEtapa(funilId: string, etapaId: string) {
    setAutomacoes((prev) =>
      prev.filter((a) => !(a.funilId === funilId && a.etapaId === etapaId)),
    );
  }

  function excluirAutomacoesDoFunil(funilId: string) {
    setAutomacoes((prev) => prev.filter((a) => a.funilId !== funilId));
  }

  return (
    <AutomacoesContext.Provider
      value={{
        automacoes,
        automacoesDaEtapa,
        automacoesDeEntradaAtivas,
        criarAutomacao,
        atualizarAutomacao,
        excluirAutomacao,
        alternarAtiva,
        excluirAutomacoesDaEtapa,
        excluirAutomacoesDoFunil,
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
