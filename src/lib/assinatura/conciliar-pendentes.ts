import { prisma } from "@/lib/prisma";
import { listarCobrancas } from "@/lib/integracoes/asaas";
import { esquecerStatus } from "@/lib/assinatura/status-cache";
import { precisaConciliar, statusPelasCobrancas } from "@/lib/assinatura/conciliar";

/**
 * Conserta sozinho quem pagou e continuou bloqueado.
 *
 * A conciliação já roda quando a pessoa abre a tela de assinatura, mas depender disso é depender
 * de ela tentar de novo. Quem paga um boleto, é barrado pelo paywall e conclui que o produto não
 * funciona não abre tela nenhuma: some, e a venda vai junto. Este relógio fecha esse buraco sem
 * exigir nada de quem está do outro lado.
 *
 * Olha SÓ quem está travado (`pendente` ou `atrasada`). Assinatura ativa não tem o que conciliar,
 * e varrer todas gastaria uma chamada à Asaas por cliente por rodada, à toa.
 *
 * Nunca lança: é chamado de dentro do relógio, e a Asaas fora do ar não pode derrubar a rodada
 * inteira, que também processa campanha e automação.
 */

/**
 * Teto por rodada. A Asaas tem limite de chamadas, e uma base grande com muitos bloqueados poderia
 * estourar. Quem sobrar volta na próxima passagem: a ordem é por atualização mais antiga, então
 * ninguém fica pra trás indefinidamente.
 */
const POR_RODADA = 25;

export async function conciliarAssinaturasPendentes(): Promise<{
  conferidas: number;
  corrigidas: number;
}> {
  const travadas = await prisma.assinatura.findMany({
    where: {
      status: { in: ["pendente", "atrasada"] },
      asaasSubscriptionId: { not: null },
    },
    select: { workspaceId: true, status: true, asaasSubscriptionId: true },
    orderBy: { atualizadoEm: "asc" },
    take: POR_RODADA,
  });

  let corrigidas = 0;

  for (const assinatura of travadas) {
    try {
      const cobrancas = await listarCobrancas(assinatura.asaasSubscriptionId!);
      const statusReal = statusPelasCobrancas(cobrancas);
      if (!precisaConciliar(assinatura.status, statusReal)) continue;

      await prisma.assinatura.update({
        where: { workspaceId: assinatura.workspaceId },
        data: { status: statusReal },
      });
      esquecerStatus(assinatura.workspaceId);
      corrigidas += 1;

      // Fica no log: "o cliente pagou e o CRM não liberou" é o tipo de coisa que precisa deixar
      // rastro, mesmo depois de consertada. Se aparecer com frequência, o problema está no
      // webhook e não aqui.
      console.log(
        `[assinatura] conciliada ${assinatura.workspaceId}: ${assinatura.status} -> ${statusReal}`,
      );
    } catch (erro) {
      console.error(`[assinatura] falha ao conciliar ${assinatura.workspaceId}:`, erro);
    }
  }

  return { conferidas: travadas.length, corrigidas };
}
