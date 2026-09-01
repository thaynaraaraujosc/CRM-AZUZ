import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Eventos do Instagram, normalizados — a fronteira entre o formato da Meta e o resto do CRM.
 *
 * Nada fora deste arquivo (e do webhook que o alimenta) precisa saber que a Meta chama resposta a
 * story de `reply_to.story`, que reação vem em `reaction` e não em `message`, ou que comentário
 * chega em `changes` e mensagem em `messaging`. O CRM lê tipos com nome de CRM.
 *
 * O ganho concreto: acrescentar um evento novo (comentário, menção) passa a ser escrever a tradução
 * aqui, em vez de espalhar conhecimento do payload por webhook, automações, timeline e telas.
 */

/** Tipos que o CRM entende. Nomes do domínio, não da API. */
export type TipoEventoInstagram =
  | "mensagem_recebida"
  | "mensagem_enviada"
  | "midia_recebida"
  | "publicacao_compartilhada"
  | "story_respondido"
  | "mencao_em_story"
  | "reacao_adicionada"
  | "reacao_removida"
  | "comentario_criado"
  | "resposta_comentario";

export type EventoInstagramNormalizado = {
  /** Chave natural na Meta (`mid` da mensagem, id do comentário). É o que garante a dedup. */
  id: string;
  tipo: TipoEventoInstagram;
  contaInstagramId: string;
  contatoNome?: string;
  remetenteId?: string;
  remetenteUsername?: string;
  mensagemId?: string;
  midiaId?: string;
  comentarioId?: string;
  comentarioPaiId?: string;
  permalink?: string;
  texto?: string;
  dados?: Record<string, unknown>;
};

/**
 * Grava o evento. Devolve `false` se ele já existia — o webhook foi reenviado.
 *
 * A Meta reenvia webhook rotineiramente (por timeout, por retentativa, por entrega em duplicidade),
 * e sem trava o mesmo comentário dispararia a mesma automação de novo: o cliente receberia a mesma
 * resposta duas ou três vezes. A trava é a própria chave primária — a segunda gravação falha por
 * construção, não por alguém ter lembrado de checar antes.
 */
export async function registrarEvento(
  workspaceId: string,
  evento: EventoInstagramNormalizado,
): Promise<boolean> {
  try {
    await prisma.instagramEvento.create({
      data: {
        id: evento.id,
        workspaceId,
        contaInstagramId: evento.contaInstagramId,
        tipo: evento.tipo,
        contatoNome: evento.contatoNome ?? null,
        remetenteId: evento.remetenteId ?? null,
        remetenteUsername: evento.remetenteUsername ?? null,
        mensagemId: evento.mensagemId ?? null,
        midiaId: evento.midiaId ?? null,
        comentarioId: evento.comentarioId ?? null,
        comentarioPaiId: evento.comentarioPaiId ?? null,
        permalink: evento.permalink ?? null,
        texto: evento.texto ?? null,
        dados: (evento.dados ?? undefined) as object | undefined,
      },
    });
    return true;
  } catch (erro) {
    // P2002 = chave duplicada, que aqui é o caso ESPERADO de reenvio. Qualquer outro erro é
    // problema de verdade e precisa aparecer no log.
    const codigo = (erro as { code?: string }).code;
    if (codigo === "P2002") return false;
    console.error("[instagram-eventos] Falha ao registrar evento:", erro);
    // Deixa passar: um evento que não consegue ser registrado não pode impedir que a mensagem
    // chegue na tela do vendedor. A dedup se perde nesse caso, e é o mal menor.
    return true;
  }
}

/** Marca o evento como processado, ou guarda por que ele falhou. */
export async function concluirEvento(id: string, erro?: string): Promise<void> {
  await prisma.instagramEvento
    .update({ where: { id }, data: { processado: !erro, erro: erro ?? null } })
    .catch(() => {});
}

/**
 * Se este fluxo já rodou pra este evento.
 *
 * Complementa a dedup do webhook em vez de repeti-la: mesmo com o evento chegando uma vez só, um
 * reprocessamento manual ou uma automação disparada por dois caminhos poderia executar o mesmo
 * fluxo de novo. A unicidade é (fluxo, evento) — o mesmo comentário PODE disparar fluxos
 * diferentes, o que é desejado.
 */
export async function marcarExecucaoDeAutomacao(params: {
  workspaceId: string;
  fluxoId: string;
  chaveEvento: string;
  instagramUserId?: string;
}): Promise<boolean> {
  try {
    await prisma.automacaoExecucao.create({
      data: {
        id: randomUUID(),
        workspaceId: params.workspaceId,
        fluxoId: params.fluxoId,
        chaveEvento: params.chaveEvento,
        instagramUserId: params.instagramUserId ?? null,
      },
    });
    return true;
  } catch (erro) {
    if ((erro as { code?: string }).code === "P2002") return false;
    console.error("[instagram-eventos] Falha ao registrar execução de automação:", erro);
    return true;
  }
}

/**
 * Anota um acontecimento na linha do tempo do lead.
 *
 * Nunca derruba quem chamou: a timeline é registro, não parte do caminho crítico. Perder uma linha
 * do histórico é ruim; deixar de entregar a mensagem por causa dela seria pior.
 */
export async function anotarNaLinhaDoTempo(params: {
  workspaceId: string;
  contatoNome: string;
  canal: string;
  tipo: string;
  descricao: string;
  dados?: Record<string, unknown>;
}): Promise<void> {
  await prisma.eventoDoLead
    .create({
      data: {
        id: randomUUID(),
        workspaceId: params.workspaceId,
        contatoNome: params.contatoNome,
        canal: params.canal,
        tipo: params.tipo,
        descricao: params.descricao,
        dados: (params.dados ?? undefined) as object | undefined,
      },
    })
    .catch((erro) => console.error("[instagram-eventos] Falha ao anotar na linha do tempo:", erro));
}
