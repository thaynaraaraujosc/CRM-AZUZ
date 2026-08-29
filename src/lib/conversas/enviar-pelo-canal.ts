import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarMensagemWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { enviarDirectInstagram } from "@/lib/integracoes/instagram-login";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";

/**
 * Manda um texto pelo canal de uma conversa — do lado do SERVIDOR.
 *
 * A tela de Conversas tem o equivalente dela (`despacharTexto`), mas aquele roda no navegador de
 * quem está atendendo. Automação precisa de um caminho que funcione sem ninguém logado: a mensagem
 * chega de madrugada, o fluxo dispara e a resposta sai.
 *
 * Escolhe o canal pela conversa, não por parâmetro, pra não existir a chance de um chamador novo
 * mandar pelo canal errado — a conversa já sabe por onde ela fala.
 */
export async function enviarTextoPeloCanal(params: {
  workspaceId: string;
  conversaNome: string;
  texto: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  const { workspaceId, conversaNome, texto } = params;
  if (!texto.trim()) return { enviado: false, motivo: "mensagem vazia" };

  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: conversaNome } },
  });
  if (!conversa?.contato) return { enviado: false, motivo: "conversa sem destinatário" };

  // Grupo não recebe automação: ele existe pra ser respondido à mão em Conversas. Uma automação
  // disparando num grupo escreveria pra dezenas de pessoas de uma vez.
  if (conversa.ehGrupo) return { enviado: false, motivo: "conversa de grupo" };

  try {
    if (conversa.canal === "Instagram") {
      const integracao = await prisma.integracao.findUnique({
        where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
      });
      if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
        return { enviado: false, motivo: "Instagram não conectado" };
      }
      await enviarDirectInstagram(decriptar(integracao.accessTokenCriptografado), conversa.contato, texto);
      return { enviado: true };
    }

    // WhatsApp: a conversa pertence à conexão por onde ela veio (ver `contaCanal`). QR Code e API
    // oficial são serviços diferentes — mandar pelo errado dá erro ou vai pro número errado.
    if (conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:")) {
      await enviarMensagemWhatsAppNaoOficial(workspaceId, conversa.contato, texto);
      return { enviado: true };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, motivo: "WhatsApp não conectado" };
    await enviarPelaCloudApi(conta, conversa.contato, { type: "text", text: { body: texto } });
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}
