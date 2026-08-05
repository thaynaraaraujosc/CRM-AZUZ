import { NextResponse } from "next/server";

import type { ColunaTarefas, TaskCard } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type LinhaCard = {
  id: string;
  titulo: string;
  contato: string;
  contatoId: string | null;
  data: string;
  atrasada: boolean;
  responsavelNome: string;
  responsavelInitials: string;
  concluida: boolean;
  urgencia: string;
  descricao: string;
  anexoArquivo: string | null;
  anexoDetalhe: string | null;
  modelo: string | null;
};

/** Linha do banco -> `TaskCard` do front — reconstrói os dois objetos aninhados
 * (`responsavel`, `anexo`) que a tabela guarda em colunas separadas. */
function paraCard(linha: LinhaCard): TaskCard {
  return {
    id: linha.id,
    titulo: linha.titulo,
    contato: linha.contato,
    contatoId: linha.contatoId ?? undefined,
    data: linha.data,
    atrasada: linha.atrasada,
    responsavel: { nome: linha.responsavelNome, initials: linha.responsavelInitials },
    concluida: linha.concluida,
    urgencia: linha.urgencia as TaskCard["urgencia"],
    descricao: linha.descricao,
    anexo: linha.anexoArquivo ? { arquivo: linha.anexoArquivo, detalhe: linha.anexoDetalhe ?? "" } : null,
    modelo: linha.modelo ?? undefined,
  };
}

/** GET lista todas as etapas com seus cards, na ordem salva. */
export async function GET() {
  const etapas = await prisma.tarefaEtapa.findMany({
    orderBy: { ordem: "asc" },
    include: { cards: { orderBy: { ordem: "asc" } } },
  });
  const colunas: ColunaTarefas[] = etapas.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    cards: e.cards.map(paraCard),
  }));
  return NextResponse.json(colunas);
}

/**
 * POST cria um card novo na etapa indicada por título (mesma semântica de `criarTarefa` no
 * Context: "Hoje" por padrão se `coluna` não vier).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    titulo: string;
    contato?: string;
    contatoId?: string;
    data: string;
    responsavel: { nome: string; initials: string };
    urgencia: string;
    descricao: string;
    anexo?: { arquivo: string; detalhe: string } | null;
    modelo?: string;
    coluna?: string;
  };

  const etapa =
    (await prisma.tarefaEtapa.findFirst({ where: { titulo: body.coluna ?? "Hoje" } })) ??
    (await prisma.tarefaEtapa.findFirst({ orderBy: { ordem: "asc" } }));
  if (!etapa) {
    return NextResponse.json({ erro: "Nenhuma etapa de tarefas existe ainda" }, { status: 400 });
  }

  const ultimoCard = await prisma.tarefaCard.findFirst({
    where: { etapaId: etapa.id },
    orderBy: { ordem: "desc" },
  });

  const linha = await prisma.tarefaCard.create({
    data: {
      id: `tarefa-${Date.now()}`,
      etapaId: etapa.id,
      ordem: (ultimoCard?.ordem ?? -1) + 1,
      titulo: body.titulo,
      contato: body.contato ?? "—",
      contatoId: body.contatoId,
      data: body.data || "Sem data",
      responsavelNome: body.responsavel.nome,
      responsavelInitials: body.responsavel.initials,
      urgencia: body.urgencia,
      descricao: body.descricao || "Sem descrição.",
      anexoArquivo: body.anexo?.arquivo,
      anexoDetalhe: body.anexo?.detalhe,
      modelo: body.modelo,
    },
  });

  return NextResponse.json(paraCard(linha), { status: 201 });
}
