import { prisma } from "@/lib/prisma";

/**
 * Essa conta de canal já está conectada em OUTRO workspace?
 *
 * Existe por causa de uma falha silenciosa que custou horas de investigação: a mesma conta do
 * Instagram ligada em dois workspaces. O webhook da Meta chega identificado pela CONTA, não pelo
 * workspace, e o CRM resolve o dono procurando a primeira integração conectada com aquele
 * identificador. Com duas, uma sempre ganha e a outra nunca recebe nada.
 *
 * Na tela, as duas diziam "Conectado". Uma recebia mensagem, a outra ficava muda para sempre, sem
 * erro em lugar nenhum. É o pior tipo de defeito: o que se parece com sucesso.
 *
 * A regra correta é simples e o produto precisa dizê-la em voz alta: uma conta de canal alimenta
 * UM workspace. Quem tentar conectar onde já está conectado recebe um aviso claro, com o caminho
 * para resolver, em vez de uma conexão que não funciona.
 *
 * Vale pro Instagram e pro WhatsApp oficial, que têm exatamente o mesmo roteamento por conta.
 */
export type ContaOcupada = { workspaceId: string; workspaceNome: string };

export async function contaOcupadaPorOutroWorkspace(params: {
  provedor: "meta_instagram" | "meta_whatsapp";
  /** Nome do campo dentro de `metadados` que guarda o identificador da conta. */
  campo: "instagramContaId" | "phoneNumberId";
  identificador: string;
  /** O workspace que está tentando conectar agora. Ele mesmo não conta como conflito. */
  workspaceId: string;
}): Promise<ContaOcupada | null> {
  const { provedor, campo, identificador, workspaceId } = params;
  if (!identificador) return null;

  // O identificador mora dentro de uma coluna Json, que não dá pra filtrar por igualdade em todo
  // banco de forma portável. A lista de integrações conectadas é pequena (uma por workspace, por
  // provedor), então a comparação em memória é barata e previsível.
  const conectadas = await prisma.integracao.findMany({
    where: { provedor, status: "conectado", NOT: { workspaceId } },
    select: { workspaceId: true, metadados: true, workspace: { select: { nome: true } } },
  });

  const conflito = conectadas.find(
    (i) => (i.metadados as Record<string, unknown> | null)?.[campo] === identificador,
  );
  if (!conflito) return null;
  return { workspaceId: conflito.workspaceId, workspaceNome: conflito.workspace.nome };
}

/** A frase que a pessoa lê. Diz o que aconteceu e o que fazer, sem jargão. */
export function avisoDeContaOcupada(canal: "Instagram" | "WhatsApp", ocupada: ContaOcupada): string {
  return (
    `Essa conta do ${canal} já está conectada em outra empresa dentro do CRM ("${ocupada.workspaceNome}"). ` +
    `Uma conta só consegue alimentar uma empresa por vez: as mensagens iriam todas pra lá e aqui não chegaria nada. ` +
    `Desconecte por lá primeiro e depois conecte aqui.`
  );
}
