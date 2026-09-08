import { ImageResponse } from "next/og";

import { prisma } from "@/lib/prisma";

/**
 * A prévia do link de um formulário.
 *
 * Mostra o NOME do formulário, não o do CRM. Quem recebe "Cliente novo" entende o que vai
 * responder antes de abrir; quem recebe "Painel web do CRM AZUZ: Início, WhatsApp, Funil…" (a
 * descrição genérica que aparecia antes, herdada do layout) não entende nada, e um link que não se
 * explica é um link que não se clica.
 *
 * Lê direto do banco, sem sessão: é a mesma informação que a página pública já mostra pra qualquer
 * um que abra o link.
 */
export const alt = "Formulário";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formulario = await prisma.formulario
    .findUnique({ where: { id }, select: { nome: true } })
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
        <div style={{ display: "flex", width: 96, height: 6, background: "#2e6bff", borderRadius: 999 }} />
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginTop: 36,
            lineHeight: 1.15,
          }}
        >
          {formulario?.nome || "Formulário"}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.68)", marginTop: 22 }}>
          Leva menos de um minuto pra responder
        </div>
      </div>
    ),
    size,
  );
}
