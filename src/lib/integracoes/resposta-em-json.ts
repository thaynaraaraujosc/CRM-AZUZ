import { NextResponse } from "next/server";

/**
 * Garante que uma rota NUNCA responda com corpo vazio.
 *
 * O defeito que isto corrige apareceu em produção em 14/10/2026: o botão "Gerar chave" falhava com
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input`. O servidor tinha lançado
 * exceção, o Next devolveu 500 sem corpo, e o navegador quebrou ao tentar ler JSON de nada. A
 * pessoa via um erro de JavaScript em inglês no lugar de qualquer pista do que havia acontecido.
 *
 * Então a regra passa a ser do CORPO, não do caso: toda rota que a tela consome responde JSON em
 * toda saída, inclusive na que ninguém previu. Um `try/catch` por rota faria o mesmo, mas seria uma
 * regra escrita cinco vezes — e uma regra escrita cinco vezes é uma que um dia vai faltar na sexta.
 */

/** Marcas de "o banco não tem a estrutura que este código espera". */
const CODIGOS_DE_ESTRUTURA = ["P2021", "P2022"];
const TEXTOS_DE_ESTRUTURA = ["doesn't exist", "does not exist", "Unknown column", "Unknown table"];

/**
 * O banco está atrás do código?
 *
 * `P2021` é tabela que não existe e `P2022` é coluna que não existe. Vale distinguir esse caso de
 * uma falha qualquer porque ele tem uma causa específica e uma correção específica: o schema não
 * foi aplicado neste ambiente. Dizer isso na tela é a diferença entre "deu erro" e "falta rodar a
 * sincronização do banco".
 */
export function ehEstruturaDesatualizada(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  const codigo = (erro as { code?: unknown }).code;
  if (typeof codigo === "string" && CODIGOS_DE_ESTRUTURA.includes(codigo)) return true;
  const mensagem = (erro as { message?: unknown }).message;
  return typeof mensagem === "string" && TEXTOS_DE_ESTRUTURA.some((t) => mensagem.includes(t));
}

export const AVISO_DE_ESTRUTURA =
  "O banco deste ambiente está sem a estrutura desta versão do CRM. Rode a sincronização do schema e tente de novo.";

export function respostaDeErro(status: number, erro: string): NextResponse {
  return NextResponse.json({ ok: false, erro }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Roda o corpo da rota e transforma exceção em JSON.
 *
 * `rotulo` entra no log do servidor pra dar pra achar qual rota foi. Nunca entra na resposta: a
 * mensagem técnica fica no servidor, e quem está na tela recebe uma frase que diz o que fazer. É a
 * mesma divisão que a rota de leads já usava.
 */
export async function comRespostaEmJson(
  rotulo: string,
  // `Response` e não `NextResponse`: algumas recusas (corpo grande demais) devolvem `Response` cru,
  // e o envelope não pode ser o motivo de ninguém poder usá-las.
  corpo: () => Promise<Response>,
): Promise<Response> {
  try {
    return await corpo();
  } catch (erro) {
    console.error(`[${rotulo}] falhou:`, erro instanceof Error ? erro.message : erro);
    if (ehEstruturaDesatualizada(erro)) return respostaDeErro(503, AVISO_DE_ESTRUTURA);
    return respostaDeErro(500, "Não deu pra concluir agora. Tente de novo em instantes.");
  }
}
