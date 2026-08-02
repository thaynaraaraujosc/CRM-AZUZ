import type { Metadata } from "next";

export const metadata: Metadata = { title: "WhatsApp · CRM AZUZ" };

export default function ConversasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
