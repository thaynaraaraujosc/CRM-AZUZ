import { ImageResponse } from "next/og";

/**
 * O ícone que aparece na aba do navegador e no atalho salvo.
 *
 * O projeto vinha com o `favicon.ico` que o `create-next-app` gera, que é o triângulo da Vercel.
 * Ele aparecia na aba, no atalho e, o pior, na PRÉVIA DO LINK no WhatsApp: quando não há imagem de
 * compartilhamento declarada, os aplicativos caem no ícone do site. Cliente recebendo o link de um
 * formulário via a marca da hospedagem, não a do CRM.
 *
 * Desenhado por código, e não por arquivo, de propósito: o CRM não tem um arquivo de logo no
 * repositório, e um ícone gerado a partir dos MESMOS tokens da interface (marinho de fundo, azul
 * vibrante no acento) não sai do lugar quando a identidade mudar. Trocar por um arquivo depois é
 * só apagar isto e pôr um `icon.png` na mesma pasta.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
          color: "#ffffff",
          fontSize: 50,
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
