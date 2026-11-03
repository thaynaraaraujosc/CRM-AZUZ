import type { Metadata } from "next";

export const metadata: Metadata = { title: "Social Seller · CRM AZUZ" };

export default function SocialSellerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
