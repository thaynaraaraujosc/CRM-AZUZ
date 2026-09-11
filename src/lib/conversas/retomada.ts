import { prisma } from "@/lib/prisma";

/**
 * O modelo aprovado que o CRM usa sozinho quando a janela de 24 horas fecha.
 *
 * A regra da Meta é que, passadas 24 horas desde a última mensagem da pessoa, só sai modelo
 * aprovado. Até aqui o CRM parava e explicava o motivo, o que é honesto e é inútil: quem comprou um
 * CRM não deveria precisar aprender regra de API pra um follow-up sair. O follow-up existe
 * justamente pra falar com quem parou de responder, ou seja, ele nasce mirando o lado de fora da
 * janela.
 *
 * A saída é escolher UMA vez, não a cada mensagem: a pessoa aponta um modelo aprovado em
 * Configurações, e daí em diante toda automação que esbarrar na janela manda esse modelo no lugar
 * de falhar. Continua sendo texto que ela aprovou, e não um que o CRM inventou.
 *
 * Sem modelo escolhido, nada muda: o envio falha e diz por quê, como antes.
 */
export const CHAVE_RETOMADA = "whatsapp-retomada";

export type ConfigRetomada = {
  /** Id do `Template` do workspace. Vazio = desligado. */
  templateId?: string;
};

export async function modeloDeRetomada(workspaceId: string): Promise<{
  id: string;
  nome: string;
  idioma: string;
} | null> {
  const linha = await prisma.preferencia.findUnique({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE_RETOMADA } },
    select: { dados: true },
  });
  const templateId = (linha?.dados as ConfigRetomada | null)?.templateId?.trim();
  if (!templateId) return null;

  const modelo = await prisma.template.findFirst({
    where: { id: templateId, workspaceId },
    select: { id: true, nome: true, idioma: true, status: true },
  });
  // Modelo que saiu do ar (rejeitado pela Meta, apagado) não vale como retomada: mandar assim mesmo
  // só trocaria um erro por outro, e este seria mais difícil de entender.
  if (!modelo || modelo.status !== "aprovado") return null;
  return { id: modelo.id, nome: modelo.nome, idioma: modelo.idioma };
}
