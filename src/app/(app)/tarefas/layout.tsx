import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tarefas · CRM AZUZ" };

export default function TarefasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
