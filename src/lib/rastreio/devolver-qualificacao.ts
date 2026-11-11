import { prisma } from "@/lib/prisma";
import { viraSinalDeAnuncio } from "@/lib/contatos/qualificacao";
import { enfileirarConversao } from "@/lib/rastreio/fila-de-conversoes";
import { identificadoresDoLead } from "@/lib/rastreio/identificadores-do-lead";
import type { PlataformaDeConversao } from "@/lib/rastreio/eventos-de-conversao";

/**
 * "BOM" VOLTA PRO ANÚNCIO, na hora em que alguém marca.
 *
 * "Coloca pra eu dizer se o cliente é bom, curioso — porque todas essas inteligências têm que levar
 * a um lugar, que é um retorno pros anúncios que estão ativos, pro Google, pra Meta." E, na
 * pergunta de quais plataformas: "meta e google".
 *
 * É o elo que faltava. O CRM já sabia devolver venda ganha, mas venda demora semanas; a
 * qualificação acontece no mesmo dia da conversa. Mandando `lead_qualified`, as duas plataformas
 * aprendem AGORA com quem presta, em vez de esperar o fim do funil — que é justamente o que a
 * otimização por lead qualificado existe pra fazer.
 *
 * SÓ "BOM", e isso não é detalhe: devolver "curioso" como lead qualificado ensinaria o algoritmo a
 * procurar mais curiosos, e a qualificação passaria a PIORAR a campanha. A regra mora em
 * `viraSinalDeAnuncio`, com o resto do raciocínio.
 *
 * SÓ NA MUDANÇA, e uma vez. Quem já estava marcado como bom e tem outro campo editado não gera
 * sinal novo — e mesmo que gerasse, a chave de idempotência da fila recusaria o segundo. As duas
 * guardas existem porque elas respondem a coisas diferentes: esta evita o trabalho, a da fila
 * garante o resultado.
 *
 * VOLTAR ATRÁS NÃO DESFAZ. Marcar "bom" e depois "curioso" não estorna nada: o estorno existe no
 * CRM só pra venda ganha (ver `estornarConversoes`), e um lead qualificado não tem valor pra
 * devolver. Quem corrigiu a marcação no mesmo dia mandou um sinal a mais, e um sinal a mais num
 * lead é ruído, não estrago — ao contrário de uma venda inventada.
 *
 * NÃO LANÇA. Enfileirar conversão não pode derrubar o salvamento do contato que a originou:
 * a marcação é o essencial e o sinal é o acessório. Mesmo motivo escrito em `fila-de-conversoes.ts`.
 */

/**
 * PRA ONDE O SINAL VAI: Meta e Google.
 *
 * Escolhido pela Thaynara em 11/11/2026, quando perguntei. TikTok e GA4 existem na lista de
 * plataformas da fila mas ainda não têm conexão no CRM: enfileirar pra eles produziria linha
 * "falhou" com um motivo que não é culpa de ninguém, e ninguém pediu.
 */
const PLATAFORMAS = ["meta", "google"] as const satisfies readonly PlataformaDeConversao[];

export async function aoQualificarLead(params: {
  workspaceId: string;
  contatoId: string;
  /** A qualificação de antes da gravação. */
  antes: unknown;
  /** A qualificação depois da gravação. */
  depois: unknown;
}): Promise<void> {
  const { workspaceId, contatoId, antes, depois } = params;
  if (antes === depois) return;
  if (!viraSinalDeAnuncio(depois)) return;

  try {
    const contato = await prisma.contato.findFirst({
      where: { id: contatoId, workspaceId },
      select: { id: true, email: true, whatsapp: true, origemDoLead: true },
    });
    if (!contato) return;

    for (const plataforma of PLATAFORMAS) {
      await enfileirarConversao(prisma, {
        workspaceId,
        contatoId: contato.id,
        plataforma,
        evento: "lead_qualified",
        /*
         * SEM VALOR, e de propósito: um lead qualificado não tem preço. Ver `eventoCarregaValor` —
         * mandar zero afirmaria que ele vale nada, e as duas plataformas leem isso como dado.
         */
        valor: null,
        moeda: null,
        /*
         * O "RESULTADO" É O PRÓPRIO LEAD, não um negócio.
         *
         * A chave de idempotência da fila é workspace + lead + plataforma + evento + resultado, e
         * aqui o resultado é vazio — vira "unico". É o que faz a qualificação valer UMA VEZ por
         * lead: marcar bom, trocar pra curioso e voltar pra bom manda um sinal, não três. Uma venda
         * é diferente (o mesmo cliente pode comprar duas vezes, e aí são duas conversões de
         * verdade), e por isso ela carrega o id do negócio.
         */
        resultadoId: null,
        identificadores: identificadoresDoLead(contato.origemDoLead, contato),
      });
    }
  } catch (erro) {
    // Nenhum dado do lead no log: o id do contato e nada mais.
    console.error("[conversoes] falha ao devolver a qualificação:", { contatoId, erro });
  }
}
