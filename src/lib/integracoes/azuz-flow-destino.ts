import { prisma } from "@/lib/prisma";

/**
 * Onde o lead vai cair: o primeiro funil da empresa e a primeira etapa dele.
 *
 * Mora separado porque duas telas contam a mesma coisa e elas não podem divergir: o "Testar
 * conexão" do Flow e o cartão de Configurações. Duas consultas parecidas escritas em dois lugares
 * é como se cria a situação em que a tela diz uma etapa e o lead entra noutra.
 *
 * `null` quando a empresa ainda não montou funil nenhum. Não é erro: o lead entra como contato do
 * mesmo jeito, só não vira card.
 */
export async function destinoDoLead(workspaceId: string): Promise<{ funil: string; etapa: string } | null> {
  // Sem `orderBy`: `Funil` não tem coluna de data, e `entrarNaPrimeiraEtapaComoNovoLead` usa
  // exatamente este mesmo `findFirst` sem ordenação. Inventar uma ordem aqui faria a tela prometer
  // um funil e o lead cair noutro.
  const funil = await prisma.funil.findFirst({
    where: { workspaceId },
    include: { etapas: { orderBy: { ordem: "asc" }, take: 1, select: { titulo: true } } },
  });
  const etapa = funil?.etapas[0]?.titulo;
  return funil && etapa ? { funil: funil.nome, etapa } : null;
}
