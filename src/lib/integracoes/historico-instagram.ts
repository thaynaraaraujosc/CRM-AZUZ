import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { listarConversasRecentesInstagram } from "@/lib/integracoes/instagram-login";
import { CANAL_INSTAGRAM, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import { criarContatoPeloInstagramSeNaoExistir, encontrarContatoDoInstagram } from "@/lib/contatos/upsert";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";

/**
 * Traz as conversas recentes do Direct logo depois de conectar.
 *
 * Sem isto, conectar o Instagram deixava a caixa de entrada VAZIA até alguém escrever de novo. Quem
 * acabou de conectar olha pra uma tela em branco e conclui, com razão, que não funcionou. O WhatsApp
 * por QR Code já trazia as conversas recentes; não havia motivo pro Direct ser diferente.
 *
 * É seguro repetir quantas vezes for: cada mensagem é gravada com o id que a Meta dá, então a
 * segunda passada reencontra as mesmas e não duplica nada.
 *
 * Só TEXTO, de propósito. Mídia antiga exigiria baixar arquivo por arquivo de conversas que a
 * pessoa talvez nem abra, e foi assim que uma importação de histórico já derrubou o servidor. O que
 * chega daqui pra frente vem completo pelo webhook.
 */
const CONVERSAS_IMPORTADAS = 10;

export async function importarConversasRecentesDoInstagram(
  workspaceId: string,
  limite = CONVERSAS_IMPORTADAS,
): Promise<{ conversas: number; mensagens: number }> {
  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
    select: { status: true, accessTokenCriptografado: true, metadados: true },
  });
  if (integracao?.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return { conversas: 0, mensagens: 0 };
  }

  const metadados = (integracao.metadados as Record<string, unknown> | null) ?? {};
  const contaId = metadados.instagramContaId as string | undefined;
  if (!contaId) return { conversas: 0, mensagens: 0 };

  const contaCanal = contaCanalDaConexao(CANAL_INSTAGRAM, contaId);
  const token = decriptar(integracao.accessTokenCriptografado);
  const recentes = await listarConversasRecentesInstagram(token, contaId, limite);

  let conversas = 0;
  let mensagens = 0;

  for (const thread of recentes) {
    const arroba = thread.username ?? null;
    // Mesma regra de nome do webhook: @ quando existe, senão o nome do perfil, senão o id. Assim a
    // conversa importada e a que chegar depois pelo webhook são a MESMA, e não duas.
    const nome = arroba ? `@${arroba}` : (thread.nome ?? thread.remetenteId);

    const contatoExistente = await encontrarContatoDoInstagram({
      workspaceId,
      arroba: arroba ?? "",
      instagramId: thread.remetenteId,
    });
    const contato =
      contatoExistente ??
      (await criarContatoPeloInstagramSeNaoExistir({
        workspaceId,
        nome,
        instagram: arroba ?? "",
        instagramId: thread.remetenteId,
      }).catch(() => null));

    let gravadas = 0;
    for (const mensagem of thread.mensagens) {
      const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: mensagem.id } });
      if (jaExiste) continue;
      await prisma.mensagemExtra.create({
        data: {
          id: mensagem.id,
          workspaceId,
          contato: nome,
          tipo: mensagem.deMim ? "out" : "in",
          texto: mensagem.texto,
          hora: mensagem.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          criadoEm: mensagem.quando,
          canal: CANAL_INSTAGRAM,
          contaCanal,
        },
      });
      gravadas += 1;
    }
    mensagens += gravadas;

    await upsertConversaAoReceberMensagem({
      workspaceId,
      contaCanal,
      nome,
      canal: "Instagram",
      contato: thread.remetenteId,
      contatoId: contato?.id,
      origem: "Instagram",
      // Conversa antiga não é "não lida": marcar assim encheria a tela de vermelho no primeiro
      // minuto de uso, por mensagem que a pessoa já respondeu lá no aplicativo.
      contarComoNaoLida: false,
    });
    conversas += 1;
  }

  return { conversas, mensagens };
}
