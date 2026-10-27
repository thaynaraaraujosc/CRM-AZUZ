import { enderecoCompleto, separarLinks } from "@/lib/formularios/texto-com-links";

/**
 * Um texto escrito pela empresa, com os endereços clicáveis. Usado no texto da capa: ela costuma
 * apontar pro site ou pra uma página de referência, e um endereço que não abre nada numa tela de
 * apresentação lê como erro.
 */
export function TextoComLinks({ texto, className }: { texto: string; className?: string }) {
  return (
    <p className={className}>
      {separarLinks(texto).map((parte, i) =>
        parte.link ? (
          <a key={i} href={enderecoCompleto(parte.texto)} target="_blank" rel="noopener noreferrer">
            {parte.texto}
          </a>
        ) : (
          <span key={i}>{parte.texto}</span>
        ),
      )}
    </p>
  );
}
