import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const SCRIPT_TEMA_INICIAL = `
(function () {
  try {
    var tema = localStorage.getItem("azuz-crm-tema");
    if (tema === "dark" || tema === "light") {
      document.documentElement.setAttribute("data-theme", tema);
    }
  } catch (e) {}
})();
`;

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

/* A área interna usa Arial (fonte de sistema, sem download) — ver `--display`/`--body` no
   globals.css. Poppins e Montserrat continuam aqui porque a landing page ainda as usa. */

export const metadata: Metadata = {
  title: "CRM AZUZ — Painel web",
  description:
    "Painel web do CRM AZUZ: Início, WhatsApp, Funil, Tarefas, Ações, Equipe, Contatos, Tráfego, Relatórios, Automações, Azuz IA e Configurações.",
  // Prova de propriedade do domínio pro Business Manager da Meta (verificação de negócio) —
  // gerado uma vez no painel deles, não é segredo (fica público no <head> de qualquer jeito).
  verification: {
    other: { "facebook-domain-verification": "93gk9hohnqd8s4triwtdsfe3s2es9t" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${montserrat.variable}`}>
      <body>
        <Script id="tema-inicial" strategy="beforeInteractive">
          {SCRIPT_TEMA_INICIAL}
        </Script>
        {children}
      </body>
    </html>
  );
}
