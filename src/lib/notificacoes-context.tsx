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
/**
 * O QUE DÁ PRA LIGAR E DESLIGAR, e por que são só estes.
 *
 * "Cadê as notificações? Deixa cada notificação num botão."
 *
 * A tela tinha UM interruptor, e antes dele uma matriz de canal × frequência que saiu porque
 * prometia e-mail, push e WhatsApp que nunca foram enviados. Voltar aquilo seria repor promessa.
 *
 * Estes três existem de verdade, e dá pra apontar onde: o CRM só gera UM tipo de aviso hoje —
 * mensagem nova numa conversa (`NotificacoesPonte`) —, ele já sabe por qual canal a mensagem
 * chegou, e o sinal sonoro é uma função que toca de fato (`tocarSinal`). Três botões que mexem em
 * três comportamentos reais, e nenhum a mais.
 */
type PrefsNotificacoes = {
  /** O aviso na tela (o toast). Desligado, o sino continua contando — só não salta na frente. */
  notificacoesAtivas: boolean;
  /** Avisar de mensagem nova que chegou pelo WhatsApp. */
  whatsapp: boolean;
  /** Avisar de mensagem nova que chegou pelo Direct do Instagram. */
  instagram: boolean;
  /** O apito junto do aviso. Separado porque quem atende de headset o dia todo quer o aviso e não
   *  quer o som — e era o único jeito de calar o CRM era desligar o aviso inteiro. */
  som: boolean;
};

const PREFS_PADRAO: PrefsNotificacoes = {
  notificacoesAtivas: true,
  whatsapp: true,
  instagram: true,
  som: true,
};

export type ItemNotificacao = { titulo: string; meta: string; lida: boolean };

type NotificacoesContextValue = {
  itens: ItemNotificacao[];
  naoLidas: number;
  notificacoesAtivas: boolean;
  alternarNotificacoes: () => void;
  /** As preferências que a tela de Configurações mostra como botões. */
  prefs: PrefsNotificacoes;
  alternarPref: (campo: keyof PrefsNotificacoes) => void;
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
  const [prefs, setPrefs] = useState<PrefsNotificacoes>(PREFS_PADRAO);
  const notificacoesAtivas = prefs.notificacoesAtivas;
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const [proximoToastId, setProximoToastId] = useState(0);

  useEffect(() => {
    fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`)
      .then((r) => r.json())
      .then((dados: Partial<PrefsNotificacoes>) => {
        // Campo a campo, com o padrão por baixo: quem já tinha a preferência antiga gravada só
        // com `notificacoesAtivas` não perde a escolha dela nem nasce com os canais desligados.
        setPrefs((atual) => ({ ...atual, ...dados }));
      })
      .catch((erro) => console.error("Falha ao carregar preferências de notificações:", erro));
  }, []);

  function salvarRemoto(completo: PrefsNotificacoes) {
    fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completo),
    }).catch((erro) => console.error("Falha ao salvar preferências de notificações:", erro));
  }

  const naoLidas = itens.filter((n) => !n.lida).length;

  function alternarPref(campo: keyof PrefsNotificacoes) {
    setPrefs((prev) => {
      const proximo = { ...prev, [campo]: !prev[campo] };
      salvarRemoto(proximo);
      return proximo;
    });
  }

  function alternarNotificacoes() {
    alternarPref("notificacoesAtivas");
  }

  function marcarTodasLidas() {
    setItens((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  function adicionarToast(texto: string) {
    if (prefs.som) tocarSinal();
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
    /* O canal manda: quem desligou o Instagram não quer o salto na tela a cada Direct, e a
       conversa continua existindo na lista do mesmo jeito. Canal que não for nenhum dos dois
       (histórico antigo, canal novo) avisa — silenciar o que não se conhece é como se perde
       mensagem sem ninguém saber por quê. */
    if (canal === "WhatsApp" && !prefs.whatsapp) return;
    if (canal === "Instagram" && !prefs.instagram) return;
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
        prefs,
        alternarPref,
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
