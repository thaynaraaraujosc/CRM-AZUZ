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
/**
 * OS GATILHOS DE RELÓGIO, a lista única.
 *
 * Mora aqui, e não em `gatilhos-tempo.ts`, porque aquele arquivo importa o Prisma e este é
 * chamado também do caminho de salvamento. Duas listas em dois arquivos divergiriam na primeira
 * vez que alguém acrescentasse um gatilho de tempo — e divergir aqui significa um fluxo que a
 * varredura deixa de olhar, sem erro em lugar nenhum.
 */
export const TIPOS_DE_GATILHO_DE_TEMPO = [
  "aniversario",
  "data_personalizada",
  "horario_programado",
  "lead_parado_etapa",
  "tarefa_vencida",
  "lead_nao_respondeu",
] as const;

const DE_TEMPO = new Set<string>(TIPOS_DE_GATILHO_DE_TEMPO);

/**
 * COM VÁRIOS GATILHOS, o de TEMPO tem preferência.
 *
 * A coluna serve a uma pergunta só: "a varredura de minuto em minuto precisa olhar este fluxo?".
 * Ela é consultada com `gatilhoTipo IN (…tipos de tempo…)`. Num fluxo que responde a comentário E
 * dispara todo dia às 12h, guardar "comentário" porque ele vem primeiro nos `nodes` faria a
 * varredura pular o fluxo — e o disparo das 12h simplesmente não aconteceria, sem erro nenhum.
 *
 * Nos fluxos sem gatilho de tempo (a maioria) o valor continua sendo o do primeiro bloco: ali a
 * coluna só precisa não ser um dos tipos de tempo.
 */
export function tipoDoGatilhoDosNodes(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  const gatilhos = (nodes as { category?: string; type?: string }[]).filter((n) => n?.category === "gatilho");
  const deTempo = gatilhos.find((n) => n.type && DE_TEMPO.has(n.type));
  return (deTempo ?? gatilhos[0])?.type ?? "";
}
