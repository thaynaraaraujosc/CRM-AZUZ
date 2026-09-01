import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import {
  classificarErroMeta,
  ocultarComentarioInstagram,
  responderComentarioInstagram,
} from "@/lib/integracoes/instagram-login";
import { anotarNaLinhaDoTempo, concluirEvento, registrarEvento } from "@/lib/integracoes/instagram-eventos";
import { criarContatoPeloInstagramSeNaoExistir } from "@/lib/contatos/upsert";
import { dispararAutomacoesDeEventoInstagram } from "@/lib/automation-flow/disparar-no-servidor";

/**
 * Comentários do Instagram — recebimento, normalização e disparo das automações.
 *
 * Vive fora do webhook de propósito. O webhook agora faz só o que é dele: conferir a assinatura,
 * achar de quem é a conta e entregar o payload pra quem sabe interpretá-lo. Toda a decisão sobre o
 * que um comentário significa está aqui, num arquivo que dá pra ler inteiro.
 *
 * O que a Meta manda em `entry[].changes[]` com `field: "comments"`:
 * - `value.id` — id do comentário (nossa chave de deduplicação)
 * - `value.text` — o que a pessoa escreveu
 * - `value.from` — quem escreveu (id + username). PODE VIR VAZIO: em conta sem o vínculo
 *   necessário a Meta omite o autor, e sem ele não há a quem responder no Direct.
 * - `value.media` — a publicação comentada (id e tipo)
 * - `value.parent_id` — presente só quando é RESPOSTA a outro comentário
 */

export type ComentarioInstagram = {
  id?: string;
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string; media_product_type?: string };
  parent_id?: string;
};

export async function processarComentarioInstagram(params: {
  workspaceId: string;
  contaInstagramId: string;
  accessTokenCriptografado: string | null;
  comentario: ComentarioInstagram;
}): Promise<void> {
  const { workspaceId, contaInstagramId, comentario } = params;

  const comentarioId = comentario.id;
  if (!comentarioId) return;

  // Comentário da PRÓPRIA conta — inclusive a resposta automática que acabou de sair daqui. Sem
  // esta guarda, responder um comentário dispararia a automação de novo, que responderia de novo:
  // a conta entraria numa discussão infinita consigo mesma, em público, na publicação.
  if (comentario.from?.id && comentario.from.id === contaInstagramId) return;

  const texto = comentario.text ?? "";
  const ehResposta = Boolean(comentario.parent_id);
  const arroba = comentario.from?.username ? `@${comentario.from.username}` : null;
  // Sem @ nem id, não há contato nem conversa possível — mas o evento é registrado assim mesmo,
  // pra que "não disparou" fique distinguível de "não chegou".
  const chaveContato = arroba ?? comentario.from?.id ?? `comentario:${comentarioId}`;

  const primeiraVez = await registrarEvento(workspaceId, {
    id: `comentario:${comentarioId}`,
    tipo: ehResposta ? "resposta_comentario" : "comentario_criado",
    contaInstagramId,
    contatoNome: chaveContato,
    remetenteId: comentario.from?.id,
    remetenteUsername: comentario.from?.username,
    comentarioId,
    comentarioPaiId: comentario.parent_id,
    midiaId: comentario.media?.id,
    texto,
    dados: { tipoPublicacao: comentario.media?.media_product_type ?? null },
  });
  // Webhook reenviado pela Meta: já foi tratado, sair sem fazer nada é o comportamento certo.
  if (!primeiraVez) return;

  try {
    // Vira contato de verdade no CRM — sem duplicar quem já existe (a busca é por @, ignorando
    // arroba e caixa).
    if (arroba) {
      await criarContatoPeloInstagramSeNaoExistir({
        workspaceId,
        nome: arroba,
        instagram: arroba,
      }).catch((erro) => console.error("[instagram-comentarios] falha ao criar contato:", erro));
    }

    await anotarNaLinhaDoTempo({
      workspaceId,
      contatoNome: chaveContato,
      canal: "Instagram",
      tipo: ehResposta ? "respondeu_comentario" : "comentou",
      descricao: ehResposta
        ? `respondeu um comentário: "${texto.slice(0, 120)}"`
        : `comentou: "${texto.slice(0, 120)}"`,
      dados: { comentarioId, publicacaoId: comentario.media?.id ?? null },
    });

    const token = params.accessTokenCriptografado ? decriptar(params.accessTokenCriptografado) : null;

    await dispararAutomacoesDeEventoInstagram({
      workspaceId,
      contatoNome: chaveContato,
      tipoGatilho: ehResposta ? "instagram_resposta_comentario" : "comentario_instagram",
      textoRecebido: texto,
      publicacaoId: comentario.media?.id,
      // A trava é por comentário: o mesmo fluxo nunca roda duas vezes pro mesmo comentário.
      chaveEvento: `comentario:${comentarioId}`,
      instagramUserId: comentario.from?.id,
      responderComentario: token
        ? async (resposta) => {
            await responderComentarioInstagram(token, comentarioId, resposta);
            await anotarNaLinhaDoTempo({
              workspaceId,
              contatoNome: chaveContato,
              canal: "Instagram",
              tipo: "crm_respondeu_comentario",
              descricao: `CRM respondeu o comentário: "${resposta.slice(0, 120)}"`,
              dados: { comentarioId },
            });
          }
        : undefined,
    });

    await concluirEvento(`comentario:${comentarioId}`);
  } catch (erro) {
    const bruto = erro instanceof Error ? erro.message : String(erro);
    const { motivo, explicacao } = classificarErroMeta(bruto);
    // Guardado no evento, não só no log: sem isso, uma automação que parou de responder por token
    // vencido falhava em silêncio e ninguém descobria até o cliente reclamar.
    console.error(`[instagram-comentarios] falha (${motivo}):`, bruto);
    await concluirEvento(`comentario:${comentarioId}`, `${motivo}: ${explicacao}`);
  }
}

/** Oculta um comentário — exposto pra ação de moderação da automação e pra uso manual. */
export async function ocultarComentario(params: {
  accessTokenCriptografado: string;
  comentarioId: string;
  ocultar: boolean;
}): Promise<void> {
  const token = decriptar(params.accessTokenCriptografado);
  await ocultarComentarioInstagram(token, params.comentarioId, params.ocultar);
}
