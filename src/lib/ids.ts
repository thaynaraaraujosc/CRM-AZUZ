/**
 * Identificador estável derivado de um nome (contato, empresa, negociação...).
 * Todo o CRM já usa esse mesmo padrão de slug como `id` em `NegocioCard`,
 * `Conversa` e `TaskCard` dentro de `data.ts` (ex.: "Marcos Aurélio" →
 * "marcos-aurelio") — esta função só formaliza a regra num lugar único, pra
 * qualquer módulo novo conseguir cruzar contato/negociação/tarefa/conversa
 * pelo mesmo id sem depender de comparar nome (string) espalhado pelo código.
 */
export function slugId(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
