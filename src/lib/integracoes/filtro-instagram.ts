import { prisma } from "@/lib/prisma";
import { CANAL_INSTAGRAM, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";

/**
 * Quais conversas do Direct pertencem à conta do Instagram conectada AGORA.
 *
 * O WhatsApp sempre teve essa regra: desconectou um número, as conversas dele somem da tela (não do
 * banco) e voltam inteiras se ele reconectar. O Instagram tinha sido deixado de fora de propósito,
 * porque um identificador divergente por um fio já tinha feito mensagem ser gravada e nunca
 * aparecer, duas vezes. A saída na época foi mostrar tudo.
 *
 * Só que isso trocou um problema por outro pior. Trocando a conta conectada, as conversas da conta
 * anterior continuavam misturadas com as da nova, na mesma lista, sem nada dizendo de qual era
 * qual. E responder uma delas falha, porque o identificador de cada pessoa é amarrado à conta que
 * recebeu a mensagem. A pessoa lê uma conversa, responde, e leva um erro em inglês.
 *
 * A regra volta a ser a mesma dos dois canais, com a proteção original preservada: quando o CRM
 * NÃO sabe o identificador da conta conectada, mostra tudo. Assim o caso que motivou a exceção
 * continua coberto, e o caso que ela criou deixa de existir.
 */
export type FiltroDireto =
  | { tipo: "nada" }
  | { tipo: "tudo" }
  | { tipo: "daConta"; contaCanal: string };

export async function filtroDoDirect(workspaceId: string): Promise<FiltroDireto> {
  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
    select: { status: true, metadados: true },
  });

  if (integracao?.status !== "conectado") return { tipo: "nada" };

  const metadados = (integracao.metadados as Record<string, unknown> | null) ?? {};
  // "Mostrar mensagens do Instagram nas Conversas", desligado: a conexão deixa de reivindicar as
  // conversas dela. Mesma regra que já valia na caixa de entrada unificada.
  if (metadados.receberMensagens === false) return { tipo: "nada" };

  const conta = contaCanalDaConexao(CANAL_INSTAGRAM, metadados.instagramContaId as string | undefined);
  // Conta ligada cujo identificador o CRM não sabe: mostra tudo. Esconder aqui protegeria contra um
  // problema que não existe e criaria um que existe (a pessoa não vê a mensagem que chegou).
  if (!conta) return { tipo: "tudo" };

  return { tipo: "daConta", contaCanal: conta };
}

/** Traduz o filtro para o `where` do Prisma, sobre `Conversa` ou `MensagemExtra`. */
export function whereDoDirect(filtro: FiltroDireto): Record<string, unknown> {
  if (filtro.tipo === "tudo") return {};
  if (filtro.tipo === "nada") return { contaCanal: { in: ["__instagram-desconectado__"] } };
  // `null` entra junto: é a conversa anterior a esta coluna existir. Ela veio de quando havia UMA
  // conexão só, então não mistura nada, e escondê-la apagaria histórico da tela sem motivo.
  return { OR: [{ contaCanal: filtro.contaCanal }, { contaCanal: null }] };
}
