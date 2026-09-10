/**
 * O tipo do bloco de gatilho de um fluxo, extraído dos `nodes`.
 *
 * Isto vira a coluna `FluxoAutomacao.gatilhoTipo`, e a coluna existe por causa de dinheiro: a
 * varredura de gatilhos de relógio roda a cada minuto, pra sempre, e sem ela a única forma de
 * saber quais fluxos têm gatilho de tempo era ler `nodes` de todos os fluxos publicados. Ler a
 * linha traz junto `edges`, `configuracoes` e `historicoVersoes` (o histórico inteiro do
 * fluxograma), quatro colunas Json saindo do banco 43.200 vezes por mês. Ver `gatilhos-tempo.ts`.
 *
 * Escrito em TODO salvamento de fluxo. Sem isso, trocar o bloco de gatilho de "mensagem recebida"
 * para "aniversário" deixaria a coluna com o valor velho, e o fluxo nunca dispararia: um defeito
 * silencioso, do tipo que só aparece no dia do aniversário de alguém.
 *
 * Fluxo sem bloco de gatilho devolve string VAZIA, não `null`. `null` significa "ainda não
 * calculado" e faz a varredura ler `nodes` daquele fluxo de novo a cada rodada, pra sempre.
 */
export function tipoDoGatilhoDosNodes(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  const gatilho = (nodes as { category?: string; type?: string }[]).find((n) => n?.category === "gatilho");
  return gatilho?.type ?? "";
}
