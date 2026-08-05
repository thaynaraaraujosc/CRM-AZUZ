import { NextResponse } from "next/server";

import type { Compromisso } from "@/lib/agenda-context";
import { prisma } from "@/lib/prisma";

/** GET lista todos os compromissos manuais. */
export async function GET() {
  const linhas = await prisma.compromisso.findMany({ orderBy: { criadoEm: "asc" } });
  return NextResponse.json(linhas as Compromisso[]);
}

/** POST cria um agendamento novo — mesma semântica de `criarAgendamento` no Context. */
export async function POST(request: Request) {
  const dados = (await request.json()) as Omit<Compromisso, "id" | "status" | "origem">;
  if (!dados.contato || !dados.dataIso) {
    return NextResponse.json({ erro: "Campos obrigatórios: contato, dataIso" }, { status: 400 });
  }

  const linha = await prisma.compromisso.create({
    data: {
      id: `compromisso-${Date.now()}`,
      contato: dados.contato,
      contatoId: dados.contatoId,
      responsavel: dados.responsavel,
      dataIso: dados.dataIso,
      hora: dados.hora,
      horaFim: dados.horaFim,
      tipo: dados.tipo,
      categoria: dados.categoria,
      descricao: dados.descricao,
      local: dados.local,
      status: "agendado",
      origem: "manual",
    },
  });

  return NextResponse.json(linha as Compromisso, { status: 201 });
}
