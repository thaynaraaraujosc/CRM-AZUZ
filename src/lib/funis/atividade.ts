/**
 * Há quanto tempo esse negócio teve movimento — o rótulo que aparece no canto do card.
 *
 * Antes esse texto era uma STRING GRAVADA no banco (`NegocioCard.dias`), escrita como "Hoje" no
 * momento em que o card nascia e nunca mais tocada. Resultado: um funil inteiro dizendo "Hoje",
 * inclusive em card de duas semanas atrás — e nenhuma pista de quem falou por último, que é
 * justamente o que a coluna precisa mostrar pra funcionar como caixa de entrada.
 *
 * Agora o rótulo é CALCULADO na hora de desenhar, a partir da última atividade real da conversa (ou
 * da data de criação do card, quando ele não tem conversa). Data guardada envelhece; data calculada
 * não tem como mentir.
 */
export function rotuloDeAtividade(quando: Date | string | null | undefined, agora: Date = new Date()): string {
  if (!quando) return "—";
  const data = quando instanceof Date ? quando : new Date(quando);
  if (Number.isNaN(data.getTime())) return "—";

  const minutos = Math.floor((agora.getTime() - data.getTime()) / 60_000);
  // Futuro (relógio do servidor à frente do navegador, por exemplo) conta como agora, em vez de
  // virar "há -3 dias".
  if (minutos < 5) return "Agora";
  if (minutos < 60) return `${minutos} min`;

  const diasDeDiferenca = diferencaEmDias(data, agora);
  if (diasDeDiferenca === 0) return "Hoje";
  if (diasDeDiferenca === 1) return "Ontem";
  if (diasDeDiferenca < 7) return `${diasDeDiferenca} dias`;

  const mesmoAno = data.getFullYear() === agora.getFullYear();
  return data.toLocaleDateString("pt-BR", mesmoAno ? { day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Diferença em DIAS DE CALENDÁRIO, não em blocos de 24 horas: às 00:30 de terça, uma mensagem das
 * 23:50 de segunda é "Ontem" — mesmo tendo 40 minutos de diferença. */
function diferencaEmDias(data: Date, agora: Date): number {
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((inicio(agora) - inicio(data)) / 86_400_000);
}
