"use client";

import { useEffect } from "react";

/**
 * Faz cada seção da landing aparecer quando ela chega na tela, em vez de a página inteira já
 * nascer montada.
 *
 * A landing tinha uma cascata de entrada só no topo (`lp-entrar`), com atraso fixo. O efeito
 * prático era nenhum: tudo que está abaixo da dobra terminava de animar antes de a pessoa rolar
 * até lá, então da segunda tela em diante o site era uma imagem comprida e parada.
 *
 * `IntersectionObserver` em vez de escutar o evento de rolagem: o navegador avisa quando o
 * elemento entra no campo de visão, sem rodar código a cada pixel rolado. Uma vez revelado, o
 * elemento sai da observação — reaparecer ao rolar pra cima de novo vira enjoo, não charme.
 *
 * `rootMargin` negativo embaixo: o elemento só conta como visível depois de entrar uns 12% na
 * tela. Sem isso ele começa a animar ainda encostado na borda inferior e a pessoa nunca vê o
 * movimento, só o estado final.
 *
 * Quem pediu menos movimento no sistema operacional não recebe nenhum: a consulta de mídia é
 * verificada aqui e no CSS, e o elemento é marcado como revelado na hora.
 *
 * NÃO PONHA UM TEMPORIZADOR DE SEGURANÇA AQUI. A tentação é óbvia — "se em N segundos nada
 * apareceu, revela tudo" —, e eu caí nela: com três segundos, uma pessoa que lê o topo antes de
 * rolar chega embaixo e encontra tudo já revelado, sem movimento nenhum. O temporizador não
 * protege de nada real e desliga o recurso justamente para quem lê com calma. As duas falhas que
 * de fato existem já têm saída: sem JavaScript, o <noscript> da página revela tudo; sem
 * IntersectionObserver, a verificação logo abaixo revela tudo.
 */
export function RevelarAoRolar() {
  useEffect(() => {
    const alvos = document.querySelectorAll<HTMLElement>("[data-revelar]");
    if (alvos.length === 0) return;

    const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (menosMovimento || typeof IntersectionObserver === "undefined") {
      alvos.forEach((alvo) => alvo.classList.add("lp-revelado"));
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.classList.add("lp-revelado");
          observador.unobserve(entrada.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    alvos.forEach((alvo) => observador.observe(alvo));
    return () => observador.disconnect();
  }, []);

  return null;
}
