import type { AreaAutomacao } from "@/lib/canais/capacidades";

/**
 * ONDE MORA O EDITOR DE CADA ÁREA.
 *
 * "Quando eu estou automatizando o Social Seller, fica parecendo que eu estou dentro de
 * Automações. Mas automações e Social Seller são blocos separados. Se eu estiver fazendo uma
 * automação lá no Social Seller, de forma alguma deve estar aparecendo que eu estou dentro de
 * Automações."
 *
 * Ela estava certa, e a causa não era desenho: era o ENDEREÇO. O editor dos dois módulos morava
 * em `/automacoes/editor/<id>`, e a barra lateral marca o item ativo pelo começo da URL. Abrindo
 * um robô do Instagram, a lateral acendia "Automações", a aba de Automações acendia junto, e o
 * CRM inteiro afirmava que ela estava no outro módulo. Nenhuma migalha ia consertar isso: a tela
 * estava dizendo a verdade sobre onde ela estava.
 *
 * Agora cada área tem o seu endereço, e as duas rotas se corrigem: abrir um robô social pelo
 * endereço antigo manda pro novo, e vice-versa (ver as duas `page.tsx` do editor). É o que faz
 * link velho, favorito e histórico continuarem funcionando sem ninguém precisar saber disso.
 */
export function caminhoDoEditor(area: AreaAutomacao | string | null | undefined, fluxoId: string): string {
  return area === "social" ? `/social-seller/editor/${fluxoId}` : `/automacoes/editor/${fluxoId}`;
}

/** A área a que um endereço de editor pertence. */
export function areaDoCaminho(pathname: string | null | undefined): AreaAutomacao | null {
  if (!pathname) return null;
  if (pathname.startsWith("/social-seller/editor")) return "social";
  if (pathname.startsWith("/automacoes/editor")) return "comercial";
  return null;
}

/** O endereço é um editor de fluxo, de qualquer uma das duas áreas? */
export function ehCaminhoDeEditor(pathname: string | null | undefined): boolean {
  return areaDoCaminho(pathname) !== null;
}
