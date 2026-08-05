import { NextResponse } from "next/server";

import type { Funil } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET lista os funis do workspace de quem está logado, com etapas e negócios, na ordem salva. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.funil.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    include: { etapas: { orderBy: { ordem: "asc" }, include: { cards: { orderBy: { ordem: "asc" } } } } },
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
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const funis = (await request.json()) as Funil[];

  const idsFunis = funis.map((f) => f.id);
  const idsEtapas = funis.flatMap((f) => f.colunas.map((c) => c.id));
  const idsCards = funis.flatMap((f) => f.colunas.flatMap((c) => c.cards.map((card) => card.id)));

  await prisma.$transaction([
    prisma.negocioCard.deleteMany({
      where: { workspaceId, id: { notIn: idsCards.length ? idsCards : ["__nenhum__"] } },
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
            },
          }),
        ),
      ),
    ),
  ]);

  return NextResponse.json({ ok: true });
}
