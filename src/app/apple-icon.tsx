import { ImageResponse } from "next/og";

/** Mesma marca do `icon.tsx`, no tamanho que o iPhone usa quando alguém salva o CRM na tela de
 *  início. Sem este arquivo o iOS recorta uma miniatura da página, que fica ilegível. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1533",
          color: "#ffffff",
          fontSize: 132,
          // A fonte embutida do gerador de imagem não tem negrito, então `fontWeight` não
          // muda nada aqui: quem dá presença à letra é o TAMANHO. Sem isso o "A" saía fino
          // demais pra ser reconhecido a 16px na aba do navegador.
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        A
      </div>
    ),
    size,
  );
}
