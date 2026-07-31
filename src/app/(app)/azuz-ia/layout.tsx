import type { Metadata } from "next";

export const metadata: Metadata = { title: "Azuz IA · CRM AZUZ" };

export default function AzuzIaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
