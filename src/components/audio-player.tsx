"use client";

import { useEffect, useRef, useState } from "react";

import type { AnexoAudio, StatusMensagem } from "@/lib/data";

/**
 * Só um áudio toca por vez no módulo inteiro — quando um player começa a
 * tocar, ele pausa o que estava tocando antes. Variável de módulo (não
 * estado React) de propósito: é um registro global de runtime, não algo que
 * precise disparar re-render de quem não está tocando.
 */
let elementoTocandoAgora: HTMLAudioElement | null = null;

function tocarComExclusividade(el: HTMLAudioElement) {
  if (elementoTocandoAgora && elementoTocandoAgora !== el) {
    elementoTocandoAgora.pause();
  }
  elementoTocandoAgora = el;
  el.play();
}

function formatarDuracao(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  const min = Math.floor(s / 60);
  const seg = s % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

/** Barras de forma de onda a partir de picos de amplitude (0–1), com preenchimento de progresso. */
export function AudioWaveformBars({
  waveform,
  progresso,
  onSeek,
}: {
  waveform: number[];
  progresso: number;
  onSeek?: (fracao: number) => void;
}) {
  const barras = waveform.length > 0 ? waveform : new Array(32).fill(0.15);
  return (
    <div
      className="audio-waveform"
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Progresso do áudio" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progresso * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onClick={
        onSeek
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
            }
          : undefined
      }
      onKeyDown={
        onSeek
          ? (e) => {
              if (e.key === "ArrowRight") onSeek(Math.min(1, progresso + 0.05));
              if (e.key === "ArrowLeft") onSeek(Math.max(0, progresso - 0.05));
            }
          : undefined
      }
    >
      {barras.map((pico, i) => {
        const ativa = i / barras.length <= progresso;
        return (
          <span
            key={i}
            className={`audio-waveform-barra${ativa ? " ativa" : ""}`}
            style={{ height: `${Math.max(12, pico * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

const VELOCIDADES = [1, 1.5, 2] as const;

/**
 * Player completo de uma bolha de áudio (enviado ou recebido). Cuida do
 * próprio estado de reprodução — o pai só passa os dados do anexo e o status
 * da mensagem.
 */
export function AudioBubblePlayer({
  audio,
  tipo,
  status,
  velocidadeInicial = 1,
  onMarcarReproduzido,
}: {
  audio: AnexoAudio;
  tipo: "in" | "out";
  status?: StatusMensagem;
  velocidadeInicial?: 1 | 1.5 | 2;
  /** Presente só em mensagens enviadas ainda não marcadas como reproduzidas — ação de demonstração explícita, nunca automática. */
  onMarcarReproduzido?: () => void;
}) {
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [duracaoReal, setDuracaoReal] = useState(audio.duracao);
  const [velocidade, setVelocidade] = useState<1 | 1.5 | 2>(velocidadeInicial);

  useEffect(() => {
    const el = audioElRef.current;
    if (el) el.playbackRate = velocidade;
  }, [velocidade]);

  function alternarTocar() {
    const el = audioElRef.current;
    if (!el) return;
    if (tocando) {
      el.pause();
    } else {
      tocarComExclusividade(el);
    }
  }

  function buscar(fracao: number) {
    const el = audioElRef.current;
    if (!el || !duracaoReal) return;
    el.currentTime = fracao * duracaoReal;
    setProgresso(fracao);
  }

  return (
    <div className={`audio-player audio-player-${tipo}`}>
      <audio
        ref={audioElRef}
        src={audio.url}
        preload="metadata"
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuracaoReal(d);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (duracaoReal) setProgresso(el.currentTime / duracaoReal);
        }}
        onEnded={() => {
          setTocando(false);
          setProgresso(0);
        }}
      />
      <button
        type="button"
        className="audio-player-btn"
        onClick={alternarTocar}
        aria-label={tocando ? "Pausar áudio" : "Reproduzir áudio"}
        title={tocando ? "Pausar" : "Reproduzir"}
      >
        {tocando ? "⏸" : "▶"}
      </button>
      <div className="audio-player-meio">
        <AudioWaveformBars waveform={audio.waveform} progresso={progresso} onSeek={buscar} />
        <span className="audio-player-duracao">{formatarDuracao(duracaoReal * (1 - progresso))}</span>
      </div>
      <button
        type="button"
        className="audio-player-velocidade"
        onClick={() =>
          setVelocidade((v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length])
        }
        aria-label={`Velocidade de reprodução, atual ${velocidade}x — toque pra mudar`}
        title="Mudar velocidade"
      >
        {velocidade}x
      </button>
      {tipo === "out" && status && status !== "reproduzido" && status !== "erro" && onMarcarReproduzido ? (
        <button
          type="button"
          className="audio-player-demo-reproduzido"
          onClick={onMarcarReproduzido}
          title="Ambiente de demonstração — sem back-end conectado ainda, ninguém ouviu esse áudio de verdade"
        >
          Simular: destinatário ouviu (teste)
        </button>
      ) : null}
    </div>
  );
}
