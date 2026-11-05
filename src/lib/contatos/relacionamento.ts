/**
 * HÁ QUANTO TEMPO ESSA PESSOA É CONTATO NOSSO.
 *
 * É a primeira coisa que se quer saber ao abrir a ficha de alguém — "cliente desde quando?" — e
 * era a única que o painel não respondia: ele mostrava treze campos de cadastro e nenhum número.
 *
 * Mora aqui, e não dentro do componente, porque ler o relógio durante o render é impuro pro
 * compilador do React: a função é chamada na renderização, mas o `new Date()` acontece dentro
 * dela, como em `funis/atividade.ts`. E porque uma regra de arredondamento ("30 dias viram 1
 * mês") precisa de teste, não de confiança.
 */
export function diasDesde(quando: Date | string | null | undefined, agora: Date = new Date()): number | null {
  if (!quando) return null;
  const data = quando instanceof Date ? quando : new Date(quando);
  if (Number.isNaN(data.getTime())) return null;
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(agora) - inicio(data)) / 86_400_000);
  // Data no futuro (relógio torto) conta como hoje: "há -2 dias" não ajuda ninguém.
  return dias < 0 ? 0 : dias;
}

/**
 * O mesmo número, dito como se fala: "hoje", "12 dias", "3 meses", "2 anos".
 *
 * Em dias puros, um contato de dois anos vira "731 dias" — tecnicamente certo e inútil: ninguém
 * lê setecentos e trinta e um. A unidade troca quando o número deixa de caber na cabeça.
 */
export function tempoDeRelacionamento(
  quando: Date | string | null | undefined,
  agora: Date = new Date(),
): string | null {
  const dias = diasDesde(quando, agora);
  if (dias === null) return null;
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 31) return `${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "1 mês" : `${meses} meses`;
  const anos = Math.floor(dias / 365);
  return anos === 1 ? "1 ano" : `${anos} anos`;
}
