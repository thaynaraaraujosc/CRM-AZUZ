"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * A pílula de oferta que acompanha a rolagem.
 *
 * Aparece só depois que o herói sai da tela. Enquanto ele está visível os dois botões grandes já
 * estão ali, e uma terceira chamada por cima seria barulho em cima de quem ainda nem leu a
 * proposta. Da segunda tela em diante a pessoa está longe do botão, e é aí que a pílula serve.
 *
 * `IntersectionObserver` no próprio herói em vez de escutar o evento de rolagem: o navegador avisa
 * quando ele entra e sai do campo de visão, sem rodar código a cada pixel. Escutar `scroll` numa
 * página longa é justamente o tipo de coisa que faz o dedo travar no celular.
 *
 * Dá pra fechar. A referência não deixa, mas lá a barra vive numa página de curso; aqui ela fica
 * sobre uma página que a pessoa pode querer ler inteira antes de decidir, e barra que não fecha
 * vira adesivo. Fechou, some até recarregar.
 */
export function PilulaDeOferta({ preco }: { preco: string }) {
  const [visivel, setVisivel] = useState(false);
  const [fechada, setFechada] = useState(false);
  const jaObservou = useRef(false);

  useEffect(() => {
    if (jaObservou.current) return;
    const heroi = document.querySelector(".lp-hero");
    if (!heroi || typeof IntersectionObserver === "undefined") return;
    jaObservou.current = true;

    const observador = new IntersectionObserver(
      ([entrada]) => setVisivel(!entrada.isIntersecting),
      { threshold: 0 },
    );
    observador.observe(heroi);
    return () => observador.disconnect();
  }, []);

  if (fechada) return null;

  return (
    <div className={`lp-oferta${visivel ? " lp-oferta-visivel" : ""}`} aria-hidden={!visivel}>
      <span className="lp-oferta-selo">{preco}/mês</span>
      <Link href="/cadastro" className="lp-oferta-link" tabIndex={visivel ? 0 : -1}>
        Criar conta agora
      </Link>
      <button
        type="button"
        className="lp-oferta-fechar"
        aria-label="Fechar oferta"
        tabIndex={visivel ? 0 : -1}
        onClick={() => setFechada(true)}
      >
        ×
      </button>
    </div>
  );
}
