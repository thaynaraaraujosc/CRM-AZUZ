import type { Metadata } from "next";

export const metadata: Metadata = { title: "Configurações · CRM AZUZ" };

export default function ConfiguracoesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
