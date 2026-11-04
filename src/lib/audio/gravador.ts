"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * GRAVAR UM ÁUDIO CURTO PELO NAVEGADOR, pra um botão qualquer do CRM.
 *
 * Nasceu pro cartão de mensagem do editor de automação, onde a referência grava o áudio dentro do
 * próprio bloco. A tela de Conversas tem uma gravação própria, mais completa (pausa, forma de
 * onda ao vivo, descarte com confirmação) escrita dentro da página; ela continua como está. Este
 * hook é o mínimo que serve a qualquer outro lugar: começar, parar, e o arquivo no fim.
 *
 * O ARQUIVO SAI EM DATA URL e não em `Blob`: é nesse formato que o CRM guarda mídia (ver
 * `armazenamento/midia.ts` e a biblioteca de documentos), e converter aqui evita que cada tela
 * que usar o hook reescreva o mesmo `FileReader`.
 *
 * O FLUXO É SEMPRE DESLIGADO NO FIM, inclusive quando o componente some no meio da gravação: sem
 * isso a luzinha do microfone fica acesa depois que a pessoa já saiu da tela, que é o tipo de
 * coisa que faz alguém desconfiar do produto inteiro.
 */
export type EstadoDaGravacao = "parado" | "pedindo" | "gravando";

export type AudioGravado = { dataUrl: string; segundos: number; mimeType: string };

export function useGravadorDeAudio(aoTerminar: (audio: AudioGravado) => void) {
  const [estado, setEstado] = useState<EstadoDaGravacao>("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  /*
   * OS TRACINHOS ENQUANTO GRAVA, e eles são o volume DE VERDADE.
   *
   * Uma animação de barras subindo e descendo sozinha seria mais fácil e mentiria: ela continua
   * dançando com o microfone mudo, e aí a figura deixa de responder "está me ouvindo?" — que é a
   * única pergunta que ela existe pra responder. Aqui cada barra é a média do sinal naquele
   * instante, lida de um `AnalyserNode`.
   */
  const [niveis, setNiveis] = useState<number[]>([]);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const fluxoRef = useRef<MediaStream | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contextoRef = useRef<AudioContext | null>(null);
  const quadroRef = useRef<number | null>(null);
  /*
   * QUANDO A GRAVAÇÃO COMEÇOU, e não quantos segundos já se passaram.
   *
   * O `onstop` do MediaRecorder precisa saber a duração, e ele não enxerga o estado do React: o
   * fecho dele é o do render em que o gravador foi criado. Guardar o contador numa ref resolveria
   * — e escrever numa ref durante o render é proibido, com razão. O instante de início é escrito
   * dentro do clique, que é um evento, e a duração sai de uma subtração.
   */
  const comecouEmRef = useRef(0);

  const encerrarTudo = useCallback(() => {
    if (relogioRef.current) clearInterval(relogioRef.current);
    relogioRef.current = null;
    if (quadroRef.current) cancelAnimationFrame(quadroRef.current);
    quadroRef.current = null;
    contextoRef.current?.close().catch(() => {});
    contextoRef.current = null;
    fluxoRef.current?.getTracks().forEach((t) => t.stop());
    fluxoRef.current = null;
    gravadorRef.current = null;
  }, []);

  // Desmontar no meio da gravação não pode deixar o microfone ligado.
  useEffect(() => encerrarTudo, [encerrarTudo]);

  const comecar = useCallback(async () => {
    setErro(null);
    setEstado("pedindo");
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      fluxoRef.current = fluxo;

      const Ctx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const contexto = new Ctx();
      const analisador = contexto.createAnalyser();
      analisador.fftSize = 256;
      contexto.createMediaStreamSource(fluxo).connect(analisador);
      contextoRef.current = contexto;
      const amostra = new Uint8Array(analisador.frequencyBinCount);
      /* Uma barra a cada ~100ms, e no máximo 36 na tela: mais que isso elas ficam com menos de um
         pixel e viram uma mancha. */
      let ultimaBarra = 0;
      const medir = () => {
        quadroRef.current = requestAnimationFrame(medir);
        const agora = performance.now();
        if (agora - ultimaBarra < 100) return;
        ultimaBarra = agora;
        analisador.getByteTimeDomainData(amostra);
        let soma = 0;
        for (const v of amostra) soma += Math.abs(v - 128);
        const nivel = Math.min(1, soma / amostra.length / 40);
        setNiveis((atual) => [...atual, Math.max(0.08, nivel)].slice(-36));
      };
      medir();
      const tipo = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const gravador = new MediaRecorder(fluxo, { mimeType: tipo });
      pedacosRef.current = [];
      gravador.ondataavailable = (e) => {
        if (e.data.size > 0) pedacosRef.current.push(e.data);
      };
      gravador.onstop = () => {
        setNiveis([]);
        const blob = new Blob(pedacosRef.current, { type: "audio/webm" });
        const duracao = Math.round((Date.now() - comecouEmRef.current) / 1000);
        encerrarTudo();
        setEstado("parado");
        setSegundos(0);
        // Gravação de zero segundo é clique sem querer: não vira arquivo.
        if (!blob.size || duracao < 1) return;
        const leitor = new FileReader();
        leitor.onload = () =>
          aoTerminar({
            dataUrl: String(leitor.result),
            segundos: duracao,
            mimeType: "audio/webm",
          });
        leitor.readAsDataURL(blob);
      };
      gravadorRef.current = gravador;
      comecouEmRef.current = Date.now();
      gravador.start();
      setSegundos(0);
      setNiveis([]);
      setEstado("gravando");
      relogioRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      encerrarTudo();
      setEstado("parado");
      setErro("Não deu pra acessar o microfone. Confira a permissão do navegador para este site.");
    }
    // `aoTerminar` costuma ser uma função nova a cada render do componente que usa o hook. Ela
    // entra nas dependências porque é ela que recebe o arquivo: usar uma versão velha entregaria
    // o áudio pro bloco errado depois de o canvas mudar.
  }, [encerrarTudo, aoTerminar]);

  const parar = useCallback(() => {
    const gravador = gravadorRef.current;
    if (!gravador || gravador.state === "inactive") return;
    gravador.stop();
  }, []);

  const cancelar = useCallback(() => {
    const gravador = gravadorRef.current;
    if (gravador && gravador.state !== "inactive") {
      // Tira o ouvinte antes de parar: assim o arquivo é descartado em vez de entregue.
      gravador.onstop = null;
      gravador.stop();
    }
    encerrarTudo();
    setEstado("parado");
    setSegundos(0);
    setNiveis([]);
  }, [encerrarTudo]);

  return { estado, segundos, niveis, erro, comecar, parar, cancelar };
}

/** "0:07" — o cronômetro curto que aparece ao lado do botão enquanto grava. */
export function relogioDaGravacao(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
