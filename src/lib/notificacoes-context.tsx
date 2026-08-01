"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { notificacoes as notificacoesIniciais } from "@/lib/data";

const CHAVE_NOTIFICACOES = "azuz-crm-notificacoes-ativas";

export type ItemNotificacao = { titulo: string; meta: string; lida: boolean };

type NotificacoesContextValue = {
  itens: ItemNotificacao[];
  naoLidas: number;
  notificacoesAtivas: boolean;
  alternarNotificacoes: () => void;
  marcarTodasLidas: () => void;
  /** Simula uma nova mensagem chegando no WhatsApp — toca o sinal se estiver ativado. */
  simularNovaMensagem: (nomeContato: string) => void;
  toasts: { id: string; texto: string }[];
};

const NotificacoesContext = createContext<NotificacoesContextValue | null>(null);

function tocarSinal() {
  try {
    const AudioCtxClasse =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtxClasse();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // navegador sem suporte a Web Audio — só não toca o sinal
  }
}

/**
 * Fica no layout do app (não numa página só) porque o sinal de nova
 * mensagem e o sino de notificações no cabeçalho precisam funcionar em
 * qualquer tela, não só dentro do WhatsApp.
 */
export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemNotificacao[]>(notificacoesIniciais);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const salvo = localStorage.getItem(CHAVE_NOTIFICACOES);
      return salvo === null ? true : salvo === "1";
    } catch {
      return true;
    }
  });
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const [proximoToastId, setProximoToastId] = useState(0);

  const naoLidas = itens.filter((n) => !n.lida).length;

  function alternarNotificacoes() {
    setNotificacoesAtivas((prev) => {
      const proximo = !prev;
      try {
        localStorage.setItem(CHAVE_NOTIFICACOES, proximo ? "1" : "0");
      } catch {
        // localStorage indisponível — só não persiste entre sessões
      }
      return proximo;
    });
  }

  function marcarTodasLidas() {
    setItens((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  function simularNovaMensagem(nomeContato: string) {
    setItens((prev) => [
      {
        titulo: `${nomeContato} mandou uma mensagem no WhatsApp`,
        meta: "agora",
        lida: false,
      },
      ...prev,
    ]);
    if (!notificacoesAtivas) return;
    tocarSinal();
    const id = `toast-${proximoToastId}`;
    setProximoToastId((v) => v + 1);
    setToasts((prev) => [
      ...prev,
      { id, texto: `Nova mensagem de ${nomeContato} no WhatsApp` },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  return (
    <NotificacoesContext.Provider
      value={{
        itens,
        naoLidas,
        notificacoesAtivas,
        alternarNotificacoes,
        marcarTodasLidas,
        simularNovaMensagem,
        toasts,
      }}
    >
      {children}
    </NotificacoesContext.Provider>
  );
}

export function useNotificacoes() {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) {
    throw new Error(
      "useNotificacoes precisa estar dentro de NotificacoesProvider",
    );
  }
  return ctx;
}
