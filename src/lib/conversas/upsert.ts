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
  /** Id do `Contato` já criado/casado pra essa mensagem (ver `src/lib/contatos/upsert.ts`) — grava
   * a FK de verdade em vez de depender só do match por `nome` em runtime no front. */
  contatoId?: string;
  /** `false` na importação de histórico (sync completo do WhatsApp ao conectar via QR Code) —
   * mensagem antiga não é "não lida" de verdade, incrementar o contador só gera badge enganoso.
   * Padrão `true` (mensagem chegando ao vivo). */
  contarComoNaoLida?: boolean;
}) {
  const { workspaceId, nome, canal, contato, origem, contatoId, contarComoNaoLida = true } = params;
  await prisma.conversa.upsert({
    where: { workspaceId_nome: { workspaceId, nome } },
    create: {
      id: `conversa-${workspaceId}-${slugId(nome)}`,
      workspaceId,
      nome,
      initials: iniciaisDe(nome),
      canal,
      contato,
      contatoId,
      origem: origem ?? "Direto",
      naoLidas: contarComoNaoLida ? 1 : 0,
    },
    // Grava/atualiza o contatoId também num update — conversa antiga criada antes dessa FK existir
    // se auto-corrige assim que uma mensagem nova chega e o contato já foi resolvido.
    update: {
      ...(contatoId ? { contatoId } : {}),
      ...(contarComoNaoLida ? { naoLidas: { increment: 1 }, atualizadoEm: new Date() } : {}),
    },
  });
}
