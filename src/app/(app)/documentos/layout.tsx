import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documentos · CRM AZUZ" };

export default function DocumentosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
