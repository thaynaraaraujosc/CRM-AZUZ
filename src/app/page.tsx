import type { Metadata } from "next";

import { PaginaInicial } from "@/components/landing/PaginaInicial";

export const metadata: Metadata = {
  title: "CRM AZUZ: WhatsApp, funil e automação num só lugar",
  description:
    "O CRM que centraliza WhatsApp, Instagram, funil de vendas, automações e IA num painel só. Experimente o CRM AZUZ.",
};


/**
 * A página pública continua sendo Server Component porque exporta `metadata`, e o Next recusa
 * `metadata` num arquivo marcado com "use client". O conteúdo mora em `PaginaInicial`, que é
 * cliente: ele precisa do hook de idioma, porque esta é a PRIMEIRA tela que alguém vê — inclusive
 * o analista da Meta, que começa a gravação aqui, deslogado, e precisa achar a chave PT/EN antes
 * de qualquer outra coisa.
 */
export default function Page() {
  return <PaginaInicial />;
}
