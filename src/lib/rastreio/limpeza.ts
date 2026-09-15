import { prisma } from "@/lib/prisma";

/**
 * Clique que nunca virou conversa.
 *
 * A maioria dos cliques registrados nunca encontra uma mensagem: a pessoa apertou o botão, o
 * WhatsApp abriu, ela leu a mensagem pronta e desistiu. Isso é normal e não é erro. Mas cada um
 * deles é uma linha no banco, e sem limpeza elas se acumulam para sempre — numa tabela que só
 * cresce e nunca é lida.
 *
 * Três dias, e não trinta: quem clicou e não falou nada não volta na semana seguinte com a mesma
 * intenção. Guardar mais tempo não recupera atribuição nenhuma, só ocupa espaço.
 *
 * Nunca apaga clique JÁ CONSUMIDO: aquele virou origem de um lead e o registro dele é histórico.
 */
const VALIDADE_HORAS = 72;

export async function limparCliquesVelhos(agora: Date = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - VALIDADE_HORAS * 60 * 60 * 1000);
  const { count } = await prisma.cliqueRastreado.deleteMany({
    where: { criadoEm: { lt: limite }, consumidoEm: null },
  });
  return count;
}
