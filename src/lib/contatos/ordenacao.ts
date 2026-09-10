import type { Contato } from "@/lib/data";

/**
 * Como a lista de contatos é ordenada, e como a origem gravada vira o filtro da tela.
 *
 * Fora da página de propósito: a mesma regra vale pra qualquer lista de contato que apareça
 * depois (escolher público de um disparo, por exemplo), e duas cópias divergiriam na primeira
 * correção feita só de um lado.
 */
export type OrdemContatos = "az" | "za" | "recentes" | "interacao";

export const ORDENS: { valor: OrdemContatos; label: string }[] = [
  { valor: "az", label: "Nome A → Z" },
  { valor: "za", label: "Nome Z → A" },
  { valor: "recentes", label: "Mais recentes" },
  { valor: "interacao", label: "Última interação" },
];

/**
 * A origem gravada no banco traduzida pro rótulo do filtro.
 *
 * Duas traduções, e as duas existem por causa de dado que já está lá:
 *
 * - "Indicação" era a origem de todo contato salvo à mão antes desta mudança. Continua no banco,
 *   e cai em "Salvo manualmente", que é o que ele sempre foi de verdade. Sem isto, esses contatos
 *   sumiriam de todos os filtros menos "Todos".
 * - "Direto", "Meta Ads", "Google Ads", "Formulário" e qualquer outra origem antiga não têm chip
 *   próprio hoje. Devolvem a própria string: não casam com nenhum filtro, e continuam aparecendo
 *   em "Todos". Some do recorte, nunca da lista.
 */
export function origemNoFiltro(origem: string): string {
  if (origem === "Indicação") return "Salvo manualmente";
  return origem;
}

/** Comparação de nome em português: acento e caixa não mudam a ordem. */
const COLETOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Converte o texto de "última interação" numa ordem aproximada.
 *
 * `Contato.ultima` é uma frase ("Hoje", "Há 2h", "29/08"), não uma data: é assim que ela é gravada
 * hoje. Ordenar por ela exige interpretar, e a interpretação é aproximada de propósito, com o
 * cuidado de nunca inventar precisão: o que importa é "hoje vem antes de agosto", não a hora exata.
 *
 * Devolve MINUTOS atrás. Desconhecido vai pro fim (Infinity), nunca pro topo: um contato sem
 * informação não pode se passar pelo mais recente.
 */
function minutosAtras(ultima: string | undefined): number {
  if (!ultima) return Number.POSITIVE_INFINITY;
  const texto = ultima.trim().toLowerCase();
  if (!texto) return Number.POSITIVE_INFINITY;
  if (texto === "agora" || texto.startsWith("agora")) return 0;
  if (texto === "hoje") return 1;
  if (texto === "ontem") return 60 * 24;

  const relativo = texto.match(/h[áa]\s*(\d+)\s*(min|h|dia|semana|m[êe]s|ano)/);
  if (relativo) {
    const n = Number(relativo[1]);
    const unidade = relativo[2];
    if (unidade === "min") return n;
    if (unidade === "h") return n * 60;
    if (unidade === "dia") return n * 60 * 24;
    if (unidade === "semana") return n * 60 * 24 * 7;
    if (unidade.startsWith("m")) return n * 60 * 24 * 30;
    return n * 60 * 24 * 365;
  }

  // "29/08" ou "29/08/2026". Sem ano, assume o ano corrente; data no futuro vira o ano passado,
  // porque "31/12" visto em janeiro é do ano que terminou, não do que vai começar.
  const data = texto.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
  if (data) {
    const agora = new Date();
    const ano = data[3] ? Number(data[3]) : agora.getFullYear();
    const quando = new Date(ano, Number(data[2]) - 1, Number(data[1]));
    if (!data[3] && quando.getTime() > agora.getTime()) quando.setFullYear(ano - 1);
    return Math.max(0, (agora.getTime() - quando.getTime()) / 60000);
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Devolve uma NOVA lista ordenada. Não mexe na original.
 *
 * "Mais recentes" usa a ordem em que os contatos chegaram da API, que é a de criação: por isso o
 * índice original entra na conta em vez de um campo de data, que a lista da tela não carrega.
 */
export function ordenarContatos<T extends Pick<Contato, "nome" | "ultima">>(
  contatos: T[],
  ordem: OrdemContatos,
): T[] {
  const comIndice = contatos.map((c, i) => ({ c, i }));

  comIndice.sort((a, b) => {
    switch (ordem) {
      case "az":
        return COLETOR.compare(a.c.nome, b.c.nome);
      case "za":
        return COLETOR.compare(b.c.nome, a.c.nome);
      case "recentes":
        return b.i - a.i;
      case "interacao": {
        const diferenca = minutosAtras(a.c.ultima) - minutosAtras(b.c.ultima);
        // Empate (dois "Hoje", dois desconhecidos) desempata pelo nome, pra a ordem ser estável e
        // a lista não dançar entre um carregamento e outro.
        return diferenca !== 0 ? diferenca : COLETOR.compare(a.c.nome, b.c.nome);
      }
    }
  });

  return comIndice.map((x) => x.c);
}
