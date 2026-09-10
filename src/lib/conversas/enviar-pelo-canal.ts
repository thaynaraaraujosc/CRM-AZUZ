import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarMensagemWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { enviarDirectInstagram } from "@/lib/integracoes/instagram-login";
import { contaConectada, enviarPelaCloudApi, janelaDeAtendimentoAberta } from "@/lib/integracoes/whatsapp-oficial";
import { dentroDaJanelaDirect } from "@/lib/social/janela-direct";

/**
 * Manda um texto pelo canal de uma conversa. Do lado do SERVIDOR.
 *
 * A tela de Conversas tem o equivalente dela (`despacharTexto`), mas aquele roda no navegador de
 * quem está atendendo. Automação precisa de um caminho que funcione sem ninguém logado: a mensagem
 * chega de madrugada, o fluxo dispara e a resposta sai.
 *
 * Escolhe o canal pela conversa, não por parâmetro, pra não existir a chance de um chamador novo
 * mandar pelo canal errado: a conversa já sabe por onde ela fala.
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
      // A janela ANTES de tentar. Fora dela o Instagram recusa, e a recusa chegaria como um erro
      // técnico da Meta, em inglês, difícil de ligar à causa. Aqui a explicação já vem certa e a
      // chamada nem sai: não gasta cota nem suja a conta com erro previsível.
      if (!(await dentroDaJanelaDirect(workspaceId, conversaNome))) {
        return {
          enviado: false,
          motivo:
            "a janela de 24 horas do Instagram fechou. Só dá pra escrever até 24 horas depois da última mensagem da pessoa, e no Direct não existe modelo aprovado pra retomar.",
        };
      }
      await enviarDirectInstagram(decriptar(integracao.accessTokenCriptografado), conversa.contato, texto);
      return { enviado: true };
    }

    // WhatsApp: a conversa pertence à conexão por onde ela veio (ver `contaCanal`). QR Code e API
    // oficial são serviços diferentes: mandar pelo errado dá erro ou vai pro número errado.
    if (conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:")) {
      await enviarMensagemWhatsAppNaoOficial(workspaceId, conversa.contato, texto);
      return { enviado: true };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, motivo: "WhatsApp não conectado" };

    /*
     * A JANELA DE 24 HORAS, conferida antes de tentar.
     *
     * Este é o ponto onde um follow-up morre em silêncio, e é o defeito que motivou esta correção.
     * O bloco de espera existe justamente pra falar com quem parou de responder, e é exatamente
     * nesse momento que a janela costuma estar fechada. A Cloud API recusa texto livre fora dela e
     * devolve um erro técnico em inglês; sem esta checagem, a automação registrava "falhou" com
     * uma mensagem que não dizia o que fazer.
     *
     * NÃO trocamos por um modelo aprovado sozinhos, e isso é deliberado: qual modelo mandar é
     * decisão de quem montou o fluxo, e escolher um por conta própria mandaria pro cliente um
     * texto que ninguém aprovou. Quem quer falar fora da janela usa o bloco "Enviar modelo do
     * WhatsApp", que existe pra isso. O que a automação faz aqui é dizer o motivo com todas as
     * letras, pra tela de execuções mostrar a saída em vez de um enigma.
     */
    if (!(await janelaDeAtendimentoAberta(workspaceId, conversaNome))) {
      return {
        enviado: false,
        motivo:
          "a janela de 24 horas do WhatsApp fechou. Fora dela a Meta só aceita modelo aprovado: troque este bloco por “Enviar modelo do WhatsApp” ou mova o envio pra dentro das 24 horas.",
      };
    }

    await enviarPelaCloudApi(conta, conversa.contato, { type: "text", text: { body: texto } });
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}
