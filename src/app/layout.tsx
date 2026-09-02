import type { Metadata } from "next";
import { Inter, Inter_Tight, Montserrat, Poppins } from "next/font/google";
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

/**
 * Tipografia da área interna. Poppins e Montserrat continuam existindo, mas só pra landing page e
 * telas de pré-login (ver `.lp-root` no globals.css) — o app logado passa a usar uma grotesca
 * neutra, que é o que dá a leitura editorial da referência: Poppins é geométrica e arredondada
 * demais pra texto de trabalho, e Montserrat é larga, o que come espaço numa tela densa.
 *
 * Fontes variáveis (sem `weight` fixo): a hierarquia aqui depende de usar 300 a 700 no mesmo
 * texto, e carregar peso a peso seria uma requisição por peso.
 */
const interTight = Inter_Tight({
  variable: "--font-ui-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
});

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
    <html lang="pt-BR" className={`${poppins.variable} ${montserrat.variable} ${interTight.variable} ${inter.variable}`}>
      <body>
        <Script id="tema-inicial" strategy="beforeInteractive">
          {SCRIPT_TEMA_INICIAL}
        </Script>
        {children}
      </body>
    </html>
  );
}
