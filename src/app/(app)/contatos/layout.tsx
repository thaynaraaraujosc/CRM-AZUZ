import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contatos · CRM AZUZ" };

export default function ContatosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
