import { prisma } from "@/lib/prisma";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { CANAL_INSTAGRAM, CANAL_NAO_OFICIAL, CANAL_OFICIAL, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import type { CanalCampanha } from "./ritmo";

/**
 * Faz a mensagem de um disparo em massa aparecer na tela de Conversas, como qualquer outra que o
 * CRM mandou.
 *
 * Sem isto a conversa ficava pela metade: a pessoa respondia "Sim" e quem abria a conversa via só
 * o "Sim", sem a pergunta. O disparo é uma mensagem nossa e precisa estar no histórico. É o que
 * permite entender a resposta, e é onde o webhook de status (entregue/lido) encontra a bolha pra
 * atualizar o tiquinho.
 *
 * Só WhatsApp (oficial e QR): e-mail não tem conversa na tela hoje. Nunca derruba o envio: se
 * falhar aqui, a mensagem já saiu e o destinatário já está marcado; loga e segue.
 */
export async function registrarEnvioNaConversa(params: {
  workspaceId: string;
  canal: CanalCampanha;
  contatoNome: string;
  destino: string;
  texto: string;
  botoes?: { texto: string }[] | null;
  wamid?: string;
  destinatarioId: string;
  campanhaId: string;
  /** `phoneNumberId` (oficial) ou número conectado (QR), pra ligar a mensagem à conexão certa. */
  identificadorConexao: string | null;
}): Promise<void> {
  if (params.canal === "email") return;
  try {
    const instagram = params.canal === "instagram";
    const oficial = params.canal === "whatsapp_oficial";
    const provedor = instagram ? CANAL_INSTAGRAM : oficial ? CANAL_OFICIAL : CANAL_NAO_OFICIAL;
    const contaCanal = contaCanalDaConexao(provedor, params.identificadorConexao);
    const agora = new Date();
    await prisma.mensagemExtra.create({
      data: {
        // O `wamid` é o id que o webhook de status usa pra achar a bolha; sem ele (QR), um id nosso.
        id: params.wamid ?? `disparo-${params.destinatarioId}`,
        workspaceId: params.workspaceId,
        contato: params.contatoNome,
        tipo: "out",
        texto: params.texto,
        hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        criadoEm: agora,
        status: "enviado",
        // Nulo só no oficial, por compatibilidade com o histórico anterior a esta coluna.
        canal: oficial ? null : provedor,
        contaCanal,
        wamid: params.wamid ?? null,
        extras: {
          disparoId: params.campanhaId,
          ...(params.botoes?.length ? { botoes: params.botoes.map((b) => b.texto) } : {}),
        },
      },
    });
    await upsertConversaAoReceberMensagem({
      workspaceId: params.workspaceId,
      nome: params.contatoNome,
      canal: instagram ? "Instagram" : "WhatsApp",
      contato: params.destino,
      origem: "Direto",
      contarComoNaoLida: false,
      contaCanal,
    });
  } catch (erro) {
    console.error("[campanhas] falha ao registrar envio na conversa:", erro instanceof Error ? erro.message : erro);
  }
}
