import type { Metadata } from "next";

export const metadata: Metadata = { title: "CRM Live · CRM AZUZ" };

export default function CrmLiveLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
