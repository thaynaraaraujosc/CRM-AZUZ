import type { DicasDaEtapa } from "@/lib/data";

/**
 * A COR E AS DICAS DE UMA ETAPA.
 *
 * As duas são escolhas de quem monta o funil, e as duas chegam do navegador — então nenhuma pode
 * ir pro banco sem passar por aqui. A cor vira atributo de estilo na tela; as dicas viram texto
 * mostrado pra equipe. Lista fechada de um lado, corte de tamanho do outro.
 */

/**
 * A PALETA DA ETAPA: as 21 cores do Kommo, medidas na referência.
 *
 * Lista fechada e não cor livre, e isso é decisão de desenho: com um seletor de cor qualquer, um
 * funil de catorze etapas vira catorze tons sem relação nenhuma entre si, e a cor deixa de
 * distinguir porque tudo distingue. Vinte e uma cores claras, pensadas pra ter texto escuro em
 * cima, mantêm a grade legível por mais que se escolha mal.
 */
export const CORES_DA_ETAPA = [
  "#fffeb2", "#fffd7f", "#fff000",
  "#ffeab2", "#ffdc7f", "#ffce5a",
  "#ffdbdb", "#ffc8c8", "#ff8f92",
  "#d6eaff", "#c1e0ff", "#98cbff",
  "#ebffb1", "#deff81", "#87f2c0",
  "#f9deff", "#f3beff", "#ccc8f9",
  "#eb93ff", "#f2f3f4", "#e6e8ea",
] as const;

const PERMITIDAS = new Set<string>(CORES_DA_ETAPA);

/** A cor escolhida, ou `null` quando ela não está na paleta. */
export function lerCorDaEtapa(cru: unknown): string | null {
  if (typeof cru !== "string") return null;
  const cor = cru.trim().toLowerCase();
  return PERMITIDAS.has(cor) ? cor : null;
}

/** Um teto por texto: a dica é uma orientação curta, não um manual. */
const MAXIMO_DA_DICA = 600;

const NIVEIS = ["iniciante", "intermediario", "expert"] as const;

/** Lê as dicas gravadas, descartando o que não é texto e cortando o que passou do teto. */
export function lerDicas(cru: unknown): DicasDaEtapa | undefined {
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return undefined;
  const o = cru as Record<string, unknown>;
  const saida: DicasDaEtapa = {};
  for (const nivel of NIVEIS) {
    const texto = typeof o[nivel] === "string" ? (o[nivel] as string).trim() : "";
    if (texto) saida[nivel] = texto.slice(0, MAXIMO_DA_DICA);
  }
  return Object.keys(saida).length ? saida : undefined;
}

/** O rótulo de cada nível, pra tela. */
export const ROTULO_DO_NIVEL: Record<(typeof NIVEIS)[number], string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  expert: "Expert",
};
