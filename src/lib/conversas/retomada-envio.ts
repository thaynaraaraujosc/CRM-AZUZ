import { prisma } from "@/lib/prisma";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";
import { componentesParaMeta, resolverParametros, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { modeloDeRetomada } from "./retomada";

/**
 * Manda o modelo de retomada quando a janela de 24 horas fechou.
 *
 * Devolve `null` quando não há modelo escolhido: aí quem chamou segue com a explicação de sempre.
 * Um erro no envio do modelo vira motivo em português, não exceção: a automação precisa registrar o
 * que houve, não estourar no meio.
 */
export async function enviarModeloDeRetomada(params: {
  workspaceId: string;
  conversaNome: string;
  destinatario: string;
}): Promise<{ enviado: boolean; motivo?: string; wamid?: string | null } | null> {
  const { workspaceId, conversaNome, destinatario } = params;
  const modelo = await modeloDeRetomada(workspaceId);
  if (!modelo) return null;

  const conta = await contaConectada(workspaceId);
  if (!conta) return { enviado: false, motivo: "WhatsApp oficial não conectado." };

  try {
    const registro = await prisma.template.findFirst({ where: { id: modelo.id, workspaceId } });
    const contato = await prisma.contato.findUnique({
      where: { workspaceId_nome: { workspaceId, nome: conversaNome } },
    });
    const mapeamento = ((registro?.variaveis ?? []) as MapeamentoVariavel[]) ?? [];
    const parametros = resolverParametros(mapeamento, contato ? { ...contato, nome: conversaNome } : null);

    const wamid = await enviarPelaCloudApi(conta, destinatario, {
      type: "template",
      template: {
        name: modelo.nome,
        language: { code: modelo.idioma },
        components: componentesParaMeta(mapeamento, parametros),
      },
    });
    return { enviado: true, wamid };
  } catch (erro) {
    return {
      enviado: false,
      motivo: `a janela de 24 horas fechou e o modelo de retomada "${modelo.nome}" também não saiu: ${
        erro instanceof Error ? erro.message : "falha no envio"
      }`,
    };
  }
}
