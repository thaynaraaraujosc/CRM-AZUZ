/**
 * O QUE VEIO DA API É MESMO UMA LISTA?
 *
 * "L.find is not a function", a tela inteira branca, às 8h54 de uma aba que ficou aberta a noite
 * toda. O caminho é curto e vale escrever inteiro, porque ele se repete em quinze contextos:
 *
 *   1. A sessão expira enquanto a aba está aberta.
 *   2. O contexto recarrega a lista: `fetch("/api/funis").then((r) => r.json())`.
 *   3. A rota responde `401` com `{ erro: "Não autenticado" }` — um OBJETO.
 *   4. `setFunis(dados)` grava o objeto onde devia haver um array.
 *   5. A primeira tela que faz `funis.find(...)` morre, e leva junto tudo que está dentro da
 *      barreira de erro: no caso, a caixa de entrada inteira.
 *
 * O passo 3 não é defeito — a rota está certa em dizer por que recusou. O defeito é o passo 4
 * confiar que a resposta tem a forma combinada. Um `500` do banco faz exatamente o mesmo, e
 * `.json()` de uma página de erro HTML também.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * POR QUE LISTA VAZIA E NÃO UM ERRO NA TELA.
 *
 * Porque a diferença, pra quem está atendendo, é entre uma tela que mostra "nenhum funil" e uma
 * tela que some. A primeira é recuperável sozinha: a próxima navegação encontra a sessão expirada
 * e leva pro login. A segunda é um beco — "Tentar de novo" recarrega e dá no mesmo, porque a
 * sessão continua expirada.
 *
 * O erro vai pro console, com o nome de quem pediu, pra o sumiço não ser silencioso pra quem
 * investiga. Mas a tela segue de pé, e é ela que a pessoa está usando.
 */
export function listaDaApi<T>(dados: unknown, de: string): T[] {
  if (Array.isArray(dados)) return dados as T[];

  /*
   * O caso comum, e o que mais vale distinguir: a rota recusou e disse por quê. Não é "resposta
   * estranha", é uma resposta correta de um pedido que não podia ser atendido.
   */
  const erro =
    dados && typeof dados === "object" && "erro" in dados
      ? String((dados as { erro: unknown }).erro)
      : `resposta que não é uma lista (${dados === null ? "null" : typeof dados})`;
  console.error(`[api] ${de} não devolveu uma lista: ${erro}`);
  return [];
}
