import { prisma } from "@/lib/prisma";

/**
 * Onde cai o lead que chegou pelo Instagram.
 *
 * Por padrão, no mesmo lugar de todo mundo: o primeiro funil do workspace, primeira etapa. Mas
 * misturar audiência de rede social com lead comercial é exatamente o que faz o funil deixar de
 * ser confiável: quem responde um story não está no mesmo momento de quem pediu orçamento, e o
 * vendedor perde tempo com os dois no mesmo lugar. Quem quiser separar, separa aqui.
 *
 * Guardado em `Preferencia`, não em coluna nova: é uma escolha por workspace, lida uma vez por
 * mensagem, e a tabela existe pra exatamente isso.
 */
const CHAVE = "social.destino_lead";

export type DestinoLeadSocial = {
  /** Funil escolhido. Vazio = o primeiro do workspace. */
  funilId?: string | null;
  /** Etapa escolhida. Vazia = a primeira daquele funil. */
  etapaId?: string | null;
};

/*
 * LIGAR/DESLIGAR a criação de lead NÃO mora aqui: já existe, em "Levar as conversas do Instagram
 * para o funil", na própria conexão. Repetir a mesma decisão em dois lugares é como se cria a
 * pergunta "por que tem dois?", e a resposta seria "por descuido". Aqui é só o DESTINO.
 */
const PADRAO: DestinoLeadSocial = { funilId: null, etapaId: null };

export async function destinoDoLeadSocial(workspaceId: string): Promise<DestinoLeadSocial> {
  const linha = await prisma.preferencia.findUnique({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
  });
  if (!linha) return PADRAO;

  const dados = (linha.dados ?? {}) as Partial<DestinoLeadSocial>;
  return { funilId: dados.funilId ?? null, etapaId: dados.etapaId ?? null };
}

export async function salvarDestinoDoLeadSocial(
  workspaceId: string,
  destino: DestinoLeadSocial,
): Promise<DestinoLeadSocial> {
  const dados: DestinoLeadSocial = {
    funilId: destino.funilId || null,
    etapaId: destino.etapaId || null,
  };
  await prisma.preferencia.upsert({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
    create: { workspaceId, chave: CHAVE, dados },
    update: { dados },
  });
  return dados;
}
