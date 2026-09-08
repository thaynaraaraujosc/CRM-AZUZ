import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { limparAnexosVencidos, publicarAnexoTemporario } from "@/lib/integracoes/anexo-publico";
import { enviarAudioWhatsAppNaoOficial, enviarMidiaWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { enviarAnexoDirectInstagram, type TipoAnexoInstagram } from "@/lib/integracoes/instagram-login";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";

/**
 * Envia um arquivo (imagem, vídeo, áudio, documento) pelo canal da conversa.
 *
 * Os blocos de mídia das automações existiam só no editor: no envio, ou não saía nada, ou saía só a
 * legenda — o que é pior, porque registra "enviado" e o contato não recebeu o arquivo.
 *
 * O arquivo mora na biblioteca do CRM como data URL. Nenhum dos canais aceita o conteúdo no corpo
 * da chamada: todos recebem um ENDEREÇO e vão buscar o arquivo por fora, sem sessão. Por isso o
 * caminho é o mesmo que o envio de anexo do Instagram já usa — um link assinado e temporário
 * (`publicarAnexoTemporario`), que vence pouco depois do envio.
 */
export type TipoMidia = "imagem" | "video" | "audio" | "documento";

const TIPO_WHATSAPP: Record<TipoMidia, string> = {
  imagem: "image",
  video: "video",
  audio: "audio",
  documento: "document",
};

const TIPO_INSTAGRAM: Record<TipoMidia, TipoAnexoInstagram> = {
  imagem: "image",
  video: "video",
  audio: "audio",
  documento: "file",
};

export async function enviarMidiaPeloCanal(params: {
  workspaceId: string;
  conversaNome: string;
  /** Id em `DocumentoBiblioteca` — é o que o bloco guarda. */
  arquivoId: string;
  tipo: TipoMidia;
  legenda?: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  const { workspaceId, conversaNome, arquivoId, tipo } = params;
  const legenda = params.legenda?.trim() || undefined;

  const conversa = await prisma.conversa.findUnique({ where: { workspaceId_nome: { workspaceId, nome: conversaNome } } });
  if (!conversa?.contato) return { enviado: false, motivo: "conversa sem destinatário" };
  if (conversa.ehGrupo) return { enviado: false, motivo: "conversa de grupo" };

  const arquivo = await prisma.documentoBiblioteca.findFirst({ where: { id: arquivoId, workspaceId } });
  if (!arquivo) return { enviado: false, motivo: "o arquivo desse bloco não está mais na biblioteca" };
  if (!arquivo.url.startsWith("data:")) return { enviado: false, motivo: "arquivo guardado em formato que não dá pra enviar" };

  // Cada publicação aproveita pra limpar o que venceu: sem isso a tabela vira um depósito de tudo
  // que já foi enviado, com cada arquivo ainda acessível muito depois de precisar.
  await limparAnexosVencidos();

  let publicado: { url: string };
  try {
    publicado = await publicarAnexoTemporario({
      workspaceId,
      nome: arquivo.nome,
      dataUrl: arquivo.url,
      // Curto de propósito: o canal busca o arquivo em segundos, logo depois do envio.
      validadeMs: 15 * 60 * 1000,
    });
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha ao preparar o arquivo" };
  }

  try {
    if (conversa.canal === "Instagram") {
      const integracao = await prisma.integracao.findUnique({
        where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
      });
      if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
        return { enviado: false, motivo: "Instagram não conectado" };
      }
      await enviarAnexoDirectInstagram(
        decriptar(integracao.accessTokenCriptografado),
        conversa.contato,
        TIPO_INSTAGRAM[tipo],
        publicado.url,
      );
      // O Direct manda o anexo sozinho — a legenda vai como uma segunda mensagem, senão ela some.
      return { enviado: true };
    }

    const porQrCode =
      conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:");
    if (porQrCode) {
      if (tipo === "audio") {
        // A Evolution tem endpoint próprio pra nota de voz, e ele não aceita URL — só base64. O
        // conteúdo do data URL já está aqui, então vai direto.
        await enviarAudioWhatsAppNaoOficial(workspaceId, conversa.contato, arquivo.url.slice(arquivo.url.indexOf(",") + 1));
        return { enviado: true };
      }
      await enviarMidiaWhatsAppNaoOficial(workspaceId, conversa.contato, {
        url: publicado.url,
        tipo: tipo === "documento" ? "document" : (TIPO_WHATSAPP[tipo] as "image" | "video"),
        mimetype: arquivo.url.slice(5, arquivo.url.indexOf(";")) || undefined,
        nomeArquivo: arquivo.nome,
        legenda,
      });
      return { enviado: true };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, motivo: "WhatsApp não conectado" };

    const chave = TIPO_WHATSAPP[tipo];
    await enviarPelaCloudApi(conta, conversa.contato, {
      type: chave,
      [chave]: {
        link: publicado.url,
        // Áudio não aceita legenda na Cloud API, e documento usa `filename` além dela.
        ...(legenda && tipo !== "audio" ? { caption: legenda } : {}),
        ...(tipo === "documento" ? { filename: arquivo.nome } : {}),
      },
    });
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}
