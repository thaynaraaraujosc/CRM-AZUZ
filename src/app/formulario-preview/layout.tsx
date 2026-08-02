import type { Metadata } from "next";

export const metadata: Metadata = { title: "Formulário · CRM AZUZ" };

export default function FormularioPreviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
