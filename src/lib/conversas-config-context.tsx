"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type FundoConversa =
  | { tipo: "padrao" }
  | { tipo: "preset"; id: string }
  | { tipo: "imagem"; url: string }
  | { tipo: "cor"; cor: string };

export const FUNDOS_PRESET = [
  { id: "pontilhado", label: "Pontilhado", cor: "#0b1533" },
  { id: "ondas", label: "Ondas", cor: "#12294f" },
  { id: "folhas", label: "Folhas", cor: "#0f3d2e" },
  { id: "geometrico", label: "Geométrico", cor: "#3a1f5c" },
] as const;

export type PreferenciaConfirmacaoLeitura = "todos" | "salvos" | "desativado";
export type TamanhoFonteConversa = "pequena" | "media" | "grande";

export type ConfigConversas = {
  fundo: FundoConversa;
  fundoOpacidade: number;
  /** Fundo por conversa individual, usado quando o usuário escolhe "só essa conversa" em vez de "todas". */
  fundoPorConversa: Record<string, FundoConversa>;
  confirmacaoLeitura: PreferenciaConfirmacaoLeitura;
  /**
   * Sons e notificações são controlados pelo `NotificacoesContext`
   * (`notificacoesAtivas`/`alternarNotificacoes`), já existente e usado em
   * Configurações — não duplicado aqui.
   */
  previaMensagens: boolean;
  tamanhoFonte: TamanhoFonteConversa;
  teclaEnterEnvia: boolean;
  downloadAutomatico: boolean;
  tiposDownloadAutomatico: string[];
};

export const CONFIG_PADRAO: ConfigConversas = {
  fundo: { tipo: "padrao" },
  fundoOpacidade: 100,
  fundoPorConversa: {},
  confirmacaoLeitura: "todos",
  previaMensagens: true,
  tamanhoFonte: "media",
  teclaEnterEnvia: true,
  downloadAutomatico: true,
  tiposDownloadAutomatico: ["imagem", "documento"],
};

const STORAGE_KEY = "azuz-crm-conversas-config";

type ConfigConversasContextValue = {
  config: ConfigConversas;
  atualizarConfig: (patch: Partial<ConfigConversas>) => void;
  restaurarPadrao: () => void;
  /** Aplica um fundo — "todas" grava no padrão global, "atual" só nessa conversa. */
  definirFundo: (
    fundo: FundoConversa,
    escopo: "todas" | "atual",
    conversaId?: string,
  ) => void;
  /** Resolve o fundo real de uma conversa: override específico dela, senão o padrão global. */
  fundoDaConversa: (conversaId: string) => FundoConversa;
  removerFundoConversa: (conversaId: string) => void;
};

const ConfigConversasContext = createContext<ConfigConversasContextValue | null>(null);

export function ConfigConversasProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigConversas>(() => {
    if (typeof window === "undefined") return CONFIG_PADRAO;
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      return salvo ? { ...CONFIG_PADRAO, ...JSON.parse(salvo) } : CONFIG_PADRAO;
    } catch {
      return CONFIG_PADRAO;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [config]);

  function atualizarConfig(patch: Partial<ConfigConversas>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  function restaurarPadrao() {
    setConfig(CONFIG_PADRAO);
  }

  function definirFundo(
    fundo: FundoConversa,
    escopo: "todas" | "atual",
    conversaId?: string,
  ) {
    if (escopo === "atual" && conversaId) {
      setConfig((prev) => ({
        ...prev,
        fundoPorConversa: { ...prev.fundoPorConversa, [conversaId]: fundo },
      }));
    } else {
      setConfig((prev) => ({ ...prev, fundo }));
    }
  }

  function fundoDaConversa(conversaId: string) {
    return config.fundoPorConversa[conversaId] ?? config.fundo;
  }

  function removerFundoConversa(conversaId: string) {
    setConfig((prev) => {
      const resto = { ...prev.fundoPorConversa };
      delete resto[conversaId];
      return { ...prev, fundoPorConversa: resto };
    });
  }

  return (
    <ConfigConversasContext.Provider
      value={{
        config,
        atualizarConfig,
        restaurarPadrao,
        definirFundo,
        fundoDaConversa,
        removerFundoConversa,
      }}
    >
      {children}
    </ConfigConversasContext.Provider>
  );
}

export function useConfigConversas() {
  const ctx = useContext(ConfigConversasContext);
  if (!ctx) {
    throw new Error("useConfigConversas precisa estar dentro de ConfigConversasProvider");
  }
  return ctx;
}
