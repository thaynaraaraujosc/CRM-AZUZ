import { FUSO_BRASILIA, dataIsoEmBrasilia, horaEmBrasilia } from "@/lib/agenda/fuso";

/**
 * A HORA QUE A BOLHA MOSTRA, sempre no relógio de Brasília.
 *
 * O DEFEITO QUE ISTO CONSERTA (21/10/2026): toda mensagem recebida chegava com a hora adiantada em
 * 3 horas. Uma mensagem das 18:42 aparecia como 21:42 na conversa — e como 18:42 na lista de
 * conversas ao lado, porque as duas telas tiravam a hora de lugares diferentes.
 *
 * A causa é a coluna `hora`: ela guarda TEXTO já formatado, escrito pelo webhook no momento em que
 * a mensagem chega. O webhook roda na Vercel, cujo relógio é UTC — então "18:42" em Brasília era
 * gravado como "21:42", para sempre, numa coluna que ninguém mais recalcula.
 *
 * Por que consertar na LEITURA e não só no webhook: consertar só o webhook endireitaria as
 * mensagens de amanhã e deixaria todo o histórico errado. Aqui a hora passa a ser derivada de
 * `criadoEm`, que é um instante de verdade, e o histórico inteiro se corrige sozinho — sem tocar
 * em nenhuma linha do banco.
 *
 * O `hora` guardado continua valendo como reserva: mensagem de exemplo (semeada) não tem
 * `criadoEm`, e é melhor mostrar a hora antiga do que um campo vazio.
 */
export function horaDaMensagem(msg: { hora?: string; criadoEm?: number }): string {
  if (typeof msg.criadoEm === "number" && Number.isFinite(msg.criadoEm) && msg.criadoEm > 0) {
    return horaEmBrasilia(new Date(msg.criadoEm));
  }
  return msg.hora ?? "";
}

/**
 * "Hoje", "Ontem" ou a data por extenso: o separador de dia da conversa, também em Brasília.
 *
 * Comparar com `getDate()` usa o relógio de QUEM OLHA. Para quem está no Brasil dá no mesmo, mas
 * deixa o separador e a hora da bolha discordando quando não dá: uma mensagem das 23h30 de
 * Brasília cairia em "Hoje" para um e em "Ontem" para outro, com a mesma hora escrita na bolha.
 * O produto inteiro roda em Brasília — o separador roda junto.
 *
 * Mensagem sem `criadoEm` (as de exemplo antigas) devolve `null`: melhor separador nenhum do que
 * um separador com a data errada.
 */
export function rotuloDoDiaEmBrasilia(
  criadoEm: number | undefined,
  traduzir: (texto: string) => string,
  locale: string,
): string | null {
  if (!criadoEm) return null;
  const data = new Date(criadoEm);
  const agora = new Date();
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

  const diaDaMensagem = dataIsoEmBrasilia(data);
  if (diaDaMensagem === dataIsoEmBrasilia(agora)) return traduzir("Hoje");
  if (diaDaMensagem === dataIsoEmBrasilia(ontem)) return traduzir("Ontem");

  return data.toLocaleDateString(locale, {
    timeZone: FUSO_BRASILIA,
    day: "2-digit",
    month: "long",
    // O ano só entra quando não é o corrente. Repetir "de 2026" em toda conversa é ruído.
    year: diaDaMensagem.slice(0, 4) === dataIsoEmBrasilia(agora).slice(0, 4) ? undefined : "numeric",
  });
}
