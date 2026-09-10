import { prisma } from "@/lib/prisma";
import type { HistoricoSync } from "./historico-tipos";

/**
 * Progresso da sincronização de histórico sob demanda (ver `POST
 * .../whatsapp-nao-oficial/sincronizar-historico`): guardado dentro de
 * `Integracao.metadados` (não uma tabela própria: é estado transitório de UMA sincronização, não
 * um dado de negócio que precise de histórico/relacionamentos próprios).
 *
 * `filaRestante === null` significa "ainda não buscou a lista de conversas do celular" (primeira
 * chamada do batch busca a lista inteira uma vez e preenche isso); depois disso, cada chamada tira
 * um lote pequeno da fila e processa, até esvaziar.
 */
export type { ChatNaFila, HistoricoSync } from "./historico-tipos";
export { CHATS_NA_PRIMEIRA_LEVA } from "./historico-tipos";

export async function lerMetadados(workspaceId: string): Promise<Record<string, unknown>> {
  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { metadados: true },
  });
  return (linha?.metadados as Record<string, unknown>) ?? {};
}

export async function salvarHistorico(
  workspaceId: string,
  metadadosAtuais: Record<string, unknown>,
  historico: HistoricoSync,
): Promise<void> {
  await prisma.integracao.update({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    data: { metadados: { ...metadadosAtuais, historico } },
  });
}

/**
 * Põe na fila as conversas antigas que tinham ficado guardadas.
 *
 * É o "trazer conversas mais antigas": não busca nada de novo no celular, só devolve pra fila o que
 * a primeira leva deixou de lado, e o relógio processa como processou as primeiras.
 */
export async function trazerMaisAntigas(workspaceId: string): Promise<HistoricoSync | null> {
  const metadados = await lerMetadados(workspaceId);
  const historico = metadados.historico as HistoricoSync | undefined;
  if (!historico) return null;
  const guardadas = historico.filaGuardada ?? [];
  if (!guardadas.length) return historico;

  const atualizado: HistoricoSync = {
    ...historico,
    status: "em_andamento",
    filaRestante: [...(historico.filaRestante ?? []), ...guardadas],
    filaGuardada: [],
    totalChats: (historico.totalChats ?? 0) + guardadas.length,
  };
  await salvarHistorico(workspaceId, metadados, atualizado);
  return atualizado;
}

/** Chamado assim que a conexão abre pela primeira vez. Não faz nada se esse workspace já tem uma
 * sincronização (em andamento ou já concluída) registrada, pra uma reconexão comum (celular caiu e
 * voltou) não reprocessar o histórico inteiro de novo. */
export async function iniciarHistoricoSeNecessario(workspaceId: string): Promise<void> {
  const metadados = await lerMetadados(workspaceId);
  if (metadados.historico) return;
  await salvarHistorico(workspaceId, metadados, {
    status: "em_andamento",
    totalChats: null,
    chatsProcessados: 0,
    filaRestante: null,
  });
}
