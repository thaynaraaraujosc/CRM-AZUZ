"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** Preferências (banco real, ver src/app/api/preferencias/): chave desse blob na tabela `Preferencia`. */
const CHAVE_PREFERENCIA = "notificacoes";

/* A preferência de "tarefa nova" saiu junto com o módulo de Tarefas: sem nada que crie tarefa, o
 * toggle em Configurações era um botão decorativo, e o aviso nunca podia disparar. Linhas antigas
 * da tabela `Preferencia` com essa chave são simplesmente ignoradas na leitura. */
type PrefsNotificacoes = {
  notificacoesAtivas: boolean;
};

export type ItemNotificacao = { titulo: string; meta: string; lida: boolean };

type NotificacoesContextValue = {
  itens: ItemNotificacao[];
  naoLidas: number;
  notificacoesAtivas: boolean;
  alternarNotificacoes: () => void;
  marcarTodasLidas: () => void;
  /** Dispara quando chega mensagem nova de verdade no WhatsApp. Ver `NotificacoesPonte`, que
   * detecta isso comparando o `naoLidas` real de `conversas-context.tsx` a cada nova busca. */
  notificarNovaMensagem: (nomeContato: string, canal: string) => void;
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
    // navegador sem suporte a Web Audio. Só não toca o sinal
  }
}

/**
 * Fica no layout do app (não numa página só) porque o sinal de nova
 * mensagem e o sino de notificações no cabeçalho precisam funcionar em
 * qualquer tela, não só dentro do WhatsApp.
 */
export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemNotificacao[]>([]);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const [proximoToastId, setProximoToastId] = useState(0);

  useEffect(() => {
    fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`)
      .then((r) => r.json())
      .then((dados: Partial<PrefsNotificacoes>) => {
        if (dados.notificacoesAtivas !== undefined) setNotificacoesAtivas(dados.notificacoesAtivas);
      })
      .catch((erro) => console.error("Falha ao carregar preferências de notificações:", erro));
  }, []);

  function salvarRemoto(patch: Partial<PrefsNotificacoes>) {
    fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificacoesAtivas,
        ...patch,
      }),
    }).catch((erro) => console.error("Falha ao salvar preferências de notificações:", erro));
  }

  const naoLidas = itens.filter((n) => !n.lida).length;

  function alternarNotificacoes() {
    setNotificacoesAtivas((prev) => {
      const proximo = !prev;
      salvarRemoto({ notificacoesAtivas: proximo });
      return proximo;
    });
  }

  function marcarTodasLidas() {
    setItens((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  function adicionarToast(texto: string) {
    tocarSinal();
    const id = `toast-${proximoToastId}`;
    setProximoToastId((v) => v + 1);
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  /**
   * O canal vem da conversa, não fixo no texto. O aviso dizia "no WhatsApp" para TODA mensagem,
   * então uma mensagem de Direct aparecia como `@fulano mandou uma mensagem no WhatsApp`: um
   * rótulo simplesmente errado, que ainda fazia parecer que a mensagem tinha caído no canal errado.
   */
  function notificarNovaMensagem(nomeContato: string, canal: string) {
    setItens((prev) => [
      {
        titulo: `${nomeContato} mandou uma mensagem no ${canal}`,
        meta: "agora",
        lida: false,
      },
      ...prev,
    ]);
    if (!notificacoesAtivas) return;
    adicionarToast(`Nova mensagem de ${nomeContato} no ${canal}`);
  }

  return (
    <NotificacoesContext.Provider
      value={{
        itens,
        naoLidas,
        notificacoesAtivas,
        alternarNotificacoes,
        marcarTodasLidas,
        notificarNovaMensagem,
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
