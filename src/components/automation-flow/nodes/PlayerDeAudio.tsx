"use client";

import { useEffect, useRef, useState } from "react";

import { IconPause, IconPlay } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O ÁUDIO DO BLOCO, tocável dentro do próprio cartão.
 *
 * Antes o cartão dizia que havia um áudio e só: pra ouvir o que o robô vai mandar era preciso
 * abrir o painel da direita, e muitas vezes nem lá dava. Num fluxo com três áudios gravados em
 * dias diferentes, "qual é qual" vira adivinhação.
 *
 * A FORMA DE ONDA É DO ÁUDIO DE VERDADE: o arquivo é decodificado e as barras saem da amplitude
 * média de cada fatia. Desenhar um padrão bonito e fixo seria inventar dado — duas gravações
 * diferentes apareceriam idênticas, e a figura passaria a não querer dizer nada.
 *
 * Se o navegador não souber decodificar (acontece com formatos exóticos), fica só o player: a
 * barra some em vez de aparecer chapada, pelo mesmo motivo.
 */
const BARRAS = 42;

function relogio(segundos: number): string {
  if (!Number.isFinite(segundos)) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerDeAudio({ src, nome }: { src: string; nome?: string }) {
  const { t: traduzir } = useIdioma();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(0);
  /* A onda guarda de QUAL arquivo ela é. Zerá-la quando `src` muda seria mexer em estado dentro
     do efeito; comparar na hora de desenhar dá o mesmo resultado sem o render extra. */
  const [onda, setOnda] = useState<{ src: string; barras: number[] } | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resposta = await fetch(src);
        const bytes = await resposta.arrayBuffer();
        const Ctx =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const decodificado = await ctx.decodeAudioData(bytes);
        const canal = decodificado.getChannelData(0);
        const porBarra = Math.max(1, Math.floor(canal.length / BARRAS));
        const barras: number[] = [];
        for (let i = 0; i < BARRAS; i += 1) {
          let soma = 0;
          for (let j = 0; j < porBarra; j += 1) soma += Math.abs(canal[i * porBarra + j] ?? 0);
          barras.push(soma / porBarra);
        }
        const maior = Math.max(...barras, 0.0001);
        await ctx.close().catch(() => {});
        if (!cancelado) {
          setOnda({ src, barras: barras.map((b) => Math.max(0.12, b / maior)) });
          setDuracao(decodificado.duration);
        }
      } catch {
        // Sem forma de onda: o player continua, a figura não. Ver o comentário do topo.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [src]);

  const progresso = duracao ? posicao / duracao : 0;
  const barras = onda?.src === src ? onda.barras : null;

  return (
    <div className="msg-audio nodrag" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="msg-audio-play"
        aria-label={tocando ? traduzir("Pausar") : traduzir("Tocar")}
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
      >
        {tocando ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
      </button>

      {barras ? (
        <span className="msg-audio-onda" aria-hidden="true">
          {barras.map((altura, i) => (
            <span
              key={i}
              className={i / barras.length <= progresso ? "tocada" : ""}
              style={{ height: `${Math.round(altura * 100)}%` }}
            />
          ))}
        </span>
      ) : (
        <span className="msg-audio-barra" aria-hidden="true">
          <span style={{ width: `${Math.round(progresso * 100)}%` }} />
        </span>
      )}

      <span className="msg-audio-tempo">{relogio(tocando || posicao ? posicao : duracao)}</span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setPosicao(0);
        }}
        onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          // `duration` de webm gravado no navegador às vezes vem como Infinity; aí vale a que
          // saiu da decodificação.
          if (Number.isFinite(e.currentTarget.duration)) setDuracao(e.currentTarget.duration);
        }}
      >
        <track kind="captions" />
      </audio>

      {nome ? <span className="sr-only">{nome}</span> : null}
    </div>
  );
}
