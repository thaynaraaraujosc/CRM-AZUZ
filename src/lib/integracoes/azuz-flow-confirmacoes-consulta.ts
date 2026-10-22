import { prisma } from "@/lib/prisma";

/**
 * "O que aconteceu com o lead que eu mandei?" — a pergunta do AZUZ Flow.
 *
 * A tela de Respostas dele mostrava "Confirmação de reunião na fila para envio." parada pra
 * sempre: a mensagem sai minutos depois, pelo cron, e ninguém avisava o outro lado. A agência via
 * "na fila" numa mensagem que já tinha chegado no WhatsApp da pessoa.
 *
 * DOIS CAMINHOS PRA ACHAR, e os dois são necessários:
 *
 *   1. `ConfirmacaoDeReuniao.respostaId` — a entrega que CRIOU a confirmação.
 *   2. `LeadRecebido.confirmacaoId` — a entrega que encontrou uma confirmação JÁ EXISTENTE.
 *
 * O segundo existe por causa de um caso real: a mesma pessoa preenche o formulário de novo pra
 * mesma reunião. A entrega nova tem `respostaId` novo e NÃO cria confirmação nova — a trava de
 * telefone + início recusa, e isso é o certo, ninguém deve receber a mesma confirmação duas vezes.
 * Com só o primeiro caminho, perguntar pelo id novo não acharia nada e a tela do Flow continuaria
 * mostrando "na fila" pra sempre, que é exatamente o defeito que isto conserta.
 *
 * Id desconhecido simplesmente não aparece na resposta. Não é erro: o Flow pergunta por um lote, e
 * um lote pode conter entregas que nunca geraram confirmação (lead sem reunião, sem consentimento,
 * sem WhatsApp).
 */

export type SituacaoDaConfirmacao = {
  /** na_fila | enviada | nao_enviada | cancelada */
  situacao: string;
  /** A frase em português, pronta pra tela. A MESMA da bolha da conversa. */
  motivo: string | null;
  /** ISO, quando já saiu. */
  enviadaEm: string | null;
};

/** O teto do lote. Acima disso a rota recusa: um lote sem limite é uma consulta sem limite. */
export const MAXIMO_DE_IDS = 50;

export async function situacaoDasConfirmacoes(
  workspaceId: string,
  respostaIds: string[],
): Promise<Record<string, SituacaoDaConfirmacao>> {
  const ids = [...new Set(respostaIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAXIMO_DE_IDS);
  if (!ids.length) return {};

  const [criadasPorElas, entregas] = await Promise.all([
    prisma.confirmacaoDeReuniao.findMany({
      where: { workspaceId, respostaId: { in: ids } },
      select: { respostaId: true, situacao: true, motivo: true, enviadaEm: true },
    }),
    // A entrega carrega a ligação quando a confirmação já existia. `origem` fica de fora do filtro
    // de propósito: a chave única é (workspace, origem, chaveExterna), e hoje só o Flow grava aqui.
    prisma.leadRecebido.findMany({
      where: { workspaceId, chaveExterna: { in: ids }, confirmacaoId: { not: null } },
      select: { chaveExterna: true, confirmacaoId: true },
    }),
  ]);

  const resposta: Record<string, SituacaoDaConfirmacao> = {};
  for (const linha of criadasPorElas) {
    if (linha.respostaId) resposta[linha.respostaId] = formatar(linha);
  }

  // Segundo caminho, só pros que ainda não foram achados: evita uma consulta a mais no caso comum.
  const faltando = entregas.filter((e) => !resposta[e.chaveExterna]);
  if (faltando.length) {
    const confirmacoes = await prisma.confirmacaoDeReuniao.findMany({
      where: { workspaceId, id: { in: faltando.map((e) => e.confirmacaoId!) } },
      select: { id: true, situacao: true, motivo: true, enviadaEm: true },
    });
    const porId = new Map(confirmacoes.map((c) => [c.id, c]));
    for (const entrega of faltando) {
      const confirmacao = porId.get(entrega.confirmacaoId!);
      if (confirmacao) resposta[entrega.chaveExterna] = formatar(confirmacao);
    }
  }

  return resposta;
}

function formatar(linha: { situacao: string; motivo: string | null; enviadaEm: Date | null }): SituacaoDaConfirmacao {
  return {
    situacao: linha.situacao,
    motivo: linha.motivo,
    enviadaEm: linha.enviadaEm ? linha.enviadaEm.toISOString() : null,
  };
}
