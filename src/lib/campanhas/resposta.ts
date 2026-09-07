import { prisma } from "@/lib/prisma";

/** Até quando uma mensagem recebida conta como "resposta" a um disparo. Depois disso é conversa
 * normal — atribuir ao disparo uma mensagem de duas semanas depois inflaria o número à toa. */
const JANELA_DE_RESPOSTA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Marca como "respondido" o disparo mais recente que esta pessoa recebeu, se ela escreveu dentro
 * da janela. Chamado pelos webhooks de mensagem recebida (WhatsApp oficial, QR, e-mail se um dia
 * tiver). Idempotente: só o primeiro retorno conta, os seguintes não mexem em nada.
 *
 * Falha aqui NÃO pode derrubar o webhook — é métrica, não a mensagem em si. Por isso engole erro.
 */
export async function registrarRespostaDeCampanha(workspaceId: string, contatoNome: string): Promise<void> {
  try {
    const desde = new Date(Date.now() - JANELA_DE_RESPOSTA_MS);
    const ultimo = await prisma.campanhaDestinatario.findFirst({
      where: {
        workspaceId,
        contatoNome,
        status: { in: ["enviado", "entregue", "lido"] },
        respondidoEm: null,
        enviadoEm: { gte: desde },
      },
      orderBy: { enviadoEm: "desc" },
      select: { id: true },
    });
    if (!ultimo) return;
    await prisma.campanhaDestinatario.update({ where: { id: ultimo.id }, data: { respondidoEm: new Date() } });
  } catch (erro) {
    console.error("[campanhas] falha ao registrar resposta:", erro instanceof Error ? erro.message : erro);
  }
}
