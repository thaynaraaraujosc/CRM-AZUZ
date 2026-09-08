import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Faz uma mensagem que o CRM enviou aparecer na tela de Conversas.
 *
 * Sem isto a conversa fica pela metade: a automação pergunta "tudo bem?", a pessoa responde "Sim",
 * e quem abre a conversa vê só o "Sim". Sem a pergunta. Foi exatamente o que aconteceu no primeiro
 * teste real: a mensagem chegou no WhatsApp do contato e não existia no CRM.
 *
 * O disparo em massa já fazia isso (`registrarEnvioNaConversa`), mas amarrado a campanha e
 * destinatário. Aqui é a versão de uso geral: serve pra automação e pra qualquer outro caminho que
 * mande mensagem pelo servidor.
 *
 * Nunca derruba quem chamou: a mensagem JÁ saiu quando isto roda. Falhar aqui é perder o registro,
 * não o envio: e derrubar a automação por causa do registro seria trocar um problema pequeno por
 * um grande.
 */
export async function registrarMensagemEnviada(params: {
  workspaceId: string;
  contatoNome: string;
  texto: string;
  /** Id da Meta, quando existe: é por ele que o webhook de entregue/lido acha esta bolha. */
  wamid?: string | null;
  /** Botões/opções que foram junto, pra bolha mostrar o que a pessoa viu. */
  opcoes?: string[];
  /** Marca de origem no histórico ("automacao", "manual"). */
  origem?: string;
}): Promise<void> {
  try {
    const conversa = await prisma.conversa.findUnique({
      where: { workspaceId_nome: { workspaceId: params.workspaceId, nome: params.contatoNome } },
      select: { canal: true, contaCanal: true },
    });
    // Sem conversa não há onde registrar. Não é erro: o envio pode ter ido por um caminho que ainda
    // não abriu thread (e-mail, por exemplo).
    if (!conversa) return;

    const agora = new Date();
    await prisma.mensagemExtra.create({
      data: {
        id: params.wamid ?? `auto-${randomUUID()}`,
        workspaceId: params.workspaceId,
        contato: params.contatoNome,
        tipo: "out",
        texto: params.texto,
        hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        criadoEm: agora,
        status: "enviado",
        canal: conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:")
          ? "whatsapp_baileys"
          : null,
        contaCanal: conversa.contaCanal,
        wamid: params.wamid ?? null,
        extras: {
          ...(params.origem ? { origem: params.origem } : {}),
          ...(params.opcoes?.length ? { botoes: params.opcoes } : {}),
        },
      },
    });
  } catch (erro) {
    console.error("[conversas] falha ao registrar mensagem enviada:", erro instanceof Error ? erro.message : erro);
  }
}
