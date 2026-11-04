import type { Metadata } from "next";

import { BarraDeAutomacoes } from "@/components/automacoes/BarraDeAutomacoes";

export const metadata: Metadata = { title: "Automações · CRM AZUZ" };

/**
 * A barra do módulo mora AQUI, e não em cada página.
 *
 * Antes cada tela renderizava `<AbasAutomacoes />` por conta própria, e tela nova nascia sem as
 * abas até alguém lembrar de pôr. Agora quem entra em qualquer rota de Automações recebe a mesma
 * barra, e ela decide sozinha o que mostrar em cada uma (ver `BarraDeAutomacoes`).
 */
export default function AutomacoesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <BarraDeAutomacoes />
      {children}
    </>
  );
}
