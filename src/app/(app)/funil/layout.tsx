import type { Metadata } from "next";

export const metadata: Metadata = { title: "Funil · CRM AZUZ" };

export default function FunilLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
