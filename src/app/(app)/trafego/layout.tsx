import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tráfego · CRM AZUZ" };

export default function TrafegoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
