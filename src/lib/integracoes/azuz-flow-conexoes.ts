import { prisma } from "@/lib/prisma";
import type { ConexoesDoWorkspace } from "@/lib/integracoes/azuz-flow-canal";
import { CANAL_NAO_OFICIAL } from "@/lib/integracoes/conta-canal";
import { contaConectada } from "@/lib/integracoes/whatsapp-oficial";

/**
 * As conexões de WhatsApp ligadas agora, por identificador.
 *
 * Num arquivo só porque DUAS pessoas precisam da mesma resposta: a entrega do lead, pra decidir por
 * onde criar a conversa, e a tela de Configurações, pra dizer o que vai acontecer com o próximo
 * lead. Duplicar isso faria a tela e o comportamento discordarem no dia em que uma das duas
 * mudasse — que é o tipo de divergência que ninguém percebe até um cliente reclamar.
 */
export async function conexoesDeWhatsappDoWorkspace(workspaceId: string): Promise<ConexoesDoWorkspace> {
  const [oficial, qr] = await Promise.all([
    contaConectada(workspaceId),
    prisma.integracao.findUnique({
      where: { workspaceId_provedor: { workspaceId, provedor: CANAL_NAO_OFICIAL } },
      select: { status: true, metadados: true },
    }),
  ]);
  const metadados = (qr?.metadados as Record<string, unknown> | null) ?? {};
  const numero = typeof metadados.numero === "string" ? metadados.numero : null;
  return {
    oficial: oficial?.phoneNumberId ?? null,
    // Conectado mas sem número nos metadados não serve: `contaCanal` sem identificador vira `null`,
    // e conversa sem dono não aparece pra conexão nenhuma.
    qrcode: qr?.status === "conectado" ? numero : null,
  };
}
