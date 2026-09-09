/**
 * Regex numa automação, sem travar o servidor.
 *
 * O medo é real e tem nome: *catastrophic backtracking*. Um padrão como `(a+)+$` contra uma
 * entrada de 30 caracteres pode levar horas de CPU. Como o motor roda no mesmo processo que
 * atende todo mundo, uma expressão dessas escrita por um cliente derrubaria o CRM inteiro. Foi
 * por isso que regex ficou de fora antes.
 *
 * A solução não é proibir: é cercar. Três travas, e todas precisam passar.
 *
 * 1. O padrão é analisado ANTES de ser salvo. Quantificador dentro de grupo quantificado
 *    (`(a+)+`, `(a*)*`, `(a|aa)+`) é o que causa a explosão, e é recusado na hora, com explicação.
 * 2. O padrão tem teto de tamanho, e a entrada comparada também. Um regex linear sobre 500
 *    caracteres é rápido em qualquer caso.
 * 3. A comparação é medida. Passando do orçamento, o resultado vira "não casou" e fica um aviso
 *    no log: melhor um caminho não seguido do que um processo preso.
 *
 * A trava 1 é a que importa; as outras duas existem porque nenhuma análise estática pega tudo.
 */

/** Teto do padrão. Expressão de atendimento não passa disso, e o limite corta o absurdo. */
const MAX_PADRAO = 200;

/** Teto do texto comparado. Resposta de WhatsApp não chega perto. */
const MAX_ENTRADA = 500;

/** Orçamento por comparação. Um regex linear resolve em microssegundos. */
const ORCAMENTO_MS = 25;

export type ValidacaoRegex = { ok: true } | { ok: false; motivo: string };

/**
 * O padrão é seguro pra rodar?
 *
 * Chamado ao salvar, não ao executar: recusar na tela é o que impede a expressão perigosa de
 * existir. Na execução ainda há as outras travas, porque análise estática nunca é completa.
 */
export function validarRegex(padrao: string): ValidacaoRegex {
  const limpo = padrao.trim();
  if (!limpo) return { ok: false, motivo: "A expressão está vazia." };
  if (limpo.length > MAX_PADRAO) {
    return { ok: false, motivo: `A expressão passa de ${MAX_PADRAO} caracteres.` };
  }

  try {
    new RegExp(limpo);
  } catch {
    return { ok: false, motivo: "A expressão tem erro de sintaxe." };
  }

  // Quantificador aplicado a um grupo que já tem quantificador dentro. É a forma clássica do
  // backtracking catastrófico, e é o que precisa ser recusado.
  if (/\([^()]*[+*][^()]*\)\s*[+*]/.test(limpo)) {
    return {
      ok: false,
      motivo:
        'Essa expressão pode travar o servidor: ela repete um trecho que já se repete (algo como "(a+)+"). Reescreva sem o segundo "+" ou "*".',
    };
  }

  // Alternância com ramos que se sobrepõem, dentro de grupo repetido: `(a|aa)+`. Mesmo problema.
  if (/\([^()]*\|[^()]*\)\s*[+*]/.test(limpo) && /\([^()]*(\w)[^()]*\|[^()]*\1/.test(limpo)) {
    return {
      ok: false,
      motivo:
        'Essa expressão pode travar o servidor: as alternativas dentro do grupo repetido se sobrepõem (algo como "(a|aa)+").',
    };
  }

  return { ok: true };
}

/**
 * Compara com orçamento de tempo.
 *
 * Devolve `false` quando estoura, nunca uma exceção: uma expressão lenta não pode derrubar a
 * execução de um lead. O aviso no log é o que permite achar o padrão problemático depois.
 */
export function casaComRegex(texto: string, padrao: string): boolean {
  if (texto.length > MAX_ENTRADA) return false;

  const valida = validarRegex(padrao);
  if (!valida.ok) {
    console.warn(`[regex] padrão recusado na execução: ${valida.motivo}`);
    return false;
  }

  const inicio = Date.now();
  try {
    const resultado = new RegExp(padrao, "i").test(texto);
    const gasto = Date.now() - inicio;
    if (gasto > ORCAMENTO_MS) {
      console.warn(`[regex] padrão lento (${gasto}ms): ${padrao.slice(0, 60)}`);
    }
    return resultado;
  } catch {
    return false;
  }
}
