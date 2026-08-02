import type { Metadata } from "next";

export const metadata: Metadata = { title: "Equipe · CRM AZUZ" };

export default function EquipeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
