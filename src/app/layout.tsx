import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
/* DEPOIS do globals, e isso importa: as regras daqui têm a mesma força de algumas de lá
   (`:root[data-theme="dark"] .input` e `:root .painel-formularios .input` valem 3 classes cada), e
   num empate quem vence é a última do arquivo. */
import "./formularios-painel.css";
import { IdiomaProvider } from "@/lib/idioma-context";

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


/*
 * UMA FONTE BAIXADA, E SÓ UMA, PARA UM MÓDULO SÓ.
 *
 * Poppins e Montserrat saíram daqui porque nenhuma tela as referenciava — baixar família de fonte
 * que ninguém usa é custo sem retorno. O resto do produto segue em Arial, fonte de sistema (ver
 * `--pilha-sistema` no globals.css), e isso não mudou.
 *
 * A Inter volta por um motivo concreto: o Social Seller foi desenhado contra uma referência que
 * usa Inter em tudo (ver `docs/referencia-gaio.md`), e tipografia é a metade do "parece o mesmo
 * produto" que nenhuma cor resolve. Ela entra como VARIÁVEL e é aplicada só dentro do módulo —
 * nenhuma outra tela do CRM troca de fonte por causa disto.
 *
 * É variável (um arquivo serve todos os pesos) e `display: "swap"`, então ela não segura a
 * primeira pintura: o texto aparece na fonte de sistema e troca quando a Inter chega.
 */
const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });

export const metadata: Metadata = {
  /**
   * Sem isto, `og:image` sai como caminho relativo, e aplicativo de mensagem não busca imagem
   * relativa: ele precisa do endereço completo pra ir atrás do arquivo. Era mais um motivo pra
   * prévia do link cair no ícone do site em vez da imagem própria.
   */
  metadataBase: new URL(process.env.APP_URL ?? "https://azuzcrm.com.br"),
  title: "CRM AZUZ: Painel web",
  description:
    "Painel web do CRM AZUZ: Início, WhatsApp, Funil, Tarefas, Ações, Equipe, Contatos, Tráfego, Relatórios, Automações, Azuz IA e Configurações.",
  // Prova de propriedade do domínio pro Business Manager da Meta (verificação de negócio).
  // Gerado uma vez no painel deles, não é segredo (fica público no <head> de qualquer jeito).
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
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <Script id="tema-inicial" strategy="beforeInteractive">
          {SCRIPT_TEMA_INICIAL}
        </Script>
        <IdiomaProvider>{children}</IdiomaProvider>
      </body>
    </html>
  );
}
