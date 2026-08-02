import type { Metadata } from "next";

export const metadata: Metadata = { title: "Performance de venda · CRM AZUZ" };

export default function PerformanceVendasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
