import { prisma } from "@/lib/prisma";
import { EXPEDIENTE_PADRAO, type DiasDoExpediente, type Expediente } from "@/lib/expediente";

/**
 * Lê o expediente do workspace. Separado das contas de propósito: `expediente.ts` é puro e
 * testável sem banco, e este arquivo é o único que toca o Prisma.
 *
 * Workspace sem expediente configurado usa o comercial de segunda a sexta. Devolver "fechado
 * sempre" faria toda automação com pausa útil travar em silêncio no dia em que alguém ligasse a
 * opção sem ter configurado o horário.
 */
export async function carregarExpediente(workspaceId: string): Promise<Expediente> {
  const linha = await prisma.expediente.findUnique({ where: { workspaceId } });
  if (!linha) return EXPEDIENTE_PADRAO;
  return {
    dias: (linha.dias as DiasDoExpediente) ?? EXPEDIENTE_PADRAO.dias,
    fuso: linha.fuso || EXPEDIENTE_PADRAO.fuso,
  };
}
