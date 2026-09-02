import type { Metadata } from "next";
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


/* Não há mais fonte baixada: o produto inteiro usa Arial, que é fonte de sistema (ver
   `--pilha-sistema` no globals.css). Poppins e Montserrat saíram daqui porque ninguém mais as
   referencia — mantê-las carregadas seria baixar duas famílias de fonte que nenhuma tela usa. */

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
    <html lang="pt-BR">
      <body>
        <Script id="tema-inicial" strategy="beforeInteractive">
          {SCRIPT_TEMA_INICIAL}
        </Script>
        {children}
      </body>
    </html>
  );
}
