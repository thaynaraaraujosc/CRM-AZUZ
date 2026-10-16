import type { ReactNode } from "react";

import type { Trecho } from "@/lib/conversas/formatacao-mensagem";

/**
 * Desenha o texto da mensagem já interpretado.
 *
 * Só desenho: toda a decisão de o que é menção, endereço, telefone ou negrito mora em
 * `formatacao-mensagem.ts`, que é puro e testado sem navegador. Aqui não há regra nenhuma pra
 * errar — o que chega já está classificado.
 */
export function renderizarTrechos(trechos: Trecho[], traduzir: (texto: string) => string): ReactNode[] {
  return trechos.map((trecho, i) => {
    switch (trecho.tipo) {
      case "texto":
        return <span key={i}>{trecho.valor}</span>;

      case "negrito":
        // `<strong>`, e não um `<span>` com peso: quem escreveu `*assim*` quis dar ênfase, e leitor
        // de tela precisa ouvir isso. CSS pinta; a marcação diz o que a coisa é.
        return <strong key={i}>{renderizarTrechos(trecho.partes, traduzir)}</strong>;

      case "link":
        return (
          <a key={i} href={trecho.href} target="_blank" rel="noopener noreferrer" className="wa-link-mensagem">
            {trecho.rotulo}
          </a>
        );

      case "mencao":
        // Sem link e sem atalho: marcar alguém é citar, não é oferecer uma ligação. O destaque é só
        // visual, igual ao WhatsApp.
        return (
          <span key={i} className="wa-mencao">
            @{trecho.rotulo}
          </span>
        );

      case "telefone":
        return (
          <span key={i} className="wa-telefone-detectado">
            {trecho.rotulo}
            <span className="wa-telefone-acoes">
              <a
                href={`https://wa.me/${trecho.numero}`}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-telefone-acao"
              >
                WhatsApp
              </a>
              <a href={`tel:+${trecho.numero}`} className="wa-telefone-acao">
                {traduzir("Ligar")}
              </a>
            </span>
          </span>
        );
    }
  });
}
