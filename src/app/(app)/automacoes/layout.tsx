import type { Metadata } from "next";

export const metadata: Metadata = { title: "Automações · CRM AZUZ" };

export default function AutomacoesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
