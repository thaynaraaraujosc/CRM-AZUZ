import { ImageResponse } from "next/og";

/**
 * A imagem que aparece quando alguém compartilha um endereço do CRM.
 *
 * Não existia nenhuma, e é por isso que o WhatsApp mostrava o triângulo da Vercel: sem `og:image`
 * declarada, os aplicativos caem no ícone do site, que era o padrão da hospedagem.
 *
 * Marinho da identidade, o azul vibrante como acento e o nome. Sem gradiente e sem brilho, pelo
 * mesmo motivo do resto do produto: o que precisa acontecer aqui é a pessoa reconhecer de quem é o
 * link antes de clicar, e isso é trabalho de contraste e tipografia.
 */
export const alt = "CRM AZUZ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0b1533",
          color: "#ffffff",
          padding: 88,
        }}
      >
        <div style={{ display: "flex", width: 96, height: 6, background: "#2e6bff", borderRadius: 999 }} />
        <div style={{ display: "flex", fontSize: 108, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 40 }}>
          CRM AZUZ
        </div>
        <div style={{ display: "flex", fontSize: 38, color: "rgba(255,255,255,0.72)", marginTop: 18 }}>
          WhatsApp, funil e automação num só lugar
        </div>
      </div>
    ),
    size,
  );
}
