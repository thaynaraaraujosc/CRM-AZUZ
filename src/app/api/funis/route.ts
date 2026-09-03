import { NextResponse } from "next/server";

import type { Funil } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filtroConexaoDeNegocio, provedoresConectados } from "@/lib/integracoes/conta-canal";

/** GET lista os funis do workspace de quem está logado, com etapas e negócios, na ordem salva. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Mesmo filtro por conexão das conversas: negócio que nasceu de um canal desconectado some do
  // funil sem sair do banco, e volta inteiro se aquela conexão voltar (ver `conta-canal.ts`). Card
  // criado à mão tem `contaCanal` nulo e aparece sempre.
  const provedores = await provedoresConectados(sessao.user.workspaceId);
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
 * PUT reconcilia o funil do workspace de quem está logado com o array `funis` mandado pelo front —
 * não existem mutadores dedicados no Context pra Funil (~13 pontos em
 * `funil/page.tsx`/`FunisSecao.tsx` mexem direto em `setFunis`), então o Provider sincroniza o
 * estado inteiro a cada mudança em vez de granular por operação. Roda numa transação: upsert de
 * cada funil/etapa/card presente, e apaga o que sumiu do array — **sempre filtrado por
 * `workspaceId`** nos `deleteMany`, senão apagaria funis/etapas/cards de outras empresas (qualquer
 * id que não seja dessa empresa "não está no payload dela").
 *
 * O `deleteMany` dos cards leva TAMBÉM o filtro por conexão, e isso não é detalhe: o GET esconde
 * os negócios de um canal desconectado, então o front nunca os recebe — e "não veio no payload"
 * passaria a significar "apague". Sem esta linha, desconectar um canal deixava de esconder os
 * negócios dele e passava a APAGÁ-LOS no primeiro salvamento seguinte. Regra geral: um PUT que
 * reconcilia estado inteiro só pode apagar dentro do mesmo recorte que o GET mostrou.
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const funis = (await request.json()) as Funil[];

  const provedores = await provedoresConectados(workspaceId);

  const idsFunis = funis.map((f) => f.id);
  const idsEtapas = funis.flatMap((f) => f.colunas.map((c) => c.id));
  const idsCards = funis.flatMap((f) => f.colunas.flatMap((c) => c.cards.map((card) => card.id)));

  // A transação inteira estava sem tratamento de erro: qualquer falha do banco virava um 500 mudo,
  // e a tela só conseguia dizer "Funis não foram salvos: 500" — sem nada que apontasse a causa, nem
  // no navegador nem pra quem fosse investigar. O erro real fica no log do servidor, com quantos
  // funis/etapas/cards estavam no payload, que é o que separa "dado inválido num card" de
  // "transação grande demais e estourou o tempo".
  try {
    await prisma.$transaction(
      [
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
        ...funis.map((f) =>
          prisma.funil.upsert({
            where: { id: f.id },
            create: { id: f.id, workspaceId, nome: f.nome, responsavel: f.responsavel },
            update: { nome: f.nome, responsavel: f.responsavel },
          }),
        ),
        ...funis.flatMap((f) =>
          f.colunas.map((c, ordemEtapa) =>
            prisma.funilEtapa.upsert({
              where: { id: c.id },
              create: { id: c.id, workspaceId, funilId: f.id, titulo: c.titulo, ordem: ordemEtapa },
              update: { funilId: f.id, titulo: c.titulo, ordem: ordemEtapa },
            }),
          ),
        ),
        ...funis.flatMap((f) =>
          f.colunas.flatMap((c) =>
            c.cards.map((card, ordemCard) =>
              prisma.negocioCard.upsert({
                where: { id: card.id },
                create: {
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
                  dataFechamento: card.dataFechamento ? new Date(card.dataFechamento) : undefined,
                },
                update: {
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
                  dataFechamento: card.dataFechamento ? new Date(card.dataFechamento) : null,
                },
              }),
            ),
          ),
        ),
      ],
      // O padrão do Prisma para transação em lote é 5s de execução e 2s de espera por conexão.
      // Aqui isso é pouco: a reconciliação manda uma instrução por funil, por etapa e por CARD, e
      // cada uma é uma ida e volta até o banco no Railway. Com algumas dezenas de negócios o
      // tempo somado passa dos 5s e a transação inteira é abortada por prazo — o funil não salva,
      // e a mensagem que chega na tela ("Não foi possível salvar") não diz que o motivo foi tempo.
      // O `maxWait` sobe pelo mesmo motivo: o pool tem só 3 conexões, e sob salvamentos seguidos a
      // espera por uma conexão livre estourava antes mesmo de a transação começar.
      { timeout: 20_000, maxWait: 15_000 },
    );
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
      codigo,
      mensagem,
    });
    return NextResponse.json(
      {
        erro:
          codigo === "P2028"
            ? "O funil é grande demais para salvar de uma vez. Tente de novo."
            : "Não foi possível salvar o funil agora.",
        // Só o código, nunca a mensagem crua do banco: ela carrega nome de tabela, coluna e às
        // vezes o próprio valor do registro, e isso não pode chegar ao navegador.
        codigo,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
