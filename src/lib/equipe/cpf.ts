/**
 * O CPF DE QUEM VAI USAR O CRM.
 *
 * Guardado SÓ COM OS DÍGITOS, e é por isso que esta função existe: "123.456.789-09" e
 * "12345678909" são o mesmo documento, e gravar como foi digitado faria a mesma pessoa parecer
 * duas — do mesmo jeito que telefone com e sem máscara já fazia com contato.
 *
 * A CONFERÊNCIA É O DÍGITO VERIFICADOR, não o tamanho. Onze dígitos quaisquer passam num teste de
 * tamanho, e o erro de digitação mais comum (um número trocado) tem exatamente onze. O cálculo é
 * público e barato, e pega isso na hora em que a pessoa digita — em vez de na hora de emitir um
 * contrato, meses depois.
 *
 * Função pura, sem rede: é regra, e regra tem teste.
 */

/** Só os dígitos. É assim que o CPF é gravado. */
export function digitosDoCpf(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** `123.456.789-09`, pra ler e conferir. Devolve o que veio quando não são onze dígitos. */
export function formatarCpf(valor: string | null | undefined): string {
  const d = digitosDoCpf(valor);
  if (d.length !== 11) return valor ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** O dígito verificador de uma parte do CPF, pelo algoritmo oficial (módulo 11). */
function digitoVerificador(base: string): number {
  const peso = base.length + 1;
  const soma = base.split("").reduce((total, n, i) => total + Number(n) * (peso - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/**
 * O CPF é válido?
 *
 * Vazio é VÁLIDO de propósito: o campo é opcional, e ninguém fica de fora da equipe por não ter
 * preenchido um documento. Quem exige é a tela, quando exigir.
 */
export function cpfValido(valor: string | null | undefined): boolean {
  const d = digitosDoCpf(valor);
  if (!d) return true;
  if (d.length !== 11) return false;
  // Onze dígitos iguais passam no cálculo do módulo 11 e não são CPF de ninguém: "111.111.111-11"
  // é o exemplo que todo mundo digita pra testar.
  if (/^(\d)\1{10}$/.test(d)) return false;
  return (
    digitoVerificador(d.slice(0, 9)) === Number(d[9]) && digitoVerificador(d.slice(0, 10)) === Number(d[10])
  );
}
