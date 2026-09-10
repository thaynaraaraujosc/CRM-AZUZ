/**
 * Comparação de número de WhatsApp entre as duas conexões.
 *
 * A API oficial e o QR Code guardam o mesmo número escrito de jeitos diferentes: um vem como
 * "+55 62 9396-1473" e o outro como "556293961473". Comparar como texto diria que são diferentes
 * sempre, e é justamente a igualdade que precisa ser detectada: o MESMO número nas duas conexões é
 * um conflito de verdade, com uma sessão brigando com a outra.
 *
 * Fica separado de `meta.ts` de propósito: aquele arquivo importa `node:crypto` e não pode ser
 * carregado numa tela.
 */

/** Só os dígitos, e o celular brasileiro sempre com o nono dígito. */
export function numeroComparavel(numero: string | null | undefined): string {
  const digitos = (numero ?? "").replace(/\D/g, "");
  // 55 + DDD de 2 dígitos + 8 dígitos é o formato antigo, sem o 9. Vira o atual pra os dois lados
  // baterem mesmo quando uma conexão gravou de um jeito e a outra do outro.
  if (digitos.startsWith("55") && digitos.length === 12) {
    return `${digitos.slice(0, 4)}9${digitos.slice(4)}`;
  }
  return digitos;
}

/** As duas conexões estão no mesmo número? Sem número dos dois lados, não dá pra afirmar nada. */
export function mesmoNumero(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = numeroComparavel(a);
  const y = numeroComparavel(b);
  return x.length > 0 && x === y;
}
