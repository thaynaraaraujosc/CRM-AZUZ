import { prisma } from "@/lib/prisma";

/**
 * Progresso da sincronização de histórico sob demanda (ver `POST
 * .../whatsapp-nao-oficial/sincronizar-historico`) — guardado dentro de
 * `Integracao.metadados` (não uma tabela própria: é estado transitório de UMA sincronização, não
 * um dado de negócio que precise de histórico/relacionamentos próprios).
 *
 * `filaRestante === null` significa "ainda não buscou a lista de conversas do celular" (primeira
 * chamada do batch busca a lista inteira uma vez e preenche isso); depois disso, cada chamada tira
 * um lote pequeno da fila e processa, até esvaziar.
 */
export type ChatNaFila = { remoteJid: string; arquivada: boolean };

export type HistoricoSync = {
  status: "em_andamento" | "concluido" | "erro";
  totalChats: number | null;
  chatsProcessados: number;
  filaRestante: ChatNaFila[] | null;
  erro?: string;
};

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

/** Chamado assim que a conexão abre pela primeira vez — não faz nada se esse workspace já tem uma
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
