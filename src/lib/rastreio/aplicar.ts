import { randomBytes } from "node:crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { lerCodigoDaMensagem } from "@/lib/rastreio/codigo";
import type { OrigemCapturada } from "@/lib/rastreio/origem";

/**
 * Fecha o ciclo: a mensagem chegou, o clique estava guardado, o lead ganha origem.
 *
 * Este é o ponto exato em que o rastreamento deixa de ser promessa. Antes daqui existem duas
 * metades soltas — um clique sem pessoa e uma pessoa sem clique — e nenhuma das duas serve pra
 * nada sozinha. O código curto dentro da mensagem é o que costura as duas.
 *
 * NUNCA LANÇA. É chamado de dentro do webhook, no meio do caminho de uma mensagem de cliente. Uma
 * falha aqui não pode impedir a mensagem de ser gravada e aparecer na tela: atribuição é o
 * acessório, a conversa é o essencial.
 */

export type ResultadoDaAtribuicao =
  | { atribuido: false; motivo: "sem-codigo" | "codigo-desconhecido" | "ja-usado" | "ja-tem-origem" | "falha" }
  | { atribuido: true; campanhaNome?: string };

function comoOrigem(dados: Prisma.JsonValue): OrigemCapturada | null {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const bruto = dados as Record<string, unknown>;
  if (typeof bruto.cliqueId !== "string" || typeof bruto.plataforma !== "string") return null;
  return bruto as unknown as OrigemCapturada;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim().slice(0, 255) : null;
}

/**
 * Procura o código na mensagem e, achando, cola a origem no contato.
 *
 * `workspaceId` vem de quem recebeu o webhook, nunca da mensagem. Sem isso, bastaria alguém
 * descobrir o formato do código pra mandar uma mensagem com o código de outra empresa e roubar a
 * atribuição dela.
 */
export async function aplicarOrigemPelaMensagem(
  cliente: PrismaClient,
  params: { workspaceId: string; contatoId: string; mensagem: string | null | undefined },
): Promise<ResultadoDaAtribuicao> {
  const codigo = lerCodigoDaMensagem(params.mensagem);
  if (!codigo) return { atribuido: false, motivo: "sem-codigo" };

  try {
    const clique = await cliente.cliqueRastreado.findUnique({ where: { codigo } });
    // Código que não é desta empresa responde igual a código inexistente: não confirma nem nega
    // que ele existe em outro lugar.
    if (!clique || clique.workspaceId !== params.workspaceId) {
      return { atribuido: false, motivo: "codigo-desconhecido" };
    }
    /*
     * Um código atribui UMA pessoa, uma vez.
     *
     * Mensagem é encaminhada o tempo todo: alguém recebe a mensagem pronta, acha o serviço
     * interessante e repassa pra uma amiga, que manda o mesmo texto com o mesmo código. Sem esta
     * trava as duas seriam atribuídas ao mesmo clique, e o Google receberia duas vendas por um
     * anúncio que gerou uma.
     */
    if (clique.consumidoEm) return { atribuido: false, motivo: "ja-usado" };

    const origem = comoOrigem(clique.dados);
    if (!origem) return { atribuido: false, motivo: "falha" };

    // Primeiro toque manda. Quem já tem origem não é sobrescrito: o anúncio que trouxe a pessoa
    // pela primeira vez é o que merece o crédito, e não o último link em que ela clicou.
    const jaTem = await cliente.origemDoLead.findUnique({ where: { contatoId: params.contatoId } });
    if (jaTem) {
      await cliente.cliqueRastreado.update({ where: { codigo }, data: { consumidoEm: new Date() } });
      return { atribuido: false, motivo: "ja-tem-origem" };
    }

    await cliente.origemDoLead.create({
      data: {
        id: `origem-${randomBytes(12).toString("hex")}`,
        workspaceId: params.workspaceId,
        contatoId: params.contatoId,
        plataforma: origem.plataforma,
        cliqueId: origem.cliqueId,
        tipoDoClique: origem.tipoDoClique,
        campanhaId: texto(origem.campanhaId),
        campanhaNome: texto(origem.campanhaNome),
        conjuntoId: texto(origem.conjuntoId),
        conjuntoNome: texto(origem.conjuntoNome),
        anuncioId: texto(origem.anuncioId),
        anuncioNome: texto(origem.anuncioNome),
        palavraChave: texto(origem.palavraChave),
        utmSource: texto(origem.utmSource),
        utmMedium: texto(origem.utmMedium),
        utmCampaign: texto(origem.utmCampaign),
        utmContent: texto(origem.utmContent),
        utmTerm: texto(origem.utmTerm),
        paginaEntrada: origem.paginaEntrada ?? null,
        caminho: "whatsapp",
        bruto: (origem.bruto ?? {}) as Prisma.InputJsonValue,
      },
    });
    await cliente.cliqueRastreado.update({ where: { codigo }, data: { consumidoEm: new Date() } });

    return { atribuido: true, campanhaNome: texto(origem.campanhaNome) ?? undefined };
  } catch (erro) {
    console.error("[rastreio] falha ao atribuir a origem:", erro);
    return { atribuido: false, motivo: "falha" };
  }
}

/**
 * O caminho da Meta, que não precisa de código nenhum.
 *
 * Quando o anúncio é de Click-to-WhatsApp ou Click-to-Direct, a própria Meta manda a referência do
 * anúncio junto da primeira mensagem, no webhook. Não passa por site, não precisa de link trocado,
 * não precisa de marcador no texto: chega pronto. É por isso que o rastreamento da Meta funciona
 * pra qualquer cliente do CRM no primeiro dia, sem ninguém configurar nada.
 */
export async function aplicarOrigemPelaReferenciaDaMeta(
  cliente: PrismaClient,
  params: {
    workspaceId: string;
    contatoId: string;
    referencia: { source_id?: string; ad_id?: string; ctwa_clid?: string; headline?: string; source_type?: string } | null | undefined;
    caminho: "whatsapp" | "instagram";
  },
): Promise<ResultadoDaAtribuicao> {
  const ref = params.referencia;
  const anuncioId = texto(ref?.ad_id ?? ref?.source_id);
  const clique = texto(ref?.ctwa_clid);
  if (!anuncioId && !clique) return { atribuido: false, motivo: "sem-codigo" };

  try {
    const jaTem = await cliente.origemDoLead.findUnique({ where: { contatoId: params.contatoId } });
    if (jaTem) return { atribuido: false, motivo: "ja-tem-origem" };

    await cliente.origemDoLead.create({
      data: {
        id: `origem-${randomBytes(12).toString("hex")}`,
        workspaceId: params.workspaceId,
        contatoId: params.contatoId,
        plataforma: "meta",
        // `ctwa_clid` é o equivalente do gclid pro clique que vai direto pra conversa. Quando ele
        // não vem, o anúncio sozinho ainda permite atribuir a campanha na tela, só não permite
        // devolver a conversão por clique.
        cliqueId: clique,
        tipoDoClique: clique ? "ctwa_clid" : null,
        anuncioId,
        anuncioNome: texto(ref?.headline),
        caminho: params.caminho,
        bruto: (ref ?? {}) as Prisma.InputJsonValue,
      },
    });
    return { atribuido: true };
  } catch (erro) {
    console.error("[rastreio] falha ao atribuir pela referência da Meta:", erro);
    return { atribuido: false, motivo: "falha" };
  }
}
