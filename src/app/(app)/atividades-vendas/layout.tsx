import type { Metadata } from "next";

import { MenuInteligencia } from "@/components/inteligencia/MenuInteligencia";

export const metadata: Metadata = { title: "Atividades de venda · CRM AZUZ" };

/* A casca de Inteligência comercial: o menu fixo à esquerda, a tela à direita.
   Ver `MenuInteligencia` — ela não mexe no conteúdo desta página. */
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MenuInteligencia>{children}</MenuInteligencia>;
}
