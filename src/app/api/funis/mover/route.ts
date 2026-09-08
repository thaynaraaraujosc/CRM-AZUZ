import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispararGatilhosDaEtapa } from "@/lib/funil/gatilhos-etapa";
import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";
import { aoSairDaEtapa } from "@/lib/automacoes/gatilhos-crm";

/**
 * Move UM negócio: de etapa, de funil e/ou de responsável. Numa chamada só, gravada na hora.
 *
 * Existe porque até aqui o funil inteiro era reconciliado por um PUT de estado completo, com 500ms
 * de espera. Isso tinha três consequências ruins:
 *
 * 1. Uma falha derrubava TUDO. O PUT é uma transação só; se qualquer parte falhava, nada era
 *    gravado: nem o funil novo, nem a etapa nova, nem o card arrastado. E o cliente não conferia
 *    o resultado da resposta, então a falha era invisível: a tela mostrava a mudança feita e o
 *    banco não tinha nada.
 * 2. "Não veio no payload" significava "apague". Um estado desatualizado do navegador podia apagar
 *    do banco o que outra aba (ou o webhook) tinha acabado de criar.
 * 3. Arrastar um card e recarregar em menos de 500ms perdia o movimento.
 *
 * Aqui é o oposto: uma operação, um registro, resposta imediata e um erro que o front consegue ver
 *. E desfazer na tela se a gravação não aconteceu.
 *
 * O card é o MESMO registro do começo ao fim: muda de etapa, nunca é recriado. É o que garante que
 * histórico, valor e data de fechamento sigam o negócio ao mudar de funil.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { cardId, etapaId, responsavel, ordem } = (await request.json()) as {
    cardId?: string;
    etapaId?: string;
    /** `null` remove o responsável; ausente mantém o atual. */
    responsavel?: string | null;
    ordem?: number;
  };

  if (!cardId) return NextResponse.json({ erro: "cardId é obrigatório" }, { status: 400 });

  // Posse conferida pelos DOIS lados, sempre pelo workspace da sessão e nunca por id vindo da
  // requisição: um id de outra empresa não pode ser lido nem escrito, e um card não pode ser
  // empurrado pra uma etapa que não é da mesma empresa.
  const card = await prisma.negocioCard.findFirst({ where: { id: cardId, workspaceId } });
  if (!card) return NextResponse.json({ erro: "Negócio não encontrado." }, { status: 404 });

  if (etapaId) {
    const etapa = await prisma.funilEtapa.findFirst({
      where: { id: etapaId, workspaceId },
      select: { id: true },
    });
    if (!etapa) {
      return NextResponse.json({ erro: "Etapa não encontrada neste workspace." }, { status: 400 });
    }
  }

  /**
   * Card que muda de etapa entra no TOPO da etapa nova.
   *
   * A lista de cada etapa é lida ordenada por `ordem`, e mover só trocava a etapa: o card levava
   * junto o número que tinha na etapa antiga, e ia parar em qualquer lugar da nova. Na prática caía
   * no fim, porque etapa cheia tem números maiores. Quem acabou de responder aparecia embaixo de
   * gente de cinco dias atrás, o que inverte exatamente a leitura que um funil precisa ter.
   *
   * A conta é o menor `ordem` do destino menos um, e não renumerar a etapa inteira: renumerar
   * seriam N escritas a cada arraste, e a mesma coisa acontece com uma subtração. Número negativo
   * não incomoda ninguém, porque o que importa aqui é a ordem relativa.
   *
   * Fica no SERVIDOR porque é ele que guarda a verdade: o navegador que arrastou não sabe o que as
   * outras abas fizeram com a etapa de destino desde que carregou a tela.
   */
  const ordemFinal = await (async () => {
    if (ordem !== undefined) return ordem;
    if (!etapaId || etapaId === card.etapaId) return undefined;
    const primeiro = await prisma.negocioCard.findFirst({
      where: { etapaId, workspaceId },
      orderBy: { ordem: "asc" },
      select: { ordem: true },
    });
    return primeiro ? primeiro.ordem - 1 : 0;
  })();

  const atualizado = await prisma.negocioCard.update({
    where: { id: cardId },
    data: {
      ...(etapaId ? { etapaId } : {}),
      ...(ordemFinal !== undefined ? { ordem: ordemFinal } : {}),
      // `undefined` mantém o valor atual; `null` limpa. Sem essa distinção, mudar só o funil
      // apagaria o responsável sem ninguém pedir.
      ...(responsavel !== undefined ? { responsavel } : {}),
    },
    select: { id: true, etapaId: true, responsavel: true },
  });

  // O gatilho "entrou na etapa" acontece AQUI, no servidor: não no navegador de quem arrastou.
  // Antes ele só valia pra quem estava com a tela aberta, e o mesmo movimento vindo de outro
  // caminho (importação, webhook, outra aba) não disparava nada.
  if (etapaId && etapaId !== card.etapaId) {
    const [etapa, etapaAnterior] = await Promise.all([
      prisma.funilEtapa.findFirst({ where: { id: etapaId, workspaceId }, select: { titulo: true, funilId: true } }),
      prisma.funilEtapa.findFirst({ where: { id: card.etapaId, workspaceId }, select: { titulo: true, funilId: true } }),
    ]);

    // "Saiu" antes de "entrou": é a ordem em que as duas coisas acontecem, e um fluxo de despedida
    // que rodasse depois do de boas-vindas contaria a história ao contrário.
    aoSairDaEtapa({
      workspaceId,
      contatoNome: card.nome,
      funilId: etapaAnterior?.funilId,
      etapaId: card.etapaId,
      etapaTitulo: etapaAnterior?.titulo,
      cardId,
    });
    await dispararAutomacoesDoCrm({
      workspaceId,
      contatoNome: card.nome,
      tipoGatilho: "lead_entrou_etapa",
      funilId: etapa?.funilId,
      etapaId,
      etapaTitulo: etapa?.titulo,
      // A trava é por minuto de propósito. Ela precisa segurar o clique repetido e o retry de
      // rede (que chegam juntos), sem segurar a entrada de amanhã: sair da etapa e voltar depois é
      // uma entrada nova, e "entrou na etapa" tem que disparar de novo.
      chaveEvento: `etapa:${cardId}:${etapaId}:${new Date().toISOString().slice(0, 16)}`,
    }).catch((erro) => console.error("[funil] falha ao disparar automações de etapa:", erro));

    // Os gatilhos que moram NA ETAPA (o quadro "Automatizar" do funil). Rodam junto com os fluxos
    // que têm gatilho próprio, não no lugar deles: são duas formas de ligar a mesma automação, e
    // desligar uma não pode desligar a outra.
    dispararGatilhosDaEtapa({
      workspaceId,
      etapaId,
      contatoNome: card.nome,
      evento: "movido",
    }).catch((erro) => console.error("[funil] falha ao disparar gatilhos da etapa:", erro));
  }

  return NextResponse.json({ ok: true, card: atualizado }, { headers: { "cache-control": "no-store" } });
}
