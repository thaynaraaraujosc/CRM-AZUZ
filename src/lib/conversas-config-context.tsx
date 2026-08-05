"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

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
export type DensidadeMensagens = "compacta" | "confortavel";
export type ComportamentoEnter = "enter_envia" | "enter_quebra";
export type VelocidadeAudioPadrao = 1 | 1.5 | 2;

export type ConfigConversas = {
  fundo: FundoConversa;
  fundoOpacidade: number;
  /** Fundo por conversa individual, usado quando o usuário escolhe "só essa conversa" em vez de "todas". */
  fundoPorConversa: Record<string, FundoConversa>;

  // Privacidade
  confirmacaoLeitura: PreferenciaConfirmacaoLeitura;
  mostrarEstadoEnvio: boolean;
  mostrarEstadoEntrega: boolean;
  mostrarEstadoLeitura: boolean;
  mostrarEstadoReproducao: boolean;
  mostrarUltimaAtividade: boolean;
  ocultarPreviaNotificacao: boolean;

  // Notificações — sons/alertas ficam aqui; "notificacoesAtivas" do
  // NotificacoesContext continua sendo o interruptor mestre.
  somNovaMensagem: boolean;
  notificacaoNavegador: boolean;
  notificacaoNovaConversa: boolean;
  notificacaoMencao: boolean;
  notificacaoTarefa: boolean;
  previaMensagens: boolean;
  silenciarArquivadas: boolean;
  somSoSegundoPlano: boolean;
  somEscolhido: string;

  // Preferências
  tamanhoFonte: TamanhoFonteConversa;
  densidadeMensagens: DensidadeMensagens;
  teclaEnterEnvia: boolean;
  downloadAutomatico: boolean;
  tiposDownloadAutomatico: string[];
  previaLinks: boolean;
  autoplayVideos: boolean;
  velocidadeAudioPadrao: VelocidadeAudioPadrao;
  manterPainelContatoAberto: boolean;
};

export const SONS_DISPONIVEIS = [
  { id: "classico", label: "Clássico" },
  { id: "suave", label: "Suave" },
  { id: "alerta", label: "Alerta" },
  { id: "nenhum", label: "Nenhum" },
] as const;

export const CONFIG_PADRAO: ConfigConversas = {
  fundo: { tipo: "padrao" },
  fundoOpacidade: 100,
  fundoPorConversa: {},

  confirmacaoLeitura: "todos",
  mostrarEstadoEnvio: true,
  mostrarEstadoEntrega: true,
  mostrarEstadoLeitura: true,
  mostrarEstadoReproducao: true,
  mostrarUltimaAtividade: true,
  ocultarPreviaNotificacao: false,

  somNovaMensagem: true,
  notificacaoNavegador: false,
  notificacaoNovaConversa: true,
  notificacaoMencao: true,
  notificacaoTarefa: true,
  previaMensagens: true,
  silenciarArquivadas: true,
  somSoSegundoPlano: false,
  somEscolhido: "classico",

  tamanhoFonte: "media",
  densidadeMensagens: "confortavel",
  teclaEnterEnvia: true,
  downloadAutomatico: true,
  tiposDownloadAutomatico: ["imagem", "documento"],
  previaLinks: true,
  autoplayVideos: false,
  velocidadeAudioPadrao: 1,
  manterPainelContatoAberto: false,
};

/** Preferências (banco real, ver src/app/api/preferencias/) — chave desse blob na tabela `Preferencia`. */
const CHAVE_PREFERENCIA = "conversas-config";

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
  const [config, setConfig] = useState<ConfigConversas>(CONFIG_PADRAO);
  const hidratadoRef = useRef(false);

  useEffect(() => {
    fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`)
      .then((r) => r.json())
      .then((salvo: Partial<ConfigConversas>) => {
        setConfig({ ...CONFIG_PADRAO, ...salvo });
        hidratadoRef.current = true;
      })
      .catch((erro) => console.error("Falha ao carregar config de conversas:", erro));
  }, []);

  useEffect(() => {
    if (!hidratadoRef.current) return;
    const temporizador = setTimeout(() => {
      fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }).catch((erro) => console.error("Falha ao salvar config de conversas:", erro));
    }, 400);
    return () => clearTimeout(temporizador);
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
