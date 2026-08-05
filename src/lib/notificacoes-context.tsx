"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { notificacoes as notificacoesIniciais } from "@/lib/data";

/** Preferências (banco real, ver src/app/api/preferencias/) — chave desse blob na tabela `Preferencia`. */
const CHAVE_PREFERENCIA = "notificacoes";

type PrefsNotificacoes = {
  notificacoesAtivas: boolean;
  notificarNovaTarefa: boolean;
  notificarComentario: boolean;
};

export type ItemNotificacao = { titulo: string; meta: string; lida: boolean };

type NotificacoesContextValue = {
  itens: ItemNotificacao[];
  naoLidas: number;
  notificacoesAtivas: boolean;
  alternarNotificacoes: () => void;
  notificarNovaTarefa: boolean;
  alternarNotificarNovaTarefa: () => void;
  notificarComentario: boolean;
  alternarNotificarComentario: () => void;
  marcarTodasLidas: () => void;
  /** Simula uma nova mensagem chegando no WhatsApp — toca o sinal se estiver ativado. */
  simularNovaMensagem: (nomeContato: string) => void;
  /** Dispara ao criar uma tarefa nova — toca o sinal se estiver ativado. */
  simularNovaTarefa: (titulo: string) => void;
  /** Simula alguém comentando (ainda não existe comentário de verdade no CRM). */
  simularComentario: (nomeAutor: string) => void;
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
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);
  const [notificarNovaTarefa, setNotificarNovaTarefa] = useState(true);
  const [notificarComentario, setNotificarComentario] = useState(true);
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const [proximoToastId, setProximoToastId] = useState(0);

  useEffect(() => {
    fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`)
      .then((r) => r.json())
      .then((dados: Partial<PrefsNotificacoes>) => {
        if (dados.notificacoesAtivas !== undefined) setNotificacoesAtivas(dados.notificacoesAtivas);
        if (dados.notificarNovaTarefa !== undefined) setNotificarNovaTarefa(dados.notificarNovaTarefa);
        if (dados.notificarComentario !== undefined) setNotificarComentario(dados.notificarComentario);
      })
      .catch((erro) => console.error("Falha ao carregar preferências de notificações:", erro));
  }, []);

  function salvarRemoto(patch: Partial<PrefsNotificacoes>) {
    fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificacoesAtivas,
        notificarNovaTarefa,
        notificarComentario,
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

  function alternarNotificarNovaTarefa() {
    setNotificarNovaTarefa((prev) => {
      const proximo = !prev;
      salvarRemoto({ notificarNovaTarefa: proximo });
      return proximo;
    });
  }

  function alternarNotificarComentario() {
    setNotificarComentario((prev) => {
      const proximo = !prev;
      salvarRemoto({ notificarComentario: proximo });
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
    adicionarToast(`Nova mensagem de ${nomeContato} no WhatsApp`);
  }

  function simularNovaTarefa(titulo: string) {
    setItens((prev) => [
      { titulo: `Nova tarefa: ${titulo}`, meta: "agora", lida: false },
      ...prev,
    ]);
    if (!notificarNovaTarefa) return;
    adicionarToast(`Nova tarefa criada: ${titulo}`);
  }

  function simularComentario(nomeAutor: string) {
    setItens((prev) => [
      { titulo: `${nomeAutor} comentou`, meta: "agora", lida: false },
      ...prev,
    ]);
    if (!notificarComentario) return;
    adicionarToast(`${nomeAutor} deixou um comentário`);
  }

  return (
    <NotificacoesContext.Provider
      value={{
        itens,
        naoLidas,
        notificacoesAtivas,
        alternarNotificacoes,
        notificarNovaTarefa,
        alternarNotificarNovaTarefa,
        notificarComentario,
        alternarNotificarComentario,
        marcarTodasLidas,
        simularNovaMensagem,
        simularNovaTarefa,
        simularComentario,
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
