import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

export default async function Image() {
  /**
   * A marca entra como data URI porque o gerador de imagem não busca arquivo por endereço: ele
   * monta a imagem no servidor, antes de existir requisição, então um `/marca/logo.jpg` não
   * resolveria nada. `process.cwd()` é a raiz do projeto.
   */
  const marca = await readFile(join(process.cwd(), "src/app/icon.png"))
    .then((b) => `data:image/png;base64,${b.toString("base64")}`)
    .catch(() => null);

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
        {marca ? (
          <img src={marca} alt="" width={104} height={104} style={{ borderRadius: 26 }} />
        ) : (
          <div style={{ display: "flex", width: 96, height: 6, background: "#2e6bff", borderRadius: 999 }} />
        )}
        <div style={{ display: "flex", fontSize: 100, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 34 }}>
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
