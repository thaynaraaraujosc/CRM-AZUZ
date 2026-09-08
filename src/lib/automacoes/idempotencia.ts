import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * "Este evento já foi processado por este fluxo?": a trava contra disparo repetido.
 *
 * Isto já existia, mas só pro Instagram (`marcarExecucaoDeAutomacao`, em `instagram-eventos.ts`),
 * usando a mesma tabela. Aqui vira genérico, porque o problema é de todos os canais: a Meta
 * reenvia webhook rotineiramente, o mesmo card pode ser movido em duas abas, e um retry de rede
 * repete a chamada. Sem trava, a pessoa recebe a mesma mensagem duas vezes. E isso é o tipo de
 * erro que o cliente vê antes da gente.
 *
 * A garantia é do BANCO, não do código: a chave é única por (fluxo, evento), então duas chamadas
 * simultâneas não passam as duas. Quem perde a corrida recebe `false` e não faz nada.
 */
export type OrigemEvento =
  | "mensagem"
  | "comentario"
  | "reacao"
  | "clique"
  | "etapa"
  | "formulario"
  | "contato"
  | "cron";

/** Monta a chave do evento. Mesmo formato em todo canal: "<origem>:<id do evento>". */
export function chaveDeEvento(origem: OrigemEvento, id: string): string {
  return `${origem}:${id}`;
}

/**
 * `true` na PRIMEIRA vez que este par (fluxo, evento) aparece; `false` nas repetições.
 *
 * Em caso de erro inesperado do banco devolve `true`. Deixar de executar por causa de uma falha
 * de infraestrutura seria pior do que a chance de repetir: a automação é o que responde o cliente.
 */
export async function primeiraVezPara(params: {
  workspaceId: string;
  fluxoId: string;
  chaveEvento: string;
  /** Quem era a pessoa do outro lado, quando o canal informa: ajuda a investigar disparo indevido. */
  instagramUserId?: string | null;
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
    console.error("[automacao] falha na trava de idempotência:", erro instanceof Error ? erro.message : erro);
    return true;
  }
}
