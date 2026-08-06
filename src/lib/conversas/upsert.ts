import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";

function iniciaisDe(nome: string): string {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Cria (ou atualiza) a `Conversa` correspondente a uma mensagem recebida — chamado pelos três
 * webhooks que gravam `MensagemExtra` (WhatsApp oficial, WhatsApp via QR/Baileys, Instagram), logo
 * depois de criar a mensagem em si. É o que faz uma conversa nova aparecer sozinha na tela assim
 * que chega a primeira mensagem de um número/@handle que ainda não tinha thread nenhuma — resolve a
 * limitação antes documentada de "número novo não aparece na tela ainda".
 *
 * `id` é determinístico (`workspaceId` + slug do nome) de propósito: como a chave única real é
 * `[workspaceId, nome]`, gerar sempre o mesmo id pro mesmo par evita ficar acumulando ids órfãos
 * a cada upsert.
 */
export async function upsertConversaAoReceberMensagem(params: {
  workspaceId: string;
  nome: string;
  canal: string;
  contato?: string;
  origem?: string;
}) {
  const { workspaceId, nome, canal, contato, origem } = params;
  await prisma.conversa.upsert({
    where: { workspaceId_nome: { workspaceId, nome } },
    create: {
      id: `conversa-${workspaceId}-${slugId(nome)}`,
      workspaceId,
      nome,
      initials: iniciaisDe(nome),
      canal,
      contato,
      origem: origem ?? "Direto",
      naoLidas: 1,
    },
    update: {
      naoLidas: { increment: 1 },
      atualizadoEm: new Date(),
    },
  });
}
