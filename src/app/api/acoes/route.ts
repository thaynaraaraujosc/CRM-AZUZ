import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET lista as ações (listas de transmissão agendadas) do workspace, mais recentes primeiro. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const acoes = await prisma.acaoEnvio.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "desc" },
  });
  return NextResponse.json(acoes);
}

type CorpoCriarAcao = {
  titulo: string;
  legenda?: string;
  midiaTipo: string;
  canais: string[];
  agendadoPara: string;
  contatos: string[];
};

/** POST registra uma nova ação — o disparo de verdade pros contatos ainda não existe (ver
 * comentário no schema, `model AcaoEnvio`); isso só grava o agendamento em si. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = (await request.json()) as CorpoCriarAcao;
  if (!corpo.titulo || !corpo.midiaTipo || !corpo.agendadoPara || !corpo.canais?.length || !corpo.contatos?.length) {
    return NextResponse.json({ erro: "Dados incompletos." }, { status: 400 });
  }

  const acao = await prisma.acaoEnvio.create({
    data: {
      id: `acao-${sessao.user.workspaceId}-${Date.now()}`,
      workspaceId: sessao.user.workspaceId,
      titulo: corpo.titulo,
      legenda: corpo.legenda,
      midiaTipo: corpo.midiaTipo,
      canais: corpo.canais,
      agendadoPara: new Date(corpo.agendadoPara),
      contatos: corpo.contatos,
    },
  });

  return NextResponse.json(acao, { status: 201 });
}
