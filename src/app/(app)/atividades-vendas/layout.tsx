import type { Metadata } from "next";

export const metadata: Metadata = { title: "Atividades de venda · CRM AZUZ" };

export default function AtividadesVendasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
