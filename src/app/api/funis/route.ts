import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import type { Funil } from "@/lib/data";
import { auth } from "@/lib/auth";
import { dispararGatilhosDaEtapa } from "@/lib/funil/gatilhos-etapa";
import { prisma } from "@/lib/prisma";
import { filtroConexaoDeNegocio, provedoresDeNegocio } from "@/lib/integracoes/conta-canal";

/** GET lista os funis do workspace de quem está logado, com etapas e negócios, na ordem salva. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Mesmo filtro por conexão das conversas: negócio que nasceu de um canal desconectado some do
  // funil sem sair do banco, e volta inteiro se aquela conexão voltar (ver `conta-canal.ts`). Card
  // criado à mão tem `contaCanal` nulo e aparece sempre.
  const provedores = await provedoresDeNegocio(sessao.user.workspaceId);
  const linhas = await prisma.funil.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    include: {
      etapas: {
        orderBy: { ordem: "asc" },
        include: { cards: { where: filtroConexaoDeNegocio(provedores), orderBy: { ordem: "asc" } } },
      },
    },
  });

  const funis: Funil[] = linhas.map((f) => ({
    id: f.id,
    nome: f.nome,
    responsavel: f.responsavel ?? undefined,
    colunas: f.etapas.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      total: e.cards.length,
      cards: e.cards.map((c) => ({
        id: c.id,
        nome: c.nome,
        valor: c.valor,
        origem: c.origem as Funil["colunas"][number]["cards"][number]["origem"],
        dias: c.dias,
        data: c.data,
        etiquetas: Array.isArray(c.etiquetas) ? (c.etiquetas as string[]) : undefined,
        responsavel: c.responsavel ?? undefined,
        statusFechamento: (c.statusFechamento as "ganho" | "perdido" | null) ?? undefined,
        motivoPerda: c.motivoPerda ?? undefined,
        dataFechamento: c.dataFechamento ? c.dataFechamento.toISOString().slice(0, 10) : undefined,
      })),
    })),
  }));

  return NextResponse.json(funis);
}

/**
 * PUT reconcilia o funil do workspace de quem está logado com o array `funis` mandado pelo front.
 * Não existem mutadores dedicados no Context pra Funil (~13 pontos em
 * `funil/page.tsx`/`FunisSecao.tsx` mexem direto em `setFunis`), então o Provider sincroniza o
 * estado inteiro a cada mudança em vez de granular por operação. Roda numa transação: upsert de
 * cada funil/etapa/card presente, e apaga o que sumiu do array. **sempre filtrado por
 * `workspaceId`** nos `deleteMany`, senão apagaria funis/etapas/cards de outras empresas (qualquer
 * id que não seja dessa empresa "não está no payload dela").
 *
 * O `deleteMany` dos cards leva TAMBÉM o filtro por conexão, e isso não é detalhe: o GET esconde
 * os negócios de um canal desconectado, então o front nunca os recebe. E "não veio no payload"
 * passaria a significar "apague". Sem esta linha, desconectar um canal deixava de esconder os
 * negócios dele e passava a APAGÁ-LOS no primeiro salvamento seguinte. Regra geral: um PUT que
 * reconcilia estado inteiro só pode apagar dentro do mesmo recorte que o GET mostrou.
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const funis = (await request.json()) as Funil[];

  const provedores = await provedoresDeNegocio(workspaceId);

  const idsFunis = funis.map((f) => f.id);
  const idsEtapas = funis.flatMap((f) => f.colunas.map((c) => c.id));
  const idsCards = funis.flatMap((f) => f.colunas.flatMap((c) => c.cards.map((card) => card.id)));

  // Estado ATUAL do banco, lido antes de escrever qualquer coisa.
  //
  // Sem isto, a reconciliação mandava um `upsert` por funil, por etapa e por CARD a cada
  // salvamento: dezenas de idas e voltas até o banco no Railway dentro de UMA transação, com um
  // pool de 3 conexões. Passando dos 20s a transação inteira era abortada por prazo (P2028) e o
  // funil não salvava: era o "O funil é grande demais para salvar de uma vez".
  //
  // O que muda num salvamento real é quase sempre UM card (arrastar, fechar, editar). Comparando
  // com o que já está gravado, a transação passa a levar só o que de fato mudou. De ~50
  // instruções para 1 ou 2 no caso comum.
  const [funisAtuais, etapasAtuais, cardsAtuais] = await Promise.all([
    prisma.funil.findMany({ where: { workspaceId }, select: { id: true, nome: true, responsavel: true } }),
    prisma.funilEtapa.findMany({
      where: { workspaceId },
      select: { id: true, funilId: true, titulo: true, ordem: true },
    }),
    prisma.negocioCard.findMany({
      where: { workspaceId },
      select: {
        id: true,
        etapaId: true,
        ordem: true,
        nome: true,
        valor: true,
        origem: true,
        dias: true,
        data: true,
        etiquetas: true,
        responsavel: true,
        statusFechamento: true,
        motivoPerda: true,
        dataFechamento: true,
      },
    }),
  ]);

  const funilPorId = new Map(funisAtuais.map((f) => [f.id, f]));
  const etapaPorId = new Map(etapasAtuais.map((e) => [e.id, e]));
  const cardPorId = new Map(cardsAtuais.map((c) => [c.id, c]));

  /** Data de fechamento normalizada pra "AAAA-MM-DD" (ou null) dos dois lados da comparação. O
   * banco devolve `Date` e o front manda string; comparar direto marcaria tudo como alterado. */
  function dataFechamentoIso(valor: Date | string | null | undefined): string | null {
    if (!valor) return null;
    return valor instanceof Date ? valor.toISOString().slice(0, 10) : valor.slice(0, 10);
  }

  const operacoes: Prisma.PrismaPromise<unknown>[] = [];

  // Os `deleteMany` continuam sempre: são 3 instruções, e é o que apaga o que sumiu do payload.
  operacoes.push(
    prisma.negocioCard.deleteMany({
      where: {
        workspaceId,
        ...filtroConexaoDeNegocio(provedores),
        id: { notIn: idsCards.length ? idsCards : ["__nenhum__"] },
      },
    }),
    prisma.funilEtapa.deleteMany({
      where: { workspaceId, id: { notIn: idsEtapas.length ? idsEtapas : ["__nenhum__"] } },
    }),
    prisma.funil.deleteMany({
      where: { workspaceId, id: { notIn: idsFunis.length ? idsFunis : ["__nenhum__"] } },
    }),
  );

  for (const f of funis) {
    const atual = funilPorId.get(f.id);
    if (!atual) {
      operacoes.push(
        prisma.funil.create({ data: { id: f.id, workspaceId, nome: f.nome, responsavel: f.responsavel } }),
      );
    } else if (atual.nome !== f.nome || (atual.responsavel ?? undefined) !== f.responsavel) {
      operacoes.push(
        prisma.funil.update({ where: { id: f.id }, data: { nome: f.nome, responsavel: f.responsavel } }),
      );
    }
  }

  for (const f of funis) {
    f.colunas.forEach((c, ordemEtapa) => {
      const atual = etapaPorId.get(c.id);
      if (!atual) {
        operacoes.push(
          prisma.funilEtapa.create({
            data: { id: c.id, workspaceId, funilId: f.id, titulo: c.titulo, ordem: ordemEtapa },
          }),
        );
      } else if (atual.funilId !== f.id || atual.titulo !== c.titulo || atual.ordem !== ordemEtapa) {
        operacoes.push(
          prisma.funilEtapa.update({
            where: { id: c.id },
            data: { funilId: f.id, titulo: c.titulo, ordem: ordemEtapa },
          }),
        );
      }
    });
  }

  // Cards novos vão todos numa instrução só (`createMany`), em vez de uma por card. É o caso do
  // "Trazer conversas", que pode criar dezenas de uma vez.
  const cardsParaCriar: Prisma.NegocioCardCreateManyInput[] = [];

  for (const f of funis) {
    for (const c of f.colunas) {
      c.cards.forEach((card, ordemCard) => {
        const dataFechamento = card.dataFechamento ? new Date(card.dataFechamento) : null;
        const atual = cardPorId.get(card.id);
        if (!atual) {
          cardsParaCriar.push({
            id: card.id,
            workspaceId,
            etapaId: c.id,
            ordem: ordemCard,
            nome: card.nome,
            valor: card.valor,
            origem: card.origem,
            dias: card.dias,
            data: card.data,
            etiquetas: card.etiquetas ?? undefined,
            responsavel: card.responsavel,
            statusFechamento: card.statusFechamento ?? undefined,
            motivoPerda: card.motivoPerda ?? undefined,
            dataFechamento: dataFechamento ?? undefined,
          });
          return;
        }

        const mudou =
          atual.etapaId !== c.id ||
          atual.ordem !== ordemCard ||
          atual.nome !== card.nome ||
          atual.valor !== card.valor ||
          atual.origem !== card.origem ||
          atual.dias !== card.dias ||
          atual.data !== card.data ||
          JSON.stringify(atual.etiquetas ?? null) !== JSON.stringify(card.etiquetas ?? null) ||
          (atual.responsavel ?? undefined) !== card.responsavel ||
          (atual.statusFechamento ?? null) !== (card.statusFechamento ?? null) ||
          (atual.motivoPerda ?? null) !== (card.motivoPerda ?? null) ||
          dataFechamentoIso(atual.dataFechamento) !== dataFechamentoIso(card.dataFechamento);
        if (!mudou) return;

        operacoes.push(
          prisma.negocioCard.update({
            where: { id: card.id },
            data: {
              etapaId: c.id,
              ordem: ordemCard,
              nome: card.nome,
              valor: card.valor,
              origem: card.origem,
              dias: card.dias,
              data: card.data,
              etiquetas: card.etiquetas ?? undefined,
              responsavel: card.responsavel,
              statusFechamento: card.statusFechamento ?? null,
              motivoPerda: card.motivoPerda ?? null,
              dataFechamento,
            },
          }),
        );
      });
    }
  }

  if (cardsParaCriar.length) {
    operacoes.push(prisma.negocioCard.createMany({ data: cardsParaCriar }));
  }

  // Card novo no quadro dispara os gatilhos de "criado nesta etapa". Depois da gravação, e sem
  // esperar: automação é efeito secundário de salvar o funil, e uma automação com problema não
  // pode fazer o salvamento falhar.
  const criadosParaGatilho = cardsParaCriar.map((c) => ({ etapaId: c.etapaId, nome: c.nome }));

  // A transação inteira estava sem tratamento de erro: qualquer falha do banco virava um 500 mudo,
  // e a tela só conseguia dizer "Funis não foram salvos: 500": sem nada que apontasse a causa, nem
  // no navegador nem pra quem fosse investigar. O erro real fica no log do servidor, com quantos
  // funis/etapas/cards estavam no payload, que é o que separa "dado inválido num card" de
  // "transação grande demais e estourou o tempo".
  try {
    // Em LOTES, não numa transação só.
    //
    // Uma transação única com centenas de instruções estourava o prazo e devolvia "o funil é
    // grande demais": e o pior: não salvava nada, nem a parte que já tinha passado. Um funil que
    // cresce (é o que se espera de um CRM em uso) ficava com um teto invisível a partir do qual
    // parava de salvar.
    //
    // Cada lote é uma transação: dentro dele continua tudo-ou-nada, que é o que importa pra não
    // deixar um card sem etapa. Entre lotes não há atomicidade, e isso é aceitável aqui. O pior
    // caso de uma falha no meio é parte da reordenação ficar pra trás, coisa que o próximo
    // salvamento corrige. Perder o salvamento inteiro é bem pior.
    const TAMANHO_DO_LOTE = 50;
    for (let i = 0; i < operacoes.length; i += TAMANHO_DO_LOTE) {
      await prisma.$transaction(operacoes.slice(i, i + TAMANHO_DO_LOTE), {
        // O padrão do Prisma é 5s de execução e 2s de espera por conexão, e aqui isso é pouco:
        // cada instrução é uma ida e volta até o banco no Railway. O `maxWait` sobe pelo mesmo
        // motivo: o pool tem só 3 conexões, e sob salvamentos seguidos a espera por uma conexão
        // livre estourava antes mesmo de a transação começar.
        timeout: 20_000,
        maxWait: 15_000,
      });
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    // O código do Prisma (P2028 = prazo da transação, P2002 = id repetido, P2003 = chave
    // estrangeira) é o que separa "demorou demais" de "dado inválido". Sem ele, todo problema
    // diferente chegava na tela com o mesmo texto e não dava pra investigar sem o log do servidor.
    const codigo = (erro as { code?: string })?.code;
    console.error("[api/funis] falha ao salvar:", {
      workspaceId,
      funis: funis.length,
      etapas: idsEtapas.length,
      cards: idsCards.length,
      // Quantas instruções a transação realmente levou. Com a comparação contra o banco isto é
      // quase sempre um número pequeno, e um número grande aqui é o sinal de que algo está
      // marcando tudo como alterado a cada salvamento.
      operacoes: operacoes.length,
      codigo,
      mensagem,
    });
    return NextResponse.json(
      {
        erro:
          codigo === "P2028"
            ? "O banco demorou demais pra responder. Parte do funil pode não ter sido salva. Recarregue a página."
            : "Não foi possível salvar o funil agora.",
        // Só o código, nunca a mensagem crua do banco: ela carrega nome de tabela, coluna e às
        // vezes o próprio valor do registro, e isso não pode chegar ao navegador.
        codigo,
      },
      { status: 500 },
    );
  }

  for (const criado of criadosParaGatilho) {
    dispararGatilhosDaEtapa({
      workspaceId,
      etapaId: criado.etapaId,
      contatoNome: criado.nome,
      evento: "criado",
    }).catch((erro) => console.error("[funil] falha ao disparar gatilhos de card criado:", erro));
  }

  return NextResponse.json({ ok: true });
}
