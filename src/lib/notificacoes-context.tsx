"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  /**
   * UM AVISO NA TELA, de qualquer parte do CRM.
   *
   * Existe porque havia CINCO pilhas de aviso — uma no cabeçalho, uma no funil, uma em
   * Formulários, uma em Conversas e uma no editor de automação —, cada uma com o mesmo
   * `position: fixed` no mesmo canto. Enquanto a do cabeçalho ficava em cima e as outras embaixo,
   * dava pra fingir que não era problema. Com a de mensagem nova descendo pro canto de baixo, as
   * duas cairiam exatamente uma sobre a outra.
   *
   * Então passou a ser uma pilha só, e as telas empurram pra cá. Sem som e sem entrada no sino:
   * "formulário duplicado" não é notificação, é confirmação do que a pessoa acabou de fazer.
   */
  mostrarAviso: (texto: string, duracaoMs?: number) => void;
  toasts: { id: string; texto: string }[];
};

const NotificacoesContext = createContext<NotificacoesContextValue | null>(null);

/**
 * O APITO DA MENSAGEM NOVA.
 *
 * "A forma que as notificações chegam é muito feia. O som é muito feio. Queria ver se a gente
 * conseguia fazer o som do WhatsApp, tipo, parecido."
 *
 * O som do WhatsApp é um arquivo deles e não entra aqui. O que dá pra fazer — e é o que isto faz —
 * é montar um som da MESMA FAMÍLIA: curto, macio, duas notas subindo, que é o formato que todo
 * mensageiro usa porque funciona. Era uma senoide única de 880 Hz segurada por 350 ms: o bipe de
 * aparelho de teste, e o motivo de soar feio não é gosto — é que uma onda pura sem harmônico e
 * sem ataque não soa como instrumento nenhum, soa como alarme.
 *
 * O que mudou, em três partes:
 *
 *  1. DUAS NOTAS, dó e fá uma oitava acima do dó central, com 85 ms entre elas. Intervalo de
 *     quarta justa subindo, que é o "ti-dim" que o ouvido lê como aviso e não como erro.
 *  2. CADA NOTA LEVA O HARMÔNICO DELA (a oitava, bem mais baixa). É o que tira o gosto de onda
 *     pura e dá o toque de sino — a diferença entre bipe e nota tocada.
 *  3. ENVELOPE CURTO: 6 ms de ataque (sem estalo, que é o que um corte seco faz) e queda
 *     exponencial. O som inteiro acaba em menos de 350 ms, e esse é o ponto: aviso que se demora
 *     vira interrupção.
 *
 * Um filtro passa-baixa em 3,8 kHz corta o que sobra em cima. Sem ele o harmônico da segunda nota
 * fica fino e arranha em caixa de notebook, que é onde isto vai tocar.
 */

/**
 * UM `AudioContext` SÓ, guardado — e isto é correção de defeito, não arrumação.
 *
 * Era um `new AudioContext()` POR AVISO, nunca fechado. O Chrome permite seis por página: do
 * sétimo aviso em diante o construtor lança, caía no `catch` e o CRM ficava mudo até alguém
 * recarregar a página. Quem atende o dia todo chegava nesse ponto antes do almoço.
 */
let contextoDeAudio: AudioContext | null = null;

function pegarContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Classe =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Classe) return null;
  if (!contextoDeAudio || contextoDeAudio.state === "closed") contextoDeAudio = new Classe();
  return contextoDeAudio;
}

/** Uma nota: senoide com ataque curto e queda exponencial, ligada no filtro comum. */
function nota(
  ctx: AudioContext,
  saida: AudioNode,
  hz: number,
  atraso: number,
  duracao: number,
  volume: number,
) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  const t = ctx.currentTime + atraso;
  osc.type = "sine";
  osc.frequency.setValueAtTime(hz, t);
  /* Rampa exponencial não passa pelo zero, por isso o 0.0001 nas pontas em vez de 0: com zero a
     chamada é ignorada e o volume salta, que é exatamente o estalo que se quer evitar. */
  ganho.gain.setValueAtTime(0.0001, t);
  ganho.gain.exponentialRampToValueAtTime(volume, t + 0.006);
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  osc.connect(ganho);
  ganho.connect(saida);
  osc.start(t);
  osc.stop(t + duracao + 0.02);
}

export function tocarSinal() {
  try {
    const ctx = pegarContexto();
    if (!ctx) return;
    /* O navegador cria o contexto suspenso até a primeira interação da pessoa com a página. Sem
       este `resume` o primeiro aviso de cada sessão sairia mudo. */
    void ctx.resume().catch(() => {});

    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 3800;
    filtro.Q.value = 0.7;
    filtro.connect(ctx.destination);

    //       nota     atraso  duração  volume
    nota(ctx, filtro, 1046.5, 0, 0.16, 0.16); // dó
    nota(ctx, filtro, 2093.0, 0, 0.1, 0.04); // o harmônico dele
    nota(ctx, filtro, 1396.9, 0.085, 0.26, 0.14); // fá
    nota(ctx, filtro, 2793.8, 0.085, 0.14, 0.035); // o harmônico dele
  } catch {
    // Navegador sem Web Audio: o aviso continua aparecendo na tela, só não apita.
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
  /* Contador em `ref`, não em estado: dois avisos no mesmo quadro liam o mesmo valor do estado e
     nasciam com o mesmo id — e aí o `setTimeout` do primeiro apagava os dois. */
  const proximoToastId = useRef(0);

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

  const empilharAviso = useCallback((texto: string, duracaoMs: number) => {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => {
      const proximo = [...prev, { id, texto }];
      /* NO MÁXIMO TRÊS NA TELA. Dez avisos empilhados cobrem metade da janela e nenhum deles é
         lido — e o que some primeiro tem que ser o mais velho, não o que acabou de chegar. */
      return proximo.length > 3 ? proximo.slice(proximo.length - 3) : proximo;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duracaoMs);
  }, []);

  const mostrarAviso = useCallback(
    (texto: string, duracaoMs = 4000) => empilharAviso(texto, duracaoMs),
    [empilharAviso],
  );

  /*
   * O APITO NÃO REPETE EM RAJADA.
   *
   * Cinco mensagens chegando na mesma busca de 5 s tocavam cinco vezes, sobrepostas — e som
   * sobreposto não é cinco avisos, é um ruído. Um apito a cada 1,5 s basta: a pessoa olha a tela
   * uma vez e vê os avisos empilhados, que é o que ela ia fazer de qualquer jeito.
   */
  const ultimoApito = useRef(0);

  function adicionarToast(texto: string) {
    if (prefs.som) {
      const agora = Date.now();
      if (agora - ultimoApito.current > 1500) {
        ultimoApito.current = agora;
        tocarSinal();
      }
    }
    empilharAviso(texto, 4000);
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
        mostrarAviso,
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
