import { prisma } from "@/lib/prisma";
import { enviarReacaoWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";

/**
 * Reage com um emoji à última mensagem que o CONTATO mandou.
 *
 * Os dois caminhos do WhatsApp suportam reação de verdade: a Cloud API com `type: "reaction"`, e a
 * Evolution com `/message/sendReaction`. O que faltava era escrever a chamada, não o suporte do
 * provider.
 *
 * Reage à mensagem DELE, não à nossa: numa automação de atendimento é isso que faz sentido ("vi
 * sua mensagem"), e reagir à própria mensagem pareceria o robô se elogiando.
 *
 * Sem mensagem recebida não há a que reagir, e isso não é erro: é uma conversa que ainda não
 * começou. Volta como falha explicada, pro histórico dizer o motivo em vez de sumir.
 */
export async function reagirAUltimaMensagem(params: {
  workspaceId: string;
  conversaNome: string;
  emoji: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  const { workspaceId, conversaNome, emoji } = params;

  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: conversaNome } },
  });
  if (!conversa?.contato) return { enviado: false, motivo: "conversa sem destinatário" };
  if (conversa.ehGrupo) return { enviado: false, motivo: "conversa de grupo" };

  // A última que NÃO é nossa. `tipo: "out"` marca as que saíram daqui.
  const recebida = await prisma.mensagemExtra.findFirst({
    where: { workspaceId, contato: conversaNome, tipo: { not: "out" } },
    orderBy: { criadoEm: "desc" },
    select: { id: true },
  });
  if (!recebida) return { enviado: false, motivo: "o contato ainda não mandou nenhuma mensagem" };

  try {
    const porQrCode =
      conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:");

    if (porQrCode) {
      await enviarReacaoWhatsAppNaoOficial(workspaceId, conversa.contato, recebida.id, emoji);
      return { enviado: true };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, motivo: "WhatsApp não conectado" };

    await enviarPelaCloudApi(conta, conversa.contato, {
      type: "reaction",
      reaction: { message_id: recebida.id, emoji },
    });
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha ao reagir" };
  }
}
