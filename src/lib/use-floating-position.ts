"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";

export type AnchorRect = Pick<DOMRect, "top" | "bottom" | "left" | "right" | "width" | "height">;

type Posicao = { top: number; left: number };

/**
 * Calcula a posição de um elemento flutuante (dropdown, menu de contexto, popover) portalizado em
 * `document.body`, medindo a altura/largura REAIS do conteúdo já renderizado (via `useLayoutEffect` +
 * `getBoundingClientRect`), em vez de estimar um tamanho fixo — é a mesma técnica que já funcionava
 * bem no menu de contexto de imagem de Documentos, generalizada aqui pra qualquer flutuante do CRM.
 *
 * Flip vertical: abre pra cima se não couber embaixo. Clamp horizontal: nunca deixa vazar pelas
 * laterais. Recalcula em `scroll`/`resize` enquanto está aberto — nenhuma das implementações
 * anteriores de posicionamento flutuante no projeto fazia isso, o que deixava o menu preso na posição
 * errada se a janela fosse redimensionada com ele aberto.
 *
 * `aoFechar` (opcional) — clique fora do flutuante ou tecla Esc chamam esse callback. Sem isso, cada
 * flutuante ficava por conta própria pra fechar sozinho, e boa parte não implementava nada (menu
 * ficava aberto até um clique manual no próprio botão que abriu) — centralizando aqui, todo
 * consumidor do hook ganha o comportamento padrão de propósito só de passar o callback.
 */
export function useFloatingPosition(
  anchorRect: AnchorRect | null,
  aberto: boolean,
  margem = 8,
  aoFechar?: () => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<Posicao | null>(null);

  useEffect(() => {
    if (!aberto || !aoFechar) return;

    function aoClicar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) aoFechar!();
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar!();
    }

    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, aoFechar]);

  useLayoutEffect(() => {
    if (!aberto || !anchorRect) {
      // Limpa a posição medida da abertura anterior pra não vazar posição de outro anchor caso reabra
      // rápido; o valor exposto já vira null aqui de qualquer forma (ver `return` no fim do hook), isso
      // só evita reaproveitar o estado interno.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosicao(null);
      return;
    }

    function calcular() {
      const el = ref.current;
      if (!el || !anchorRect) return;
      const largura = el.offsetWidth;
      const altura = el.offsetHeight;

      let top = anchorRect.bottom + margem;
      if (top + altura > window.innerHeight - margem) {
        const acima = anchorRect.top - altura - margem;
        top = acima >= margem ? acima : Math.max(margem, window.innerHeight - altura - margem);
      }

      let left = anchorRect.left;
      if (left + largura > window.innerWidth - margem) {
        left = window.innerWidth - largura - margem;
      }
      if (left < margem) left = margem;

      setPosicao({ top, left });
    }

    calcular();
    window.addEventListener("scroll", calcular, true);
    window.addEventListener("resize", calcular);
    return () => {
      window.removeEventListener("scroll", calcular, true);
      window.removeEventListener("resize", calcular);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchorRect é um objeto novo a cada render; comparamos pelos campos primitivos abaixo
  }, [aberto, anchorRect?.top, anchorRect?.bottom, anchorRect?.left, anchorRect?.right, margem]);

  // Posição "ingênua" (sem medir o conteúdo ainda) usada só no primeiro paint — sem ela o elemento
  // nunca chegaria a ser montado pra `useLayoutEffect` poder medir e corrigir (problema do ovo e da
  // galinha). `useLayoutEffect` roda antes do navegador pintar a tela, então a correção é invisível.
  const posicaoInicial: Posicao | null = anchorRect
    ? { top: anchorRect.bottom + margem, left: anchorRect.left }
    : null;

  return { ref, posicao: aberto ? (posicao ?? posicaoInicial) : null };
}
