import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-display",
  weight: ["700"],
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-body",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM AZUZ — Painel web",
  description:
    "Painel web do CRM AZUZ: Início, WhatsApp, Funil, Tarefas, Ações, Equipe, Contatos, Tráfego, Relatórios, Automações e Configurações.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
