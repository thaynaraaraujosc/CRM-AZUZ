import type { PrismaClient } from "@/generated/prisma/client";

import { WORKSPACE_DEMO } from "@/lib/demo/dados-demo";

export type ResumoLimpezaDemo = {
  mensagens: number;
  conversas: number;
  cards: number;
  tarefas: number;
  contatos: number;
};

/**
 * Apaga o conteúdo FICTÍCIO da conta de demonstração, preservando o que chegou de verdade.
 *
 * Por que não serve remontar: `semearDemo` apaga o workspace inteiro e recria. Quando um número
 * real está conectado na demonstração — e já esteve — remontar leva junto a conversa de gente de
 * verdade que caiu ali. Isso aqui é o oposto: tira só o cenário montado e deixa o resto.
 *
 * A COMO SE SABE O QUE É FICTÍCIO: todo registro criado por `semearDemo` nasce com id prefixado
 * por `demo-` (`demo-contato-3`, `demo-conversa-3`, `demo-msg-3-1`, `demo-card-3`,
 * `demo-fechado-2`, `demo-tarefa-0`). O que chega pelos webhooks usa outro formato
 * (`conversa-<workspace>-<slug do nome>`), e contato criado à mão usa outro ainda. Então o filtro
 * é exato, não heurístico: nenhuma linha de verdade começa com `demo-`.
 *
 * As duas condições valem JUNTAS, e nenhuma vem do cliente: o workspace é a constante
 * `WORKSPACE_DEMO` e o prefixo é fixo. Não existe entrada que faça isto apagar dado de outra conta.
 *
 * Fora do alcance de propósito: o funil e suas etapas (a estrutura fica, só os cards saem), a
 * assinatura, as integrações, o workspace e o membro `demo-demonstracao` — que é justamente o
 * login da demonstração, e apagá-lo tiraria o acesso à conta.
 */
export async function limparConteudoDaDemo(prisma: PrismaClient): Promise<ResumoLimpezaDemo> {
  const semeado = { workspaceId: WORKSPACE_DEMO, id: { startsWith: "demo-" } };

  // Ordem importa: mensagem referencia conversa, card referencia contato. Do mais dependente pro
  // menos, senão a chave estrangeira recusa.
  return prisma.$transaction(async (tx) => {
    const mensagens = await tx.mensagemExtra.deleteMany({ where: semeado });
    const conversas = await tx.conversa.deleteMany({ where: semeado });
    const cards = await tx.negocioCard.deleteMany({ where: semeado });
    const tarefas = await tx.tarefaCard.deleteMany({ where: semeado });
    const contatos = await tx.contato.deleteMany({ where: semeado });

    return {
      mensagens: mensagens.count,
      conversas: conversas.count,
      cards: cards.count,
      tarefas: tarefas.count,
      contatos: contatos.count,
    };
  });
}
